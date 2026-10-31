import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { NotificationType, XpSource } from 'src/common/utils/enum';
import {
  VocabularyComment,
  VocabularyCommentKind,
} from 'src/common/core/entitys/vocabulary-comment.entity';
import { VocabularyCommentLike } from 'src/common/core/entitys/vocabulary-comment-like.entity';
import { VocabularyCommentReport } from 'src/common/core/entitys/vocabulary-comment-report.entity';
import { XpService } from '../gamification/xp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VocabularyService } from './vocabulary.service';
import { ApproveMeaningDto, CreateCommentDto } from './dto';

/** Kuniga eng ko'pi bilan nechta izoh yozish mumkin */
const DAILY_COMMENT_LIMIT = 20;
/** Bitta so'zga bitta talaba yozadigan mnemonika/gap soni */
const PER_WORD_LIMIT = 2;
/** Shuncha xabar kelsa izoh avtomatik yashiriladi (teacher ko'rib chiqadi) */
const AUTO_HIDE_REPORTS = 3;
const LIST_LIMIT = 100;
/** hech kimga tegishli bo'lmagan uuid — teacher ro'yxatida "men like bosganmi" so'rovi uchun */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export const COMMENT_RULES = {
  /** 10 like → +1 coin, 100 → +1, 1000 → +1 … (cheklovsiz) */
  firstMilestone: 10,
  multiplier: 10,
  coinPerMilestone: 1,
  perWordLimit: PER_WORD_LIMIT,
  bodyMax: 200,
};

export interface KnownMeaning {
  pairId: string;
  translation: string;
  key: string;
  lessonId: string | null;
}

/** Ma'no / so'z kaliti: kichik harf, ortiqcha bo'shliqlarsiz (SQL dagi `norm_key` bilan bir xil) */
export const commentKey = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

const SQL_KEY = (col: string) => `regexp_replace(lower(trim(${col})), '\\s+', ' ', 'g')`;

/** Nechta bosqich (10/100/1000…) to'lgani va keyingisi nechada */
export function likeMilestones(likes: number): { tiers: number; nextAt: number } {
  let tiers = 0;
  let threshold = COMMENT_RULES.firstMilestone;
  while (likes >= threshold) {
    tiers++;
    threshold *= COMMENT_RULES.multiplier;
  }
  return { tiers, nextAt: threshold };
}

@Injectable()
export class VocabularyCommentsService {
  private readonly logger = new Logger(VocabularyCommentsService.name);

  constructor(
    @InjectRepository(VocabularyComment) private readonly commentRepo: Repository<VocabularyComment>,
    @InjectRepository(VocabularyCommentLike) private readonly likeRepo: Repository<VocabularyCommentLike>,
    @InjectRepository(VocabularyCommentReport) private readonly reportRepo: Repository<VocabularyCommentReport>,
    @InjectRepository(Vocabulary) private readonly wordRepo: Repository<Vocabulary>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly xp: XpService,
    private readonly notifications: NotificationsService,
    private readonly vocabulary: VocabularyService,
  ) {}

  // ─── Yordamchilar ──────────────────────────────────────────────────────────

  private async requireAccount(userId: string, what: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    // Mehmon akkaunt IP bo'yicha soatiga 30 tagacha ochiladi — shuning uchun mehmonlar
    // like/izoh/xabar bilan coin yoki moderatsiyani aldab bo'lmasligi uchun faqat O'QIYDI.
    if (user.isGuest) throw new ForbiddenException(`${what} uchun avval akkauntni saqlang`);
    return user;
  }

  private authorName(u?: User): string {
    if (!u) return 'Talaba';
    const first = (u.firstName ?? '').trim();
    const last = (u.lastName ?? '').trim();
    if (first && last) return `${first} ${last[0].toUpperCase()}.`;
    return first || last || u.username;
  }

  private initials(u?: User): string {
    if (!u) return 'T';
    const a = (u.firstName ?? u.username ?? '').trim()[0] ?? '';
    const b = (u.lastName ?? '').trim()[0] ?? '';
    return (a + b).toUpperCase() || 'T';
  }

  private validateBody(raw: string): string {
    const body = raw.trim().replace(/\s+\n/g, '\n');
    if (body.length < 2) throw new BadRequestException('Izoh juda qisqa');
    if (body.length > COMMENT_RULES.bodyMax) throw new BadRequestException(`Izoh ${COMMENT_RULES.bodyMax} belgidan oshmasin`);
    // Reklama/havola — moderatsiyaga ortiqcha yuk: matnda havola va @nom bo'lmaydi
    if (/(https?:\/\/|www\.|t\.me\/|\.(com|uz|ru|org)\b|@\w{3,})/i.test(body)) {
      throw new BadRequestException("Izohda havola yoki @nom bo'lmasin");
    }
    return body;
  }

  /** So'zning lug'atdagi hamma ma'nolari (juftliklar bo'yicha, tarjima matni bilan takrorlanmaydi) */
  async knownMeanings(keys: string[]): Promise<Map<string, KnownMeaning[]>> {
    const map = new Map<string, KnownMeaning[]>();
    if (!keys.length) return map;
    const rows: any[] = await this.commentRepo.manager.query(
      `SELECT DISTINCT ON (${SQL_KEY('v.word')}, ${SQL_KEY('t.word')})
              ${SQL_KEY('v.word')} AS "wordKey",
              r.id AS "pairId", t.word AS translation, ${SQL_KEY('t.word')} AS "key", v.lesson_id AS "lessonId"
         FROM vocabularys v
         JOIN vocabulary_relations r ON r.vocabulary_id = v.id
         JOIN vocabularys t ON t.id = r.translation_id
        WHERE v.lang = 'en' AND ${SQL_KEY('v.word')} = ANY($1::text[])
        ORDER BY ${SQL_KEY('v.word')}, ${SQL_KEY('t.word')}, v.created_at DESC`,
      [keys],
    );
    for (const r of rows) {
      const list = map.get(r.wordKey) ?? [];
      list.push({ pairId: r.pairId, translation: r.translation, key: r.key, lessonId: r.lessonId });
      map.set(r.wordKey, list);
    }
    return map;
  }

  private async groupNames(userIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!userIds.length) return out;
    const rows: any[] = await this.commentRepo.manager.query(
      `SELECT DISTINCT ON (gm.user_id) gm.user_id AS "userId", g.name
         FROM group_members gm JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = ANY($1::uuid[])
        ORDER BY gm.user_id, g.created_at DESC`,
      [userIds],
    );
    rows.forEach((r) => out.set(r.userId, r.name));
    return out;
  }

  /** Izohlarni ilova shakliga o'tkazadi (muallif, guruh, "men like bosganmi") */
  private async hydrate(rows: VocabularyComment[], me: string) {
    if (!rows.length) return [];
    const authorIds = [...new Set(rows.map((r) => r.userId))];
    const [users, groups, liked] = await Promise.all([
      this.userRepo.find({ where: { id: In(authorIds) } }),
      this.groupNames(authorIds),
      this.likeRepo
        .createQueryBuilder('l')
        .select('l.comment_id', 'id')
        .where('l.user_id = :me', { me })
        .andWhere('l.comment_id IN (:...ids)', { ids: rows.map((r) => r.id) })
        .getRawMany(),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const likedSet = new Set(liked.map((l: any) => l.id));

    return rows.map((c) => {
      const mine = c.userId === me;
      const m = mine ? likeMilestones(c.likeCount) : null;
      return {
        id: c.id,
        kind: c.kind,
        body: c.body,
        status: c.status,
        pinned: c.pinned,
        word: c.wordText,
        meaning: c.meaningKey ? { key: c.meaningKey, text: c.meaningText } : null,
        likeCount: c.likeCount,
        liked: likedSet.has(c.id),
        mine,
        author: {
          id: c.userId,
          name: this.authorName(userMap.get(c.userId)),
          initials: this.initials(userMap.get(c.userId)),
          group: groups.get(c.userId) ?? null,
        },
        moderationNote: mine ? c.moderationNote : null,
        coin: mine ? { earned: c.coinsAwarded, likes: c.likeCount, nextAt: m!.nextAt } : null,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  // ─── Talaba: o'qish ────────────────────────────────────────────────────────

  /** Lug'at kartasi uchun: izohlar soni, eng yaxshi izoh va so'zning ma'nolari */
  async preview(userId: string, word: string) {
    const key = commentKey(word);
    if (!key) throw new BadRequestException('word kerak');
    const [total, top, known] = await Promise.all([
      this.commentRepo.count({ where: { wordKey: key, status: 'active' } }),
      this.commentRepo
        .createQueryBuilder('c')
        .where('c.word_key = :key AND c.status = :st', { key, st: 'active' })
        .orderBy('c.pinned', 'DESC')
        .addOrderBy('c.like_count', 'DESC')
        .addOrderBy('c.created_at', 'DESC')
        .limit(1)
        .getMany(),
      this.knownMeanings([key]),
    ]);
    const [topItem] = await this.hydrate(top, userId);
    return {
      word,
      total,
      top: topItem ?? null,
      meanings: (known.get(key) ?? []).map((m) => ({ key: m.key, text: m.translation })),
    };
  }

  /**
   * GET /vocabulary/comments?word=&meaning=&kind=&sort=
   * meaning: tarjima matni | `general` (yorliqsiz) | bo'sh/`all` (hammasi)
   * sort: `top` (qadalgan → like → yangi, standart) | `new`
   */
  async list(userId: string, q: { word: string; meaning?: string; kind?: string; sort?: string }) {
    const key = commentKey(q.word ?? '');
    if (!key) throw new BadRequestException('word kerak');

    const base = () =>
      this.commentRepo
        .createQueryBuilder('c')
        .where('c.word_key = :key', { key })
        .andWhere(
          `(c.status = 'active' OR (c.user_id = :me AND c.status IN ('pending','rejected','hidden')))`,
          { me: userId },
        );

    // Ma'no tablari va soni — faol izohlar bo'yicha
    const [known, counts, suggestionRows] = await Promise.all([
      this.knownMeanings([key]),
      this.commentRepo
        .createQueryBuilder('c')
        .select('c.meaning_key', 'key')
        .addSelect('MAX(c.meaning_text)', 'text')
        .addSelect('COUNT(*)::int', 'count')
        .where('c.word_key = :key AND c.status = :st', { key, st: 'active' })
        .groupBy('c.meaning_key')
        .getRawMany(),
      base().andWhere(`c.kind = 'meaning' AND c.status = 'pending'`).orderBy('c.created_at', 'DESC').limit(20).getMany(),
    ]);

    const countByKey = new Map<string | null, number>(counts.map((r: any) => [r.key, Number(r.count)]));
    const meanings: { key: string; text: string; count: number; inDictionary: boolean }[] = [];
    for (const m of known.get(key) ?? []) {
      meanings.push({ key: m.key, text: m.translation, count: countByKey.get(m.key) ?? 0, inDictionary: true });
    }
    for (const r of counts) {
      if (r.key && !meanings.some((m) => m.key === r.key)) {
        meanings.push({ key: r.key, text: r.text, count: Number(r.count), inDictionary: false });
      }
    }

    const qb = base().andWhere(`NOT (c.kind = 'meaning' AND c.status = 'pending')`);
    if (q.meaning === 'general') qb.andWhere('c.meaning_key IS NULL');
    else if (q.meaning && q.meaning !== 'all') qb.andWhere('c.meaning_key = :mk', { mk: commentKey(q.meaning) });
    if (q.kind && ['mnemonic', 'sentence', 'meaning'].includes(q.kind)) qb.andWhere('c.kind = :kind', { kind: q.kind });

    if (q.sort === 'new') {
      qb.orderBy('c.created_at', 'DESC');
    } else {
      qb.orderBy('c.pinned', 'DESC').addOrderBy('c.like_count', 'DESC').addOrderBy('c.created_at', 'DESC');
    }
    const rows = await qb.limit(LIST_LIMIT).getMany();

    const [items, suggestions] = await Promise.all([this.hydrate(rows, userId), this.hydrate(suggestionRows, userId)]);
    return {
      word: q.word,
      total: meanings.reduce((s, m) => s + m.count, 0) + (countByKey.get(null) ?? 0),
      generalCount: countByKey.get(null) ?? 0,
      meanings,
      items,
      suggestions,
      rules: COMMENT_RULES,
    };
  }

  /** Mening izohlarim: umumiy hisob + har izohning coin chizig'i */
  async mine(userId: string) {
    const rows = await this.commentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const items = await this.hydrate(rows, userId);
    const active = rows.filter((r) => r.status === 'active');
    return {
      totals: {
        comments: rows.length,
        likes: active.reduce((s, r) => s + r.likeCount, 0),
        coins: active.reduce((s, r) => s + r.coinsAwarded * COMMENT_RULES.coinPerMilestone, 0),
      },
      items,
      rules: COMMENT_RULES,
    };
  }

  // ─── Talaba: yozish ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCommentDto) {
    await this.requireAccount(userId, 'Izoh yozish');

    const wordText = dto.word.trim();
    const wordKey = commentKey(wordText);
    if (!wordKey) throw new BadRequestException('So\'z kerak');
    const body = this.validateBody(dto.body);

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const todayCount = await this.commentRepo
      .createQueryBuilder('c')
      .where('c.user_id = :userId AND c.created_at >= :since', { userId, since })
      .getCount();
    if (todayCount >= DAILY_COMMENT_LIMIT) throw new BadRequestException('Bugun juda ko\'p izoh yozdingiz, ertaga davom eting');

    const known = (await this.knownMeanings([wordKey])).get(wordKey) ?? [];
    const kind: VocabularyCommentKind = dto.kind;

    let meaningText: string | null = null;
    let meaningKey: string | null = null;
    let pairId: string | null = null;
    let status: 'active' | 'pending' = 'active';

    if (kind === 'meaning') {
      const suggested = (dto.meaning ?? '').trim();
      if (suggested.length < 2) throw new BadRequestException('Yangi ma\'noni yozing');
      meaningKey = commentKey(suggested);
      if (known.some((m) => m.key === meaningKey)) throw new BadRequestException('Bu ma\'no lug\'atda bor');
      const dup = await this.commentRepo.count({
        where: { wordKey, meaningKey, kind: 'meaning', status: 'pending' },
      });
      if (dup) throw new BadRequestException('Bu ma\'no allaqachon taklif qilingan, teacher tekshiryapti');
      meaningText = suggested;
      status = 'pending';
    } else {
      const own = await this.commentRepo
        .createQueryBuilder('c')
        .where('c.user_id = :userId AND c.word_key = :wordKey', { userId, wordKey })
        .andWhere(`c.kind <> 'meaning' AND c.status IN ('active','pending','hidden')`)
        .getCount();
      if (own >= PER_WORD_LIMIT) {
        throw new BadRequestException(`Bitta so'zga ${PER_WORD_LIMIT} tagacha izoh yozish mumkin — eskisini tahrirlang`);
      }
      const label = (dto.meaning ?? '').trim();
      if (label) {
        const hit = known.find((m) => m.key === commentKey(label));
        // Lug'atda ma'nolar bor bo'lsa — faqat shulardan biri yorliq bo'ladi (tab'lar axlatga to'lmasin)
        if (hit) {
          meaningText = hit.translation;
          meaningKey = hit.key;
          pairId = hit.pairId;
        } else if (!known.length) {
          meaningText = label;
          meaningKey = commentKey(label);
        }
      }
    }

    const saved = await this.commentRepo.save(
      this.commentRepo.create({ userId, wordKey, wordText, kind, body, meaningText, meaningKey, pairId, status }),
    );
    const [item] = await this.hydrate([saved], userId);
    return item;
  }

  async update(userId: string, id: string, body: string) {
    await this.requireAccount(userId, 'Izohni tahrirlash');
    const c = await this.commentRepo.findOne({ where: { id, userId } });
    if (!c) throw new NotFoundException('Izoh topilmadi');
    if (!['active', 'pending'].includes(c.status)) throw new BadRequestException('Bu izohni tahrirlab bo\'lmaydi');
    c.body = this.validateBody(body);
    const saved = await this.commentRepo.save(c);
    const [item] = await this.hydrate([saved], userId);
    return item;
  }

  /** O'z izohini o'chirish. Olingan coin qaytarilmaydi (kalit bir martalik). */
  async remove(userId: string, id: string) {
    const res = await this.commentRepo.delete({ id, userId });
    if (!res.affected) throw new NotFoundException('Izoh topilmadi');
    return { deleted: true };
  }

  // ─── Like ──────────────────────────────────────────────────────────────────

  /** Bitta talaba bitta izohga FAQAT 1 marta like bosadi (+1). Qayta bossa o'zgarmaydi. */
  async like(userId: string, id: string) {
    await this.requireAccount(userId, 'Like bosish');
    const c = await this.commentRepo.findOne({ where: { id } });
    if (!c || c.status === 'rejected' || c.status === 'hidden') throw new NotFoundException('Izoh topilmadi');
    if (c.userId === userId) throw new BadRequestException('O\'z izohingizga like bosib bo\'lmaydi');
    if (c.status !== 'active') throw new BadRequestException('Teacher tasdiqlamaguncha like bosib bo\'lmaydi');

    const ins = await this.likeRepo
      .createQueryBuilder()
      .insert()
      .into(VocabularyCommentLike)
      .values({ commentId: id, userId })
      .orIgnore()
      .returning(['id'])
      .execute();
    const inserted = Array.isArray(ins.raw) && ins.raw.length > 0;

    let likeCount = c.likeCount;
    if (inserted) {
      const upd = await this.commentRepo
        .createQueryBuilder()
        .update()
        .set({ likeCount: () => 'like_count + 1' })
        .where('id = :id', { id })
        .returning(['like_count'])
        .execute();
      likeCount = Number((upd.raw as any[])[0]?.like_count ?? c.likeCount + 1);
      await this.awardMilestones(c, likeCount);
    }
    return { liked: true, likeCount };
  }

  async unlike(userId: string, id: string) {
    await this.requireAccount(userId, 'Like olib tashlash');
    const c = await this.commentRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Izoh topilmadi');
    const del = await this.likeRepo.delete({ commentId: id, userId });
    let likeCount = c.likeCount;
    if (del.affected) {
      const upd = await this.commentRepo
        .createQueryBuilder()
        .update()
        .set({ likeCount: () => 'GREATEST(like_count - 1, 0)' })
        .where('id = :id', { id })
        .returning(['like_count'])
        .execute();
      likeCount = Number((upd.raw as any[])[0]?.like_count ?? Math.max(c.likeCount - 1, 0));
    }
    return { liked: false, likeCount };
  }

  /**
   * Like soni 10 / 100 / 1000 … ga yetganda muallifga +1 coin. Coin `XpService` orqali,
   * kalit `vcomment:<id>:t<bosqich>` — bir bosqich uchun BIR MARTA (like olib tashlanib
   * qayta bosilsa ham ikkinchi marta berilmaydi).
   */
  private async awardMilestones(c: VocabularyComment, likes: number) {
    const { tiers } = likeMilestones(likes);
    const fresh = await this.commentRepo.findOne({ where: { id: c.id }, select: ['id', 'coinsAwarded'] });
    const done = fresh?.coinsAwarded ?? c.coinsAwarded;
    if (tiers <= done) return;

    let given = 0;
    for (let k = done + 1; k <= tiers; k++) {
      given += await this.xp.award({
        userId: c.userId,
        amount: COMMENT_RULES.coinPerMilestone,
        source: XpSource.vocabulary_comment,
        referenceId: c.id,
        referenceKey: `vcomment:${c.id}:t${k}`,
      });
    }
    await this.commentRepo
      .createQueryBuilder()
      .update()
      .set({ coinsAwarded: () => `GREATEST(coins_awarded, ${Number(tiers)})` })
      .where('id = :id', { id: c.id })
      .execute();

    if (given > 0) {
      const threshold = COMMENT_RULES.firstMilestone * COMMENT_RULES.multiplier ** (tiers - 1);
      await this.safeNotify(c.userId, {
        title: `+${given} coin! Izohingiz ${threshold} ta like oldi`,
        body: `${c.wordText} · «${c.body.length > 60 ? c.body.slice(0, 57) + '…' : c.body}»`,
        referenceId: c.id,
      });
    }
  }

  private async safeNotify(userId: string, p: { title: string; body: string; referenceId?: string }) {
    try {
      await this.notifications.notify([userId], {
        type: NotificationType.achievement,
        title: p.title,
        body: p.body,
        referenceId: p.referenceId ?? null,
        referenceType: 'vocabulary_comment',
        channel: 'default',
      });
    } catch (e) {
      this.logger.warn(`Izoh bildirishnomasi yuborilmadi: ${(e as Error).message}`);
    }
  }

  // ─── Xabar berish ──────────────────────────────────────────────────────────

  async report(userId: string, id: string, reason?: string) {
    await this.requireAccount(userId, 'Xabar berish');
    const c = await this.commentRepo.findOne({ where: { id } });
    if (!c || c.status === 'rejected') throw new NotFoundException('Izoh topilmadi');
    if (c.userId === userId) throw new BadRequestException('O\'z izohingiz haqida xabar berib bo\'lmaydi');

    await this.reportRepo
      .createQueryBuilder()
      .insert()
      .into(VocabularyCommentReport)
      .values({ commentId: id, userId, reason: reason?.trim() || null })
      .orIgnore()
      .execute();

    const open = await this.reportRepo.count({ where: { commentId: id, resolved: false } });
    const patch: Partial<VocabularyComment> = { reportCount: open };
    if (open >= AUTO_HIDE_REPORTS && c.status === 'active') {
      patch.status = 'hidden';
      patch.moderationNote = 'Ko\'p xabar kelgani uchun yashirildi — teacher ko\'rib chiqadi';
    }
    await this.commentRepo.update(id, patch);
    return { reported: true };
  }

  // ─── Teacher: moderatsiya ──────────────────────────────────────────────────

  async teacherList(tab: 'meanings' | 'reports' | 'pinned' | 'hidden', search?: string) {
    const qb = this.commentRepo.createQueryBuilder('c');
    if (tab === 'meanings') qb.where(`c.kind = 'meaning' AND c.status = 'pending'`).orderBy('c.created_at', 'ASC');
    else if (tab === 'reports') qb.where('c.report_count > 0 AND c.status IN (\'active\',\'hidden\')').orderBy('c.report_count', 'DESC');
    else if (tab === 'pinned') qb.where('c.pinned = true').orderBy('c.updated_at', 'DESC');
    else qb.where(`c.status = 'hidden'`).orderBy('c.updated_at', 'DESC');
    if (search?.trim()) qb.andWhere('c.word_key LIKE :s', { s: `%${commentKey(search)}%` });
    const rows = await qb.limit(100).getMany();

    const keys = [...new Set(rows.map((r) => r.wordKey))];
    const [items, known, reports, counts] = await Promise.all([
      this.hydrate(rows, NIL_UUID),
      this.knownMeanings(keys),
      rows.length
        ? this.reportRepo
            .createQueryBuilder('r')
            .leftJoin(User, 'u', 'u.id = r.user_id')
            .select(['r.comment_id AS "commentId"', 'r.reason AS reason', 'u.first_name AS "firstName"', 'u.username AS username'])
            .where('r.resolved = false AND r.comment_id IN (:...ids)', { ids: rows.map((r) => r.id) })
            .getRawMany()
        : [],
      this.teacherCounts(),
    ]);

    return {
      counts,
      items: items.map((it, i) => ({
        ...it,
        wordKey: rows[i].wordKey,
        reportCount: rows[i].reportCount,
        reports: reports
          .filter((r: any) => r.commentId === it.id)
          .map((r: any) => ({ by: r.firstName || r.username, reason: r.reason })),
        existing: (known.get(rows[i].wordKey) ?? []).map((m) => ({
          pairId: m.pairId,
          translation: m.translation,
          lessonId: m.lessonId,
        })),
      })),
    };
  }

  private async teacherCounts() {
    const [meanings, reports, pinned, hidden] = await Promise.all([
      this.commentRepo.count({ where: { kind: 'meaning', status: 'pending' } }),
      this.commentRepo
        .createQueryBuilder('c')
        .where(`c.report_count > 0 AND c.status IN ('active','hidden')`)
        .getCount(),
      this.commentRepo.count({ where: { pinned: true } }),
      this.commentRepo.count({ where: { status: 'hidden' } }),
    ]);
    return { meanings, reports, pinned, hidden };
  }

  private async mustFind(id: string) {
    const c = await this.commentRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Izoh topilmadi');
    return c;
  }

  /** Yangi ma'noni tasdiqlash: lug'atga yangi juftlik qo'shish yoki mavjud ma'noga biriktirish */
  async approveMeaning(id: string, dto: ApproveMeaningDto) {
    const c = await this.mustFind(id);
    if (c.kind !== 'meaning' || c.status !== 'pending') throw new BadRequestException('Bu izoh tasdiq kutmayapti');

    const translation = (dto.translation ?? c.meaningText ?? '').trim();
    if (translation.length < 2) throw new BadRequestException('Tarjima kerak');
    const key = commentKey(translation);
    const known = (await this.knownMeanings([c.wordKey])).get(c.wordKey) ?? [];
    const hit = known.find((m) => m.key === key);

    if (dto.mode === 'attach') {
      if (!hit) throw new BadRequestException('Bunday ma\'no lug\'atda yo\'q');
      c.meaningText = hit.translation;
      c.meaningKey = hit.key;
      c.pairId = hit.pairId;
    } else {
      if (hit) throw new BadRequestException('Bu ma\'no lug\'atda bor — "Mavjud ma\'noga qo\'shish"ni tanlang');
      const existingEn = await this.wordRepo
        .createQueryBuilder('v')
        .where(`v.lang = 'en' AND ${SQL_KEY('v.word')} = :key`, { key: c.wordKey })
        .orderBy('v.created_at', 'DESC')
        .getOne();
      const en = await this.vocabulary.createWord({
        word: c.wordText,
        lang: 'en',
        ipa: existingEn?.ipa ?? undefined,
        pos: existingEn?.pos ?? undefined,
        lessonId: dto.lessonId,
      });
      const uz = await this.vocabulary.createWord({ word: translation, lang: 'uz', lessonId: dto.lessonId });
      const pair = await this.vocabulary.createPair({ vocabularyId: en.id, translationId: uz.id });
      c.meaningText = translation;
      c.meaningKey = key;
      c.pairId = pair.pairId;
    }
    // kind 'meaning' qoladi: tasdiqlangach ham "Ma'no" turi bilan (misol gap + yangi ma'no) ko'rinadi
    c.status = 'active';
    c.moderationNote = null;
    await this.commentRepo.save(c);

    await this.safeNotify(c.userId, {
      title: 'Taklif qilgan ma\'noingiz tasdiqlandi',
      body: `${c.wordText} — ${c.meaningText}`,
      referenceId: c.id,
    });
    return { approved: true };
  }

  async rejectMeaning(id: string, note?: string) {
    const c = await this.mustFind(id);
    if (c.kind !== 'meaning' || c.status !== 'pending') throw new BadRequestException('Bu izoh tasdiq kutmayapti');
    c.status = 'rejected';
    c.moderationNote = note?.trim() || null;
    await this.commentRepo.save(c);
    await this.safeNotify(c.userId, {
      title: 'Taklif qilgan ma\'noingiz qabul qilinmadi',
      body: note?.trim() ? `${c.wordText}: ${note.trim()}` : `${c.wordText} — "${c.meaningText}"`,
      referenceId: c.id,
    });
    return { rejected: true };
  }

  /** Bitta so'z+ma'no uchun bitta "O'qituvchi tanlovi" bo'ladi */
  async pin(id: string) {
    const c = await this.mustFind(id);
    if (c.status !== 'active') throw new BadRequestException('Faqat faol izohni qadash mumkin');
    await this.commentRepo
      .createQueryBuilder()
      .update()
      .set({ pinned: false })
      .where('word_key = :k AND meaning_key IS NOT DISTINCT FROM :m AND pinned = true', { k: c.wordKey, m: c.meaningKey })
      .execute();
    await this.commentRepo.update(id, { pinned: true });
    return { pinned: true };
  }

  async unpin(id: string) {
    await this.mustFind(id);
    await this.commentRepo.update(id, { pinned: false });
    return { pinned: false };
  }

  async hide(id: string, note?: string) {
    const c = await this.mustFind(id);
    await this.commentRepo.update(id, { status: 'hidden', pinned: false, moderationNote: note?.trim() || 'Teacher yashirdi' });
    await this.reportRepo.update({ commentId: id }, { resolved: true });
    return { hidden: true, id: c.id };
  }

  /** Yashirilgan izohni qaytarish yoki xabarlarni "muammo yo'q" deb yopish */
  async restore(id: string) {
    const c = await this.mustFind(id);
    await this.reportRepo.update({ commentId: id }, { resolved: true });
    await this.commentRepo.update(id, {
      status: c.status === 'hidden' ? 'active' : c.status,
      reportCount: 0,
      moderationNote: null,
    });
    return { restored: true };
  }

  async teacherDelete(id: string) {
    const res = await this.commentRepo.delete({ id });
    if (!res.affected) throw new NotFoundException('Izoh topilmadi');
    return { deleted: true };
  }
}

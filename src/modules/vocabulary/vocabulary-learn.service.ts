import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { VocabularyRelation } from 'src/common/core/entitys/vocabulary-relation.entity';
import { VocabularyExample } from 'src/common/core/entitys/vocabulary-example.entity';
import { UserVocabularyProgress, VocabStatus } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { VocabularyPracticeLog, PracticeMode } from 'src/common/core/entitys/vocabulary-practice-log.entity';
import { VocabularySaved } from 'src/common/core/entitys/vocabulary-saved.entity';
import { VocabularyLentaState } from 'src/common/core/entitys/vocabulary-lenta-state.entity';
import { VocabularyComment } from 'src/common/core/entitys/vocabulary-comment.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonGatingService } from 'src/common/services/lesson-gating.service';
import { XpService } from '../gamification/xp.service';
import { VocabularyCoinTestService, SRS_LONG_TERM_STEP, srsNextReview } from './vocabulary-coin-test.service';
import { commentKey } from './vocabulary-comments.service';

/**
 * LUG'AT — YANGI O'QISH OQIMI (2026-11, foydalanuvchi qarori).
 *
 * Dars → Lug'at uch bo'limdan iborat:
 *   A · Tanishuv  — shorts kartalari (rasm, talaffuz, tarjima, misol, izohlar).
 *                   Ko'rilgan so'z `seen_at` oladi.
 *   B · Testlash  — dars so'zlari 10 tadan BO'LAKLARGA bo'linadi (70 → 7);
 *                   5 tadan kam qoldiq oldingi bo'lakka qo'shiladi. Har bo'lak
 *                   3 pog'onali aylana lenta (eshitib tanlash → harf yig'ish →
 *                   yozish); holat `vocabulary_lenta_states` da. Coin yo'q,
 *                   so'z «o'rganilmoqda» ga o'tadi. 2+ marta xato qilingan,
 *                   hali mustahkam bo'lmagan so'zlar — «O'sish nuqtalari» (8-bo'lak).
 *   C · Coinli sinov — `VocabularyCoinTestService` (35 tadan qismlar).
 *
 * Asosiy «Lug'at» tabi:
 *   Lenta — SRS takrori (1/3/7/30 kun, har takrordan sanaladi):
 *     tartib: kechikkan → bugungi → yangi (kuniga ≤10), jami kuniga ≤30.
 *     «Esladim» → keyingi pog'ona, «Eslay olmadim» → 0 (+1 kun).
 *   Lug'atim — bugungi takror kartasi, Saqlanganlar, O'sish nuqtalari, Darslar lug'ati.
 *
 * Hamma so'rov faqat talaba YETIB KELGAN darslar va uning lug'at to'plami
 * (`vocab_visible`) bo'yicha.
 */
export const LEARN_RULES = {
  chunkSize: 10,
  /** shundan kam qoldiq oldingi bo'lakka qo'shiladi */
  chunkMinTail: 5,
  /** «O'sish nuqtalari» ga tushish uchun xatolar soni */
  growthMinWrong: 2,
  reviewDailyMax: 30,
  reviewNewMax: 10,
  /** Lenta ichida tez tekshiruv har shuncha kartadan keyin (ilova uchun) */
  quickCheckEvery: 6,
  /** O'zbekiston vaqti (UTC+5) — "bugun" chegarasi */
  tzOffsetMin: 300,
} as const;

const DAY_MS = 86_400_000;

/** Bo'laklar: [boshlanish, tugash) indekslari */
export function chunkRanges(total: number): { n: number; start: number; end: number }[] {
  const size = LEARN_RULES.chunkSize;
  if (total <= 0) return [];
  const full = Math.floor(total / size);
  const rem = total % size;
  const ranges: { n: number; start: number; end: number }[] = [];
  for (let i = 0; i < full; i++) ranges.push({ n: i + 1, start: i * size, end: (i + 1) * size });
  if (rem > 0) {
    if (rem >= LEARN_RULES.chunkMinTail || ranges.length === 0) {
      ranges.push({ n: ranges.length + 1, start: full * size, end: total });
    } else {
      ranges[ranges.length - 1].end = total;
    }
  }
  return ranges;
}

const STAGE_MODE: Record<number, PracticeMode> = { 1: 'audio', 2: 'typing', 3: 'typing' };

type ScopeKind =
  | { kind: 'chunk'; lessonId: string; n: number }
  | { kind: 'lessonGrowth'; lessonId: string }
  | { kind: 'growth' }
  | { kind: 'saved' };

function parseScope(scope: string): ScopeKind {
  if (scope === 'growth') return { kind: 'growth' };
  if (scope === 'saved') return { kind: 'saved' };
  const m = /^L:([0-9a-f-]{36}):(growth|\d{1,3})$/i.exec(scope ?? '');
  if (!m) throw new BadRequestException("scope noto'g'ri");
  if (m[2] === 'growth') return { kind: 'lessonGrowth', lessonId: m[1] };
  return { kind: 'chunk', lessonId: m[1], n: Number(m[2]) };
}

export interface LearnWord {
  pairId: string;
  word: string;
  translation: string;
  ipa: string | null;
  pos: string | null;
  imageUrl: string | null;
  voiceFileId: string | null;
  lessonId: string | null;
  /** dars ichidagi tartib (0 dan) */
  index: number;
  example: { englishText: string; uzbekText: string | null; highlightWord: string | null } | null;
  status: VocabStatus;
  seen: boolean;
  saved: boolean;
  commentsCount: number;
  attempts: number;
  wrongAttempts: number;
  srsStep: number;
  nextReviewAt: string | null;
}

@Injectable()
export class VocabularyLearnService {
  constructor(
    @InjectRepository(VocabularyRelation)
    private readonly pairRepo: Repository<VocabularyRelation>,
    @InjectRepository(VocabularyExample)
    private readonly exampleRepo: Repository<VocabularyExample>,
    @InjectRepository(UserVocabularyProgress)
    private readonly progressRepo: Repository<UserVocabularyProgress>,
    @InjectRepository(VocabularyPracticeLog)
    private readonly logRepo: Repository<VocabularyPracticeLog>,
    @InjectRepository(VocabularySaved)
    private readonly savedRepo: Repository<VocabularySaved>,
    @InjectRepository(VocabularyLentaState)
    private readonly lentaRepo: Repository<VocabularyLentaState>,
    @InjectRepository(VocabularyComment)
    private readonly commentRepo: Repository<VocabularyComment>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    private readonly lessonGating: LessonGatingService,
    private readonly xpService: XpService,
    private readonly coinTest: VocabularyCoinTestService,
  ) {}

  // ─── Dars lug'ati (A/B/C) ──────────────────────────────────────────────────

  /** Dars → Lug'at sahifasi: uch bo'lim holati */
  async getLessonHub(userId: string, lessonId: string) {
    const lesson = await this.assertLesson(userId, lessonId);
    const pairs = await this.loadPairs(userId, { lessonId });
    const pairIds = pairs.map((p) => p.id);
    const [progress, states, coin] = await Promise.all([
      this.progressMap(userId, pairIds),
      this.lentaRepo
        .createQueryBuilder('s')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.scope LIKE :prefix', { prefix: `L:${lessonId}:%` })
        .getMany(),
      this.coinTest.getStatus(userId, lessonId),
    ]);
    const stateMap = new Map(states.map((s) => [s.scope, s]));

    const chunks = chunkRanges(pairs.length).map((r) => {
      const st = stateMap.get(`L:${lessonId}:${r.n}`);
      const s = (st?.state ?? {}) as Record<string, unknown>;
      return {
        n: r.n,
        from: r.start + 1,
        to: r.end,
        total: r.end - r.start,
        status: st?.completedAt ? 'done' : st ? 'in_progress' : 'new',
        /** Tanishuvda ko'rilgan so'zlar soni (bo'lak qatoridagi yozuv uchun) */
        seen: pairs.slice(r.start, r.end).filter((p) => progress.get(p.id)?.seenAt).length,
        /** joriy pog'ona (1–3), ilova yozadi */
        stage: typeof s.stage === 'number' ? s.stage : null,
        /** to'g'ri / urinish foizi, ilova yozadi — «Qaytadan ishlash» da BARCHA aylanalar bo'yicha
         *  (ilova `base` + joriy aylana), shuning uchun qayta ishlash bilan o'zgaradi */
        percent: typeof s.percent === 'number' ? s.percent : null,
      };
    });
    const growth = pairs.filter((p) => this.isGrowth(progress.get(p.id)));
    const growthState = stateMap.get(`L:${lessonId}:growth`);

    const seen = pairIds.filter((id) => progress.get(id)?.seenAt).length;
    const learning = pairIds.filter((id) => progress.get(id)?.status === VocabStatus.learning).length;
    const mastered = pairIds.filter((id) => progress.get(id)?.status === VocabStatus.mastered).length;

    return {
      lesson: this.lessonInfo(lesson),
      totalWords: pairs.length,
      tanishuv: { seen, total: pairs.length },
      testlash: {
        chunks,
        done: chunks.filter((c) => c.status === 'done').length,
        learning,
        growth: {
          count: growth.length,
          status: growthState?.completedAt ? 'done' : growthState ? 'in_progress' : 'new',
        },
      },
      mustahkam: { mastered, total: pairs.length },
      coin,
    };
  }

  /** Dars so'zlari (tartibda) — shorts va lenta uchun */
  async getLessonWords(userId: string, lessonId: string) {
    const lesson = await this.assertLesson(userId, lessonId);
    const pairs = await this.loadPairs(userId, { lessonId });
    return { lesson: this.lessonInfo(lesson), words: await this.toWords(userId, pairs) };
  }

  /** Tanishuv: shorts kartasi ko'rildi */
  async markSeen(userId: string, pairIds: string[]) {
    const ids = [...new Set((pairIds ?? []).filter(Boolean))].slice(0, 200);
    if (!ids.length) return { updated: 0 };
    const pairs = await this.pairRepo.find({ where: { id: In(ids) }, select: { id: true } });
    const valid = pairs.map((p) => p.id);
    const existing = await this.progressMap(userId, valid);
    const now = new Date();
    const toSave: UserVocabularyProgress[] = [];
    for (const id of valid) {
      let p = existing.get(id);
      if (p?.seenAt) continue;
      if (!p) p = this.newProgress(userId, id);
      p.seenAt = now;
      toSave.push(p);
    }
    if (toSave.length) await this.progressRepo.save(toSave);
    return { updated: toSave.length };
  }

  // ─── Testlash lentasi ──────────────────────────────────────────────────────

  /** Lenta holati + shu lentaning so'zlari */
  async getLenta(userId: string, scope: string) {
    const parsed = parseScope(scope);
    const words = await this.scopeWords(userId, parsed);
    const st = await this.lentaRepo.findOne({ where: { userId, scope } });
    return {
      scope,
      state: st?.state ?? null,
      completedAt: st?.completedAt ? st.completedAt.toISOString() : null,
      words,
    };
  }

  /**
   * Lenta holatini saqlash. `answers` — oxirgi saqlashdan beri berilgan
   * javoblar (so'z holatlari shular bo'yicha yangilanadi), `done` — 3 pog'ona
   * tugadi, `clearedPairIds` — «O'sish nuqtalari» dan chiqqan so'zlar,
   * `reset` — bo'lakni qaytadan boshlash.
   */
  async saveLenta(
    userId: string,
    body: {
      scope: string;
      state?: Record<string, unknown> | null;
      answers?: { pairId: string; stage: number; correct: boolean }[];
      done?: boolean;
      reset?: boolean;
      clearedPairIds?: string[];
    },
  ) {
    const parsed = parseScope(body.scope);
    if (parsed.kind === 'chunk' || parsed.kind === 'lessonGrowth') await this.assertLesson(userId, parsed.lessonId);

    const now = new Date();
    let st = await this.lentaRepo.findOne({ where: { userId, scope: body.scope } });
    if (!st) st = this.lentaRepo.create({ userId, scope: body.scope, state: {}, completedAt: null });
    if (body.reset) {
      st.state = {};
      st.completedAt = null;
    }
    if (body.state && typeof body.state === 'object') {
      const json = JSON.stringify(body.state);
      if (json.length > 64_000) throw new BadRequestException('Lenta holati juda katta');
      st.state = body.state;
    }
    if (body.done) st.completedAt = now;
    await this.lentaRepo.save(st);

    const answers = (body.answers ?? []).filter((a) => a && a.pairId).slice(0, 300);
    const cleared = [...new Set(body.clearedPairIds ?? [])];
    const touchIds = [...new Set([...answers.map((a) => a.pairId), ...cleared])];
    if (touchIds.length) {
      const valid = new Set(
        (await this.pairRepo.find({ where: { id: In(touchIds) }, select: { id: true } })).map((p) => p.id),
      );
      const map = await this.progressMap(userId, [...valid]);
      const logs: VocabularyPracticeLog[] = [];
      for (const a of answers) {
        if (!valid.has(a.pairId)) continue;
        let p = map.get(a.pairId);
        if (!p) {
          p = this.newProgress(userId, a.pairId);
          map.set(a.pairId, p);
        }
        p.attempts += 1;
        if (!a.correct) {
          p.wrongAttempts += 1;
          p.growthCleared = false;
        }
        // Testlash coin bermaydi va «mustahkam» qilmaydi — faqat o'rganilmoqda
        if (p.status === VocabStatus.new) p.status = VocabStatus.learning;
        // SRS ga birinchi kirish: ertaga takror
        if (!p.nextReviewAt && (p.srsStep ?? 0) < SRS_LONG_TERM_STEP) p.nextReviewAt = srsNextReview(0, now);
        logs.push(this.logRepo.create({
          sessionId: null, pairId: a.pairId, mode: STAGE_MODE[a.stage] ?? 'typing', correct: !!a.correct,
        }));
      }
      for (const id of cleared) {
        const p = map.get(id);
        if (p && this.isGrowth(p)) p.growthCleared = true;
      }
      const pairStats = new Map<string, { a: number; w: number }>();
      for (const a of answers) {
        if (!valid.has(a.pairId)) continue;
        const v = pairStats.get(a.pairId) ?? { a: 0, w: 0 };
        v.a += 1;
        if (!a.correct) v.w += 1;
        pairStats.set(a.pairId, v);
      }
      await Promise.all([
        this.progressRepo.save([...map.values()]),
        logs.length ? this.logRepo.save(logs) : null,
        this.bumpPairStats(pairStats),
      ]);
      if (answers.length) await this.xpService.touchActivity(userId);
    }

    return { scope: st.scope, completedAt: st.completedAt ? st.completedAt.toISOString() : null };
  }

  /** «O'sish nuqtalari»: darsniki (lessonId bilan) yoki hamma yetib kelgan darslar */
  async getGrowth(userId: string, lessonId?: string) {
    if (lessonId) await this.assertLesson(userId, lessonId);
    const words = await this.scopeWords(userId, lessonId ? { kind: 'lessonGrowth', lessonId } : { kind: 'growth' });
    return { count: words.length, words };
  }

  // ─── Saqlangan so'zlar ─────────────────────────────────────────────────────

  async getSaved(userId: string) {
    const words = await this.scopeWords(userId, { kind: 'saved' });
    return { count: words.length, pairIds: words.map((w) => w.pairId), words };
  }

  async save(userId: string, pairId: string) {
    const pair = await this.pairRepo.findOne({ where: { id: pairId }, select: { id: true } });
    if (!pair) throw new NotFoundException("So'z topilmadi");
    await this.savedRepo
      .createQueryBuilder()
      .insert()
      .into(VocabularySaved)
      .values({ userId, pairId })
      .orIgnore()
      .execute();
    return { pairId, saved: true };
  }

  async unsave(userId: string, pairId: string) {
    await this.savedRepo.delete({ userId, pairId });
    return { pairId, saved: false };
  }

  /** Lug'at qidiruvi: yetib kelgan darslarning barcha so'zlari (dars bo'yicha) */
  async getAllWords(userId: string) {
    const pairs = await this.loadPairs(userId, {});
    const lessonIds = [...new Set(pairs.map((p) => p.vocabulary.lessonId).filter(Boolean))] as string[];
    const [lessons, words] = await Promise.all([
      lessonIds.length ? this.lessonRepo.find({ where: { id: In(lessonIds) }, relations: ['unit'] }) : Promise.resolve([] as Lesson[]),
      this.toWords(userId, pairs),
    ]);
    return {
      lessons: lessons.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map((l) => this.lessonInfo(l)),
      words,
    };
  }

  // ─── Darslar lug'ati ro'yxati ──────────────────────────────────────────────

  /** Yetib kelgan darslar: Tanishuv / Testlash / Mustahkam holati */
  async getLessonsProgress(userId: string) {
    const pairs = await this.loadPairs(userId, {});
    const byLesson = new Map<string, VocabularyRelation[]>();
    for (const p of pairs) {
      const id = p.vocabulary.lessonId;
      if (!id) continue;
      const list = byLesson.get(id) ?? [];
      list.push(p);
      byLesson.set(id, list);
    }
    const lessonIds = [...byLesson.keys()];
    if (!lessonIds.length) return { lessons: [] };
    const [lessons, progress, states, completed] = await Promise.all([
      this.lessonRepo.find({ where: { id: In(lessonIds) }, relations: ['unit'] }),
      this.progressMap(userId, pairs.map((p) => p.id)),
      this.lentaRepo
        .createQueryBuilder('s')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.completed_at IS NOT NULL')
        .andWhere("s.scope LIKE 'L:%'")
        .getMany(),
      this.lessonGating.getCompletedLessonIds(userId),
    ]);
    const doneScopes = new Set(states.map((s) => s.scope));
    const rows = lessons
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((l) => {
        const list = byLesson.get(l.id) ?? [];
        const chunks = chunkRanges(list.length);
        return {
          ...this.lessonInfo(l),
          current: !completed.has(l.id),
          total: list.length,
          seen: list.filter((p) => progress.get(p.id)?.seenAt).length,
          chunksDone: chunks.filter((c) => doneScopes.has(`L:${l.id}:${c.n}`)).length,
          chunksTotal: chunks.length,
          mastered: list.filter((p) => progress.get(p.id)?.status === VocabStatus.mastered).length,
        };
      });
    return { lessons: rows.reverse() };
  }

  // ─── Lenta (SRS takrori, «Lug'at» tabi) ────────────────────────────────────

  /** «Lug'atim» kartasi: bugun nechta qoldi */
  async getReviewSummary(userId: string) {
    const q = await this.buildReviewQueue(userId);
    return q.summary;
  }

  /** Bugungi lenta: kartalar tartibda + umumiy holat */
  async getReviewToday(userId: string) {
    const q = await this.buildReviewQueue(userId);
    const words = await this.toWords(userId, q.items.map((i) => i.pair));
    const lessonIds = [...new Set(q.items.map((i) => i.pair.vocabulary.lessonId).filter(Boolean))] as string[];
    const [lessons, counts] = await Promise.all([
      lessonIds.length
        ? this.lessonRepo.find({ where: { id: In(lessonIds) }, relations: ['unit'] })
        : Promise.resolve([] as Lesson[]),
      lessonIds.length ? this.lessonWordCounts(userId, lessonIds) : Promise.resolve(new Map<string, number>()),
    ]);
    const lessonMap = new Map<string, Lesson>(lessons.map((l) => [l.id, l] as [string, Lesson]));
    return {
      summary: q.summary,
      quickCheckEvery: LEARN_RULES.quickCheckEvery,
      items: words.map((w, i) => {
        const l = w.lessonId ? lessonMap.get(w.lessonId) : null;
        return {
          ...w,
          kind: q.items[i].kind,
          lesson: l ? { ...this.lessonInfo(l), totalWords: counts.get(l.id) ?? 0 } : null,
        };
      }),
    };
  }

  /** «Esladim» / «Eslay olmadim» */
  async answerReview(userId: string, pairId: string, remembered: boolean) {
    const pair = await this.pairRepo.findOne({ where: { id: pairId }, select: { id: true } });
    if (!pair) throw new NotFoundException("So'z topilmadi");
    const now = new Date();
    let p = await this.progressRepo.findOne({ where: { userId, pairId } });
    const wasNew = !p || (!p.lastReviewedAt && !p.nextReviewAt);
    if (!p) p = this.newProgress(userId, pairId);

    p.attempts += 1;
    if (remembered) {
      p.srsStep = Math.min((p.srsStep ?? 0) + 1, SRS_LONG_TERM_STEP);
    } else {
      p.wrongAttempts += 1;
      p.srsStep = 0;
      p.growthCleared = false;
    }
    p.nextReviewAt = srsNextReview(p.srsStep, now);
    p.lastReviewedAt = now;
    if (p.status === VocabStatus.new) p.status = VocabStatus.learning;
    await this.progressRepo.save(p);
    await this.logRepo.save(this.logRepo.create({ sessionId: null, pairId, mode: 'flashcard', correct: remembered }));
    await this.bumpPairStats(new Map([[pairId, { a: 1, w: remembered ? 0 : 1 }]]));

    if (wasNew) await this.bumpNewToday(userId, now);
    await this.xpService.touchActivity(userId);

    return {
      pairId,
      remembered,
      srsStep: p.srsStep,
      nextReviewAt: p.nextReviewAt ? p.nextReviewAt.toISOString() : null,
      summary: (await this.buildReviewQueue(userId)).summary,
    };
  }

  // ─── Shorts feed (2026-11, birlashtirilgan oqim) ────────────────────────

  /**
   * Shorts uchun sortlangan, paginatsiyali so'zlar.
   * Tartib: 1) SRS muddati kelgan (qiynalish % bo'yicha)
   *         2) Yangi so'zlar (dars tartibida)
   *         3) Muddati kelmagan (qiynalish % bo'yicha) — lenta tugamaydi
   */
  async getShortsFeed(userId: string, opts: { lessonId?: string; offset?: number; limit?: number }) {
    const limit = Math.min(Math.max(opts.limit ?? 15, 1), 50);
    const offset = Math.max(opts.offset ?? 0, 0);

    if (opts.lessonId) await this.assertLesson(userId, opts.lessonId);

    const now = new Date();
    const { tomorrowStart } = this.dayBounds(now);
    const reached = await this.reachedSql(userId);

    const baseQb = () => {
      const qb = this.pairRepo
        .createQueryBuilder('r')
        .innerJoinAndSelect('r.vocabulary', 'src')
        .innerJoinAndSelect('r.translation', 'trg')
        .leftJoin('src.lesson', 'les')
        .leftJoin(UserVocabularyProgress, 'p', 'p.pair_id = r.id AND p.user_id = :userId', { userId })
        .where('src.lang = :lang', { lang: 'en' })
        .andWhere('vocab_visible(:vsUser, src.lesson_id, src.set_no)', { vsUser: userId });
      if (opts.lessonId) qb.andWhere('src.lesson_id = :lessonId', { lessonId: opts.lessonId });
      if (reached) qb.andWhere(reached[0], reached[1]);
      return qb;
    };

    // Umumiy son
    const total = await baseQb().getCount();

    // Sortlash: 3 ta guruh birlashtiriladi
    // sort_group: 0 = SRS due/overdue, 1 = new, 2 = not yet due
    // difficulty = wrong_attempts / GREATEST(attempts, 1) DESC (qiyin → oldin)
    const qb = baseQb()
      .addSelect(
        `CASE
           WHEN p.next_review_at IS NOT NULL AND p.next_review_at < :tomorrow THEN 0
           WHEN p.id IS NULL OR (p.next_review_at IS NULL AND p.last_reviewed_at IS NULL AND p.srs_step = 0) THEN 1
           ELSE 2
         END`,
        'sort_group',
      )
      .setParameter('tomorrow', tomorrowStart)
      .addSelect(
        `COALESCE(p.wrong_attempts, 0)::float / GREATEST(COALESCE(p.attempts, 0), 1)`,
        'difficulty',
      )
      .orderBy('sort_group', 'ASC')
      .addOrderBy('difficulty', 'DESC')
      .addOrderBy('les.orderIndex', 'ASC')
      .addOrderBy('src.orderIndex', 'ASC')
      .offset(offset)
      .limit(limit);

    const pairs = await qb.getMany();
    const words = await this.toWords(userId, pairs);

    return {
      words,
      total,
      offset,
      limit,
      hasMore: offset + pairs.length < total,
    };
  }

  /**
   * Shorts ichidagi 3 pog'onali mashq natijalari.
   * - Dars ichida (`lessonId` berilsa): so'z `learning` ga o'tadi, SRS surilmaydi
   * - Lug'at tabida (`lessonId` null): SRS ham yangilanadi (1/3/7/30)
   */
  async submitShortsPractice(
    userId: string,
    body: {
      lessonId?: string | null;
      answers: { pairId: string; stage: number; correct: boolean }[];
    },
  ) {
    if (body.lessonId) await this.assertLesson(userId, body.lessonId);

    const answers = (body.answers ?? []).filter((a) => a && a.pairId).slice(0, 300);
    if (!answers.length) return { updated: 0 };

    const pairIds = [...new Set(answers.map((a) => a.pairId))];
    const valid = new Set(
      (await this.pairRepo.find({ where: { id: In(pairIds) }, select: { id: true } })).map((p) => p.id),
    );
    const map = await this.progressMap(userId, [...valid]);
    const logs: VocabularyPracticeLog[] = [];
    const now = new Date();
    const isNavbar = !body.lessonId;

    // Navbar rejimida yangi SRS kiruvchi so'zlarni hisobga olish uchun oldingi holat
    const wasNewMap = new Map<string, boolean>();
    for (const id of valid) {
      const p = map.get(id);
      wasNewMap.set(id, !p || (!p.lastReviewedAt && !p.nextReviewAt));
    }

    // Har so'z uchun: yakuniy natija (hamma pog'onani o'tdi yoki yo'q)
    const pairResults = new Map<string, { correct: number; total: number }>();
    for (const a of answers) {
      if (!valid.has(a.pairId)) continue;
      const r = pairResults.get(a.pairId) ?? { correct: 0, total: 0 };
      r.total += 1;
      if (a.correct) r.correct += 1;
      pairResults.set(a.pairId, r);
    }

    for (const a of answers) {
      if (!valid.has(a.pairId)) continue;
      let p = map.get(a.pairId);
      if (!p) {
        p = this.newProgress(userId, a.pairId);
        map.set(a.pairId, p);
      }
      p.attempts += 1;
      if (!a.correct) {
        p.wrongAttempts += 1;
        p.growthCleared = false;
      }
      if (p.status === VocabStatus.new) p.status = VocabStatus.learning;
      logs.push(this.logRepo.create({
        sessionId: null, pairId: a.pairId, mode: STAGE_MODE[a.stage] ?? 'typing', correct: !!a.correct,
      }));
    }

    // Navbar rejimida: mashq tugagach SRS yangilanadi
    if (isNavbar) {
      for (const [pairId, result] of pairResults) {
        const p = map.get(pairId);
        if (!p) continue;
        const allCorrect = result.correct === result.total;
        if (allCorrect) {
          p.srsStep = Math.min((p.srsStep ?? 0) + 1, SRS_LONG_TERM_STEP);
        } else {
          p.srsStep = 0;
        }
        p.nextReviewAt = srsNextReview(p.srsStep, now);
        p.lastReviewedAt = now;
      }
    } else {
      // Dars ichida: faqat birinchi SRS kirish
      for (const [pairId] of pairResults) {
        const p = map.get(pairId);
        if (p && !p.nextReviewAt && (p.srsStep ?? 0) < SRS_LONG_TERM_STEP) {
          p.nextReviewAt = srsNextReview(0, now);
        }
      }
    }

    const pairStats = new Map<string, { a: number; w: number }>();
    for (const a of answers) {
      if (!valid.has(a.pairId)) continue;
      const v = pairStats.get(a.pairId) ?? { a: 0, w: 0 };
      v.a += 1;
      if (!a.correct) v.w += 1;
      pairStats.set(a.pairId, v);
    }

    await Promise.all([
      this.progressRepo.save([...map.values()]),
      logs.length ? this.logRepo.save(logs) : null,
      this.bumpPairStats(pairStats),
    ]);
    if (answers.length) await this.xpService.touchActivity(userId);

    if (isNavbar) {
      const newlyAdded = [...pairResults.keys()].filter((id) => wasNewMap.get(id)).length;
      if (newlyAdded > 0) await this.bumpNewToday(userId, now, newlyAdded);
    }

    return { updated: pairResults.size };
  }

  // ─── Ichki ────────────────────────────────────────────────────────────────

  private dayBounds(now = new Date()) {
    const off = LEARN_RULES.tzOffsetMin * 60_000;
    const todayStart = new Date(Math.floor((now.getTime() + off) / DAY_MS) * DAY_MS - off);
    const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
    const dayKey = new Date(todayStart.getTime() + off).toISOString().slice(0, 10);
    return { todayStart, tomorrowStart, dayAfter: new Date(tomorrowStart.getTime() + DAY_MS), dayKey };
  }

  /** Bugun nechta YANGI so'z lentaga kirgan (kuniga ≤10) */
  private async newToday(userId: string, dayKey: string): Promise<number> {
    const st = await this.lentaRepo.findOne({ where: { userId, scope: 'review' } });
    const s = (st?.state ?? {}) as { day?: string; newDone?: number };
    return s.day === dayKey ? Number(s.newDone ?? 0) : 0;
  }

  private async bumpNewToday(userId: string, now: Date, count = 1) {
    const { dayKey } = this.dayBounds(now);
    let st = await this.lentaRepo.findOne({ where: { userId, scope: 'review' } });
    if (!st) st = this.lentaRepo.create({ userId, scope: 'review', state: {}, completedAt: null });
    const s = (st.state ?? {}) as { day?: string; newDone?: number };
    st.state = { day: dayKey, newDone: (s.day === dayKey ? Number(s.newDone ?? 0) : 0) + count };
    await this.lentaRepo.save(st);
  }

  /** SRS navbati: kechikkan → bugungi → yangi; kunlik limit yo'q */
  private async buildReviewQueue(userId: string) {
    const now = new Date();
    const { todayStart, tomorrowStart, dayAfter, dayKey } = this.dayBounds(now);
    const reached = await this.reachedSql(userId);

    const progressQb = () => {
      const qb = this.progressRepo
        .createQueryBuilder('p')
        .innerJoin(VocabularyRelation, 'r', 'r.id = p.pair_id')
        .innerJoin('r.vocabulary', 'src')
        .where('p.user_id = :userId', { userId })
        .andWhere('src.lang = :lang', { lang: 'en' })
        .andWhere('vocab_visible(:vsUser, src.lesson_id, src.set_no)', { vsUser: userId });
      if (reached) qb.andWhere(reached[0], reached[1]);
      return qb;
    };

    const [due, doneToday, tomorrow, newDone, memoryRows] = await Promise.all([
      progressQb()
        .andWhere('p.next_review_at IS NOT NULL')
        .andWhere('p.next_review_at < :tomorrowStart', { tomorrowStart })
        .andWhere('p.srs_step < :lt', { lt: SRS_LONG_TERM_STEP })
        .orderBy('p.srs_step', 'ASC')
        .addOrderBy('p.nextReviewAt', 'ASC', 'NULLS FIRST')
        .select(['p.id', 'p.pairId', 'p.nextReviewAt'])
        .getMany(),
      progressQb().andWhere('p.last_reviewed_at >= :todayStart', { todayStart }).getCount(),
      progressQb()
        .andWhere('p.next_review_at >= :tomorrowStart AND p.next_review_at < :dayAfter', { tomorrowStart, dayAfter })
        .getCount(),
      this.newToday(userId, dayKey),
      // «So'zlaringiz xotirada»: SRS ga kirgan so'zlar pog'ona bo'yicha
      progressQb()
        .andWhere('(p.next_review_at IS NOT NULL OR p.srs_step > 0)')
        .select('p.srs_step', 'step')
        .addSelect('COUNT(*)::int', 'cnt')
        .groupBy('p.srs_step')
        .getRawMany<{ step: number; cnt: number }>(),
    ]);
    const memory = [0, 0, 0, 0, 0];
    for (const r of memoryRows) memory[Math.min(4, Math.max(0, Number(r.step)))] += Number(r.cnt);

    const tomorrowReturning = await progressQb()
      .andWhere('p.last_reviewed_at >= :todayStart', { todayStart })
      .andWhere('p.srs_step = 0')
      .getCount();
    const newLeft = Math.max(0, LEARN_RULES.reviewNewMax - newDone);

    // Yangi so'zlar: hali SRS ga kirmagan (takrorlanmagan, sanasi yo'q), mustahkam emas.
    // Avval Tanishuvda ko'rilganlari, keyin dars tartibida.
    const newQb = this.pairRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.vocabulary', 'src')
      .innerJoinAndSelect('r.translation', 'trg')
      .leftJoin('src.lesson', 'les')
      .leftJoin(UserVocabularyProgress, 'p', 'p.pair_id = r.id AND p.user_id = :userId', { userId })
      .where('src.lang = :lang', { lang: 'en' })
      .andWhere('vocab_visible(:vsUser, src.lesson_id, src.set_no)', { vsUser: userId })
      .andWhere(
        "(p.id IS NULL OR (p.next_review_at IS NULL AND p.last_reviewed_at IS NULL AND p.srs_step = 0 AND p.status <> 'mastered'))",
      )
      .addSelect('CASE WHEN p.seen_at IS NULL THEN 1 ELSE 0 END', 'seen_rank')
      .orderBy('seen_rank', 'ASC')
      .addOrderBy('les.orderIndex', 'ASC')
      .addOrderBy('src.orderIndex', 'ASC');
    if (reached) newQb.andWhere(reached[0], reached[1]);
    const [newAvailable, newPairs] = await Promise.all([
      newQb.clone().getCount(),
      newLeft > 0 ? newQb.limit(newLeft).getMany() : Promise.resolve([] as VocabularyRelation[]),
    ]);

    const overdue = due.filter((d) => d.nextReviewAt && d.nextReviewAt < todayStart);
    const dueToday = due.filter((d) => d.nextReviewAt && d.nextReviewAt >= todayStart && d.nextReviewAt < tomorrowStart);
    const dueIds = due.map((d) => d.pairId);
    const duePairs = dueIds.length
      ? await this.pairRepo.find({ where: { id: In(dueIds) }, relations: ['vocabulary', 'translation'] })
      : [];
    const dueMap = new Map(duePairs.map((p) => [p.id, p]));
    const overdueSet = new Set(overdue.map((d) => d.pairId));

    const items: { pair: VocabularyRelation; kind: 'overdue' | 'due' | 'new' }[] = [];
    for (const id of dueIds) {
      const pair = dueMap.get(id);
      if (pair) items.push({ pair, kind: overdueSet.has(id) ? 'overdue' : 'due' });
    }
    for (const pair of newPairs) {
      items.push({ pair, kind: 'new' });
    }

    const dailyBudget = Math.max(0, LEARN_RULES.reviewDailyMax - doneToday);
    const cappedItems = items.slice(0, dailyBudget);
    const remaining = cappedItems.length;
    const newCount = cappedItems.filter((i) => i.kind === 'new').length;
    return {
      items: cappedItems,
      summary: {
        remaining,
        done: doneToday,
        total: doneToday + remaining,
        overdue: Math.min(overdue.length, remaining),
        dueToday: Math.min(dueToday.length, Math.max(0, remaining - Math.min(overdue.length, remaining))),
        new: newCount,
        newAvailable,
        tomorrow: tomorrow + Math.min(LEARN_RULES.reviewNewMax, Math.max(0, newAvailable - newCount)),
        /** taxminiy vaqt (~10 s karta) */
        minutes: Math.ceil((remaining * 10) / 60),
        dailyMax: LEARN_RULES.reviewDailyMax,
        newMax: LEARN_RULES.reviewNewMax,
        /** pog'ona bo'yicha so'zlar: [1-kun, 3-kun, 7-kun, 30-kun, uzoq xotira] */
        memory,
        /** ertangi lentada qaytadigan (bugun «Eslay olmadim») so'zlar */
        tomorrowReturning: tomorrowReturning,
      },
    };
  }

  /** Lenta so'zlari (scope bo'yicha) */
  private async scopeWords(userId: string, scope: ScopeKind): Promise<LearnWord[]> {
    if (scope.kind === 'chunk') {
      await this.assertLesson(userId, scope.lessonId);
      const pairs = await this.loadPairs(userId, { lessonId: scope.lessonId });
      const range = chunkRanges(pairs.length).find((r) => r.n === scope.n);
      if (!range) throw new NotFoundException("Bo'lak topilmadi");
      return this.toWords(userId, pairs, range.start, range.end);
    }
    if (scope.kind === 'saved') {
      const saved = await this.savedRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
      if (!saved.length) return [];
      const pairs = await this.loadPairs(userId, { pairIds: saved.map((s) => s.pairId) });
      const order = new Map(saved.map((s, i) => [s.pairId, i]));
      pairs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return this.toWords(userId, pairs);
    }
    // O'sish nuqtalari
    const pairs = await this.loadPairs(userId, scope.kind === 'lessonGrowth' ? { lessonId: scope.lessonId } : {});
    const progress = await this.progressMap(userId, pairs.map((p) => p.id));
    return this.toWords(userId, pairs.filter((p) => this.isGrowth(progress.get(p.id))));
  }

  /**
   * Juftlik statistikasi (o'qituvchi panelidagi «Urinish» / «Qiyinlik»):
   * lenta va takror javoblari ham hisoblanadi, faqat coinli sinov emas.
   */
  private async bumpPairStats(stats: Map<string, { a: number; w: number }>) {
    for (const [pairId, v] of stats) {
      if (!v.a) continue;
      await this.pairRepo.query(
        `UPDATE vocabulary_relations
            SET attempts = attempts + $2,
                wrong_attempts = wrong_attempts + $3,
                difficulty = (wrong_attempts + $3)::float / GREATEST(attempts + $2, 1)
          WHERE id = $1`,
        [pairId, v.a, v.w],
      );
    }
  }

  private isGrowth(p: UserVocabularyProgress | undefined): boolean {
    return !!p
      && p.wrongAttempts >= LEARN_RULES.growthMinWrong
      && p.status !== VocabStatus.mastered
      && !p.growthCleared;
  }

  /** Juftliklar: yetib kelgan darslar + o'quvchining lug'at to'plami, dars va so'z tartibida */
  private async loadPairs(
    userId: string,
    f: { lessonId?: string; pairIds?: string[] },
  ): Promise<VocabularyRelation[]> {
    const qb: SelectQueryBuilder<VocabularyRelation> = this.pairRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.vocabulary', 'src')
      .innerJoinAndSelect('r.translation', 'trg')
      .leftJoin('src.lesson', 'les')
      .where('src.lang = :lang', { lang: 'en' })
      .andWhere('vocab_visible(:vsUser, src.lesson_id, src.set_no)', { vsUser: userId });
    if (f.lessonId) qb.andWhere('src.lesson_id = :lessonId', { lessonId: f.lessonId });
    if (f.pairIds) {
      if (!f.pairIds.length) return [];
      qb.andWhere('r.id IN (:...pairIds)', { pairIds: f.pairIds });
    }
    const reached = await this.reachedSql(userId);
    if (reached) qb.andWhere(reached[0], reached[1]);
    return qb.orderBy('les.orderIndex', 'ASC').addOrderBy('src.orderIndex', 'ASC').getMany();
  }

  private async reachedSql(userId: string): Promise<[string, Record<string, unknown>] | null> {
    const reached = await this.lessonGating.getReachedLessonIds(userId);
    if (!reached) return null;
    if (!reached.size) return ['1 = 0', {}];
    return ['src.lesson_id IN (:...reachedLessonIds)', { reachedLessonIds: [...reached] }];
  }

  /** Dars mavjud va talaba unga yetib kelgan */
  private async assertLesson(userId: string, lessonId: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const reached = await this.lessonGating.getReachedLessonIds(userId);
    if (reached && !reached.has(lessonId)) {
      throw new ForbiddenException({ code: 'LESSON_LOCKED', message: 'Bu dars hali ochilmagan' });
    }
    return lesson;
  }

  private lessonInfo(l: Lesson) {
    return {
      id: l.id,
      name: l.lessonName,
      orderIndex: l.orderIndex,
      unit: l.unit ? { number: l.unit.number, title: l.unit.title } : null,
    };
  }

  private async lessonWordCounts(userId: string, lessonIds: string[]): Promise<Map<string, number>> {
    const rows = await this.pairRepo
      .createQueryBuilder('r')
      .innerJoin('r.vocabulary', 'src')
      .select('src.lesson_id', 'lessonId')
      .addSelect('COUNT(*)::int', 'cnt')
      .where('src.lesson_id IN (:...lessonIds)', { lessonIds })
      .andWhere('src.lang = :lang', { lang: 'en' })
      .andWhere('vocab_visible(:vsUser, src.lesson_id, src.set_no)', { vsUser: userId })
      .groupBy('src.lesson_id')
      .getRawMany<{ lessonId: string; cnt: number }>();
    return new Map(rows.map((r) => [r.lessonId, Number(r.cnt)]));
  }

  private async progressMap(userId: string, pairIds: string[]): Promise<Map<string, UserVocabularyProgress>> {
    if (!pairIds.length) return new Map();
    const list = await this.progressRepo.find({ where: { userId, pairId: In(pairIds) } });
    return new Map(list.map((p) => [p.pairId, p]));
  }

  private newProgress(userId: string, pairId: string): UserVocabularyProgress {
    return this.progressRepo.create({
      userId, pairId, status: VocabStatus.new, attempts: 0, wrongAttempts: 0, srsStep: 0,
      seenAt: null, lastReviewedAt: null, growthCleared: false, nextReviewAt: null,
    });
  }

  /** Juftliklarni ilova uchun so'z kartasiga aylantiradi (misol, holat, saqlangan, izohlar soni) */
  private async toWords(userId: string, pairs: VocabularyRelation[], start = 0, end?: number): Promise<LearnWord[]> {
    // dars ichidagi tartib raqami (bo'lak kesilishidan oldin)
    const indexInLesson = new Map<string, number>();
    const perLesson = new Map<string, number>();
    for (const p of pairs) {
      const key = p.vocabulary.lessonId ?? '-';
      const i = perLesson.get(key) ?? 0;
      indexInLesson.set(p.id, i);
      perLesson.set(key, i + 1);
    }
    const list = pairs.slice(start, end ?? pairs.length);
    if (!list.length) return [];
    const ids = list.map((p) => p.id);
    const keys = [...new Set(list.map((p) => commentKey(p.vocabulary.word)))];
    const [examples, progress, saved, comments, globalStats] = await Promise.all([
      this.exampleRepo.find({ where: { pairId: In(ids) }, order: { orderIndex: 'ASC' } }),
      this.progressMap(userId, ids),
      this.savedRepo.find({ where: { userId, pairId: In(ids) }, select: { pairId: true } }),
      this.commentRepo
        .createQueryBuilder('c')
        .select('c.word_key', 'key')
        .addSelect('COUNT(*)::int', 'cnt')
        .where('c.word_key IN (:...keys)', { keys })
        .andWhere('c.status = :st', { st: 'active' })
        .groupBy('c.word_key')
        .getRawMany<{ key: string; cnt: number }>(),
      this.progressRepo
        .createQueryBuilder('p')
        .innerJoin('p.user', 'u')
        .select('p.pair_id', 'pairId')
        .addSelect('SUM(p.attempts)', 'attempts')
        .addSelect('SUM(p.wrong_attempts)', 'wrongAttempts')
        .where('p.pair_id IN (:...ids)', { ids })
        .andWhere('u.role = :role', { role: 'student' })
        .groupBy('p.pair_id')
        .getRawMany<{ pairId: string; attempts: string; wrongAttempts: string }>(),
    ]);
    const exMap = new Map<string, VocabularyExample>();
    for (const e of examples) if (!exMap.has(e.pairId)) exMap.set(e.pairId, e);
    const savedSet = new Set(saved.map((s) => s.pairId));
    const commentMap = new Map(comments.map((c) => [c.key, Number(c.cnt)]));
    const globalStatsMap = new Map(
      globalStats.map((stats) => [
        stats.pairId,
        { attempts: Number(stats.attempts), wrongAttempts: Number(stats.wrongAttempts) },
      ]),
    );

    return list.map((p) => {
      const pr = progress.get(p.id);
      const ex = exMap.get(p.id);
      const aggregate = globalStatsMap.get(p.id);
      return {
        pairId: p.id,
        word: p.vocabulary.word,
        translation: p.translation.word,
        ipa: p.vocabulary.ipa ?? null,
        pos: p.vocabulary.pos ?? null,
        imageUrl: p.vocabulary.imageUrl ?? null,
        voiceFileId: p.vocabulary.voiceFileId ?? null,
        lessonId: p.vocabulary.lessonId ?? null,
        index: indexInLesson.get(p.id) ?? 0,
        example: ex ? { englishText: ex.englishText, uzbekText: ex.uzbekText ?? null, highlightWord: ex.highlightWord ?? null } : null,
        status: pr?.status ?? VocabStatus.new,
        seen: !!pr?.seenAt,
        saved: savedSet.has(p.id),
        commentsCount: commentMap.get(commentKey(p.vocabulary.word)) ?? 0,
        attempts: pr?.attempts ?? 0,
        wrongAttempts: pr?.wrongAttempts ?? 0,
        srsStep: pr?.srsStep ?? 0,
        nextReviewAt: pr?.nextReviewAt ? new Date(pr.nextReviewAt).toISOString() : null,
        globalAttempts: aggregate?.attempts ?? 0,
        globalWrongAttempts: aggregate?.wrongAttempts ?? 0,
      };
    });
  }
}

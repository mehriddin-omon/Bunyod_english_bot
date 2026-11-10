import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { Phrase, PhraseStatus } from 'src/common/core/entitys/phrase.entity';
import { PhraseLike } from 'src/common/core/entitys/phrase-like.entity';
import { PhraseComment } from 'src/common/core/entitys/phrase-comment.entity';
import { PhraseCommentLike } from 'src/common/core/entitys/phrase-comment-like.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { CreatePhraseDto, UpdatePhraseDto } from './dto';

/** Lentada bir martada nechta ibora qaytadi */
const FEED_LIMIT = 20;
/** Bir ibora ostida bir martada nechta izoh qaytadi */
const COMMENTS_PAGE = 20;
/** Shuncha xabar kelsa izoh avtomatik yashiriladi */
const AUTO_HIDE_REPORTS = 3;

export const PHRASE_RULES = {
  bodyMin: 2,
  bodyMax: 300,
  /** Bitta o'quvchi bitta iboraga shuncha izoh yozadi */
  perPhraseLimit: 2,
};

export interface PhraseCommentView {
  id: string;
  body: string;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  authorName: string;
  initials: string;
  createdAt: Date;
}

export interface PhraseView {
  id: string;
  text: string;
  transcription: string | null;
  meaningUz: string;
  examples: { en: string; uz: string }[];
  imageUrl: string | null;
  videoUrl: string | null;
  videoDurationSec: number | null;
  publishAt: Date;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  /** Kartada ko'rinadigan bitta izoh: eng ko'p like, teng bo'lsa eng avval yozilgani */
  topComment: PhraseCommentView | null;
}

@Injectable()
export class PhrasesService {
  private readonly logger = new Logger(PhrasesService.name);

  constructor(
    @InjectRepository(Phrase) private readonly phraseRepo: Repository<Phrase>,
    @InjectRepository(PhraseLike) private readonly likeRepo: Repository<PhraseLike>,
    @InjectRepository(PhraseComment) private readonly commentRepo: Repository<PhraseComment>,
    @InjectRepository(PhraseCommentLike)
    private readonly commentLikeRepo: Repository<PhraseCommentLike>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // ─── Yordamchilar ──────────────────────────────────────────────────────────

  /** Mehmon faqat O'QIYDI: like/izoh uchun akkaunt saqlanishi kerak */
  private async requireAccount(userId: string, what: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.isGuest) throw new ForbiddenException(`${what} uchun avval akkauntni saqlang`);
    return user;
  }

  private authorName(u?: User | null): string {
    if (!u) return 'Talaba';
    const first = (u.firstName ?? '').trim();
    const last = (u.lastName ?? '').trim();
    if (first && last) return `${first} ${last[0].toUpperCase()}.`;
    return first || last || u.username;
  }

  private initials(u?: User | null): string {
    if (!u) return 'T';
    const a = (u.firstName ?? u.username ?? '').trim()[0] ?? '';
    const b = (u.lastName ?? '').trim()[0] ?? '';
    return (a + b).toUpperCase() || 'T';
  }

  private validateBody(raw: string): string {
    const body = (raw ?? '').trim().replace(/\s+\n/g, '\n');
    if (body.length < PHRASE_RULES.bodyMin) throw new BadRequestException('Izoh juda qisqa');
    if (body.length > PHRASE_RULES.bodyMax) {
      throw new BadRequestException(`Izoh ${PHRASE_RULES.bodyMax} belgidan oshmasin`);
    }
    if (/(https?:\/\/|www\.|t\.me\/|\.(com|uz|ru|org)\b|@\w{3,})/i.test(body)) {
      throw new BadRequestException("Izohda havola yoki @nom bo'lmasin");
    }
    return body;
  }

  private commentView(
    c: PhraseComment,
    users: Map<string, User>,
    likedIds: Set<string>,
    viewerId: string,
  ): PhraseCommentView {
    const u = users.get(c.userId);
    return {
      id: c.id,
      body: c.body,
      likeCount: c.likeCount,
      likedByMe: likedIds.has(c.id),
      mine: c.userId === viewerId,
      authorName: c.userId === viewerId ? 'Siz' : this.authorName(u),
      initials: this.initials(u),
      createdAt: c.createdAt,
    };
  }

  private async loadUsers(ids: string[]): Promise<Map<string, User>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const users = await this.userRepo.find({ where: { id: In(unique) } });
    return new Map(users.map((u) => [u.id, u]));
  }

  /** Har ibora uchun eng ko'p like olgan izoh (teng bo'lsa eng avval yozilgani) */
  private async topComments(phraseIds: string[]): Promise<Map<string, PhraseComment>> {
    const map = new Map<string, PhraseComment>();
    if (!phraseIds.length) return map;
    const rows = await this.commentRepo
      .createQueryBuilder('c')
      .where('c.phrase_id IN (:...ids)', { ids: phraseIds })
      .andWhere("c.status = 'active'")
      .orderBy('c.phrase_id', 'ASC')
      .addOrderBy('c.like_count', 'DESC')
      .addOrderBy('c.created_at', 'ASC')
      .getMany();
    for (const row of rows) {
      if (!map.has(row.phraseId)) map.set(row.phraseId, row);
    }
    return map;
  }

  private async likedPhraseIds(userId: string, phraseIds: string[]): Promise<Set<string>> {
    if (!phraseIds.length) return new Set();
    const rows = await this.likeRepo.find({
      where: { userId, phraseId: In(phraseIds) },
      select: ['phraseId'],
    });
    return new Set(rows.map((r) => r.phraseId));
  }

  private async likedCommentIds(userId: string, commentIds: string[]): Promise<Set<string>> {
    if (!commentIds.length) return new Set();
    const rows = await this.commentLikeRepo.find({
      where: { userId, commentId: In(commentIds) },
      select: ['commentId'],
    });
    return new Set(rows.map((r) => r.commentId));
  }

  // ─── O'quvchi: lenta ───────────────────────────────────────────────────────

  /**
   * GET /phrases/feed — eng oxirgi ibora BIRINCHI o'rinda.
   * `publishAt` kelmagan va draft/archived iboralar chiqmaydi.
   */
  async feed(userId: string, limit = FEED_LIMIT): Promise<{ phrases: PhraseView[] }> {
    const phrases = await this.phraseRepo.find({
      where: { status: 'published', publishAt: LessThanOrEqual(new Date()) },
      order: { publishAt: 'DESC', createdAt: 'DESC' },
      take: Math.min(Math.max(Number(limit) || FEED_LIMIT, 1), 50),
    });
    if (!phrases.length) return { phrases: [] };

    const ids = phrases.map((p) => p.id);
    const [liked, tops] = await Promise.all([
      this.likedPhraseIds(userId, ids),
      this.topComments(ids),
    ]);
    const topList = [...tops.values()];
    const [users, likedComments] = await Promise.all([
      this.loadUsers(topList.map((c) => c.userId)),
      this.likedCommentIds(userId, topList.map((c) => c.id)),
    ]);

    return {
      phrases: phrases.map((p) => {
        const top = tops.get(p.id);
        return {
          id: p.id,
          text: p.text,
          transcription: p.transcription,
          meaningUz: p.meaningUz,
          examples: p.examples ?? [],
          imageUrl: p.imageUrl,
          videoUrl: p.videoUrl,
          videoDurationSec: p.videoDurationSec,
          publishAt: p.publishAt,
          likeCount: p.likeCount,
          likedByMe: liked.has(p.id),
          commentCount: p.commentCount,
          topComment: top ? this.commentView(top, users, likedComments, userId) : null,
        };
      }),
    };
  }

  /** GET /phrases/:id — to'liq ekran uchun (izohlar alohida so'rov bilan) */
  async detail(userId: string, id: string): Promise<PhraseView> {
    const phrase = await this.phraseRepo.findOne({ where: { id } });
    if (!phrase || phrase.status !== 'published') throw new NotFoundException('Ibora topilmadi');
    const [liked, tops] = await Promise.all([
      this.likedPhraseIds(userId, [id]),
      this.topComments([id]),
    ]);
    const top = tops.get(id);
    const [users, likedComments] = await Promise.all([
      this.loadUsers(top ? [top.userId] : []),
      this.likedCommentIds(userId, top ? [top.id] : []),
    ]);
    return {
      id: phrase.id,
      text: phrase.text,
      transcription: phrase.transcription,
      meaningUz: phrase.meaningUz,
      examples: phrase.examples ?? [],
      imageUrl: phrase.imageUrl,
      videoUrl: phrase.videoUrl,
      videoDurationSec: phrase.videoDurationSec,
      publishAt: phrase.publishAt,
      likeCount: phrase.likeCount,
      likedByMe: liked.has(id),
      commentCount: phrase.commentCount,
      topComment: top ? this.commentView(top, users, likedComments, userId) : null,
    };
  }

  // ─── O'quvchi: ibora like'i ────────────────────────────────────────────────

  private async recountPhraseLikes(phraseId: string): Promise<number> {
    const likeCount = await this.likeRepo.count({ where: { phraseId } });
    await this.phraseRepo.update({ id: phraseId }, { likeCount });
    return likeCount;
  }

  async like(userId: string, phraseId: string): Promise<{ likeCount: number; likedByMe: boolean }> {
    await this.requireAccount(userId, 'Like bosish');
    const phrase = await this.phraseRepo.findOne({ where: { id: phraseId } });
    if (!phrase) throw new NotFoundException('Ibora topilmadi');
    const exists = await this.likeRepo.findOne({ where: { phraseId, userId } });
    if (!exists) {
      try {
        await this.likeRepo.save(this.likeRepo.create({ phraseId, userId }));
      } catch (e) {
        // (phrase_id, user_id) UNIQUE — ikki marta bosilgani xato emas
        this.logger.debug(`like takrori: ${phraseId}`);
      }
    }
    return { likeCount: await this.recountPhraseLikes(phraseId), likedByMe: true };
  }

  async unlike(userId: string, phraseId: string): Promise<{ likeCount: number; likedByMe: boolean }> {
    await this.requireAccount(userId, 'Like olish');
    await this.likeRepo.delete({ phraseId, userId });
    return { likeCount: await this.recountPhraseLikes(phraseId), likedByMe: false };
  }

  // ─── O'quvchi: izohlar ─────────────────────────────────────────────────────

  private async recountComments(phraseId: string): Promise<number> {
    const commentCount = await this.commentRepo.count({ where: { phraseId, status: 'active' } });
    await this.phraseRepo.update({ id: phraseId }, { commentCount });
    return commentCount;
  }

  /**
   * GET /phrases/:id/comments?sort=top|new
   * `top` — like kamayish bo'yicha, teng bo'lsa eng avval yozilgani (kartadagi tartib).
   */
  async comments(
    userId: string,
    phraseId: string,
    opts: { sort?: string; offset?: number } = {},
  ): Promise<{ comments: PhraseCommentView[]; total: number }> {
    const phrase = await this.phraseRepo.findOne({ where: { id: phraseId } });
    if (!phrase) throw new NotFoundException('Ibora topilmadi');

    const qb = this.commentRepo
      .createQueryBuilder('c')
      .where('c.phrase_id = :phraseId', { phraseId })
      .andWhere("c.status = 'active'");

    if (opts.sort === 'new') {
      qb.orderBy('c.created_at', 'DESC');
    } else {
      qb.orderBy('c.like_count', 'DESC').addOrderBy('c.created_at', 'ASC');
    }

    const offset = Math.max(Number(opts.offset) || 0, 0);
    const [rows, total] = await qb.skip(offset).take(COMMENTS_PAGE).getManyAndCount();
    const [users, liked] = await Promise.all([
      this.loadUsers(rows.map((r) => r.userId)),
      this.likedCommentIds(userId, rows.map((r) => r.id)),
    ]);
    return {
      comments: rows.map((c) => this.commentView(c, users, liked, userId)),
      total,
    };
  }

  /** POST /phrases/:id/comments — «Siz bu iborani qay holatda ishlatgansiz?» javobi */
  async createComment(
    userId: string,
    phraseId: string,
    rawBody: string,
  ): Promise<PhraseCommentView> {
    const user = await this.requireAccount(userId, 'Izoh yozish');
    const phrase = await this.phraseRepo.findOne({ where: { id: phraseId } });
    if (!phrase || phrase.status !== 'published') throw new NotFoundException('Ibora topilmadi');

    const mine = await this.commentRepo.count({ where: { phraseId, userId, status: 'active' } });
    if (mine >= PHRASE_RULES.perPhraseLimit) {
      throw new BadRequestException(
        `Bitta iboraga ${PHRASE_RULES.perPhraseLimit} tagacha izoh yoziladi`,
      );
    }

    const body = this.validateBody(rawBody);
    const saved = await this.commentRepo.save(
      this.commentRepo.create({ phraseId, userId, body, status: 'active' }),
    );
    await this.recountComments(phraseId);
    return this.commentView(saved, new Map([[userId, user]]), new Set(), userId);
  }

  async updateComment(userId: string, commentId: string, rawBody: string): Promise<PhraseCommentView> {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Izoh topilmadi');
    if (comment.userId !== userId) throw new ForbiddenException('Bu izoh sizga tegishli emas');
    comment.body = this.validateBody(rawBody);
    const saved = await this.commentRepo.save(comment);
    const users = await this.loadUsers([userId]);
    const liked = await this.likedCommentIds(userId, [commentId]);
    return this.commentView(saved, users, liked, userId);
  }

  async removeComment(userId: string, commentId: string): Promise<{ ok: true }> {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Izoh topilmadi');
    if (comment.userId !== userId) throw new ForbiddenException('Bu izoh sizga tegishli emas');
    await this.commentRepo.delete({ id: commentId });
    await this.recountComments(comment.phraseId);
    return { ok: true };
  }

  // ─── O'quvchi: izoh like'i (ibora like'idan ALOHIDA) ───────────────────────

  private async recountCommentLikes(commentId: string): Promise<number> {
    const likeCount = await this.commentLikeRepo.count({ where: { commentId } });
    await this.commentRepo.update({ id: commentId }, { likeCount });
    return likeCount;
  }

  async likeComment(
    userId: string,
    commentId: string,
  ): Promise<{ likeCount: number; likedByMe: boolean }> {
    await this.requireAccount(userId, 'Like bosish');
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Izoh topilmadi');
    // O'z izohiga like bosilmaydi (dizaynda tugma o'rnida sanoq turadi)
    if (comment.userId === userId) throw new BadRequestException("O'z izohingizga like bosilmaydi");
    const exists = await this.commentLikeRepo.findOne({ where: { commentId, userId } });
    if (!exists) {
      try {
        await this.commentLikeRepo.save(this.commentLikeRepo.create({ commentId, userId }));
      } catch {
        this.logger.debug(`izoh like takrori: ${commentId}`);
      }
    }
    return { likeCount: await this.recountCommentLikes(commentId), likedByMe: true };
  }

  async unlikeComment(
    userId: string,
    commentId: string,
  ): Promise<{ likeCount: number; likedByMe: boolean }> {
    await this.requireAccount(userId, 'Like olish');
    await this.commentLikeRepo.delete({ commentId, userId });
    return { likeCount: await this.recountCommentLikes(commentId), likedByMe: false };
  }

  /** POST /phrases/comments/:id/report — 3 ta xabardan keyin avtomatik yashiriladi */
  async reportComment(userId: string, commentId: string): Promise<{ ok: true }> {
    await this.requireAccount(userId, 'Xabar berish');
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Izoh topilmadi');
    comment.reportCount += 1;
    if (comment.reportCount >= AUTO_HIDE_REPORTS) comment.status = 'hidden';
    await this.commentRepo.save(comment);
    if (comment.status === 'hidden') await this.recountComments(comment.phraseId);
    return { ok: true };
  }

  // ─── Teacher / admin: iboralarni boshqarish ────────────────────────────────

  /** GET /teacher/phrases — hamma ibora (draft'lar ham), yangi birinchi */
  async teacherList(status?: string): Promise<{ phrases: (PhraseView & { status: PhraseStatus; authorName: string | null })[] }> {
    const where = status && status !== 'all' ? { status: status as PhraseStatus } : {};
    const phrases = await this.phraseRepo.find({
      where,
      relations: { author: true },
      order: { publishAt: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
    return {
      phrases: phrases.map((p) => ({
        id: p.id,
        text: p.text,
        transcription: p.transcription,
        meaningUz: p.meaningUz,
        examples: p.examples ?? [],
        imageUrl: p.imageUrl,
        videoUrl: p.videoUrl,
        videoDurationSec: p.videoDurationSec,
        publishAt: p.publishAt,
        likeCount: p.likeCount,
        likedByMe: false,
        commentCount: p.commentCount,
        topComment: null,
        status: p.status,
        authorName: p.author ? this.authorName(p.author) : null,
      })),
    };
  }

  async create(userId: string, dto: CreatePhraseDto): Promise<Phrase> {
    const text = (dto.text ?? '').trim();
    const meaningUz = (dto.meaningUz ?? '').trim();
    if (!text) throw new BadRequestException('Ibora matni kerak');
    if (!meaningUz) throw new BadRequestException("O'zbekcha ma'no kerak");
    return this.phraseRepo.save(
      this.phraseRepo.create({
        text,
        meaningUz,
        transcription: dto.transcription?.trim() || null,
        examples: (dto.examples ?? []).filter((e) => e?.en?.trim()),
        imageUrl: dto.imageUrl || null,
        videoUrl: dto.videoUrl || null,
        videoDurationSec: dto.videoDurationSec ?? null,
        status: dto.status ?? 'published',
        publishAt: dto.publishAt ? new Date(dto.publishAt) : new Date(),
        createdBy: userId,
      }),
    );
  }

  async update(id: string, dto: UpdatePhraseDto): Promise<Phrase> {
    const phrase = await this.phraseRepo.findOne({ where: { id } });
    if (!phrase) throw new NotFoundException('Ibora topilmadi');
    if (dto.text !== undefined) phrase.text = dto.text.trim();
    if (dto.meaningUz !== undefined) phrase.meaningUz = dto.meaningUz.trim();
    if (dto.transcription !== undefined) phrase.transcription = dto.transcription?.trim() || null;
    if (dto.examples !== undefined) phrase.examples = dto.examples.filter((e) => e?.en?.trim());
    if (dto.imageUrl !== undefined) phrase.imageUrl = dto.imageUrl || null;
    if (dto.videoUrl !== undefined) phrase.videoUrl = dto.videoUrl || null;
    if (dto.videoDurationSec !== undefined) phrase.videoDurationSec = dto.videoDurationSec ?? null;
    if (dto.status !== undefined) phrase.status = dto.status;
    if (dto.publishAt !== undefined) phrase.publishAt = new Date(dto.publishAt);
    return this.phraseRepo.save(phrase);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const phrase = await this.phraseRepo.findOne({ where: { id } });
    if (!phrase) throw new NotFoundException('Ibora topilmadi');
    await this.phraseRepo.delete({ id });
    return { ok: true };
  }

  /** GET /teacher/phrases/:id/comments — moderatsiya uchun (yashirilganlari bilan) */
  async teacherComments(
    phraseId: string,
  ): Promise<{ comments: (PhraseCommentView & { status: string; reportCount: number })[] }> {
    const rows = await this.commentRepo.find({
      where: { phraseId },
      order: { likeCount: 'DESC', createdAt: 'ASC' },
      take: 200,
    });
    const users = await this.loadUsers(rows.map((r) => r.userId));
    return {
      comments: rows.map((c) => ({
        ...this.commentView(c, users, new Set(), ''),
        status: c.status,
        reportCount: c.reportCount,
      })),
    };
  }

  /** PUT /teacher/phrases/comments/:id/status — yashirish / qaytarish */
  async setCommentStatus(commentId: string, status: 'active' | 'hidden'): Promise<{ ok: true }> {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Izoh topilmadi');
    comment.status = status;
    if (status === 'active') comment.reportCount = 0;
    await this.commentRepo.save(comment);
    await this.recountComments(comment.phraseId);
    return { ok: true };
  }
}

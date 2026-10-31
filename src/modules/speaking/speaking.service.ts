import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { join, resolve, sep } from 'path';
import * as fs from 'fs';
import {
  SpeakingItem,
  SpeakingStatus,
  SpeakingSubmission,
} from 'src/common/core/entitys/speaking-submission.entity';
import { NotificationType, Role, XpSource } from 'src/common/utils/enum';
import { XpService } from '../gamification/xp.service';
import { LessonScoreService } from 'src/common/services/lesson-score.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GradeSpeakingDto, SubmitSpeakingPayload } from './dto/speaking.dto';

interface Viewer {
  sub: string;
  role: string;
}

/** 3+ ball olgan savol = 1 coin (har savol uchun bir marta) */
const COIN_MIN_SCORE = 3;
const MAX_ITEMS = 20;

export const SPEAKING_UPLOAD_DIR = 'speaking';

const isAdmin = (v: Viewer) => v.role === Role.admin || v.role === Role.superAdmin;

/**
 * Teacher qaysi o'quvchining ishini ko'radi: o'zi o'qitadigan guruhdagilar va hech qaysi guruhda
 * bo'lmaganlar (mehmonlar, hali guruhlanmaganlar). Admin — hammasi. `$1` — viewer id, `$2` — admin.
 */
const VISIBLE_SQL = (userCol: string) => `(
  $2::boolean
  OR EXISTS (SELECT 1 FROM group_members m JOIN groups g ON g.id = m.group_id
              WHERE m.user_id = ${userCol} AND g.teacher_id = $1)
  OR NOT EXISTS (SELECT 1 FROM group_members m WHERE m.user_id = ${userCol})
)`;

/** /uploads/speaking/<fayl> → diskdagi yo'l (faqat uploads/ ichida) */
function removeUpload(url: string | null | undefined) {
  if (!url) return;
  try {
    const root = resolve(join(process.cwd(), 'uploads'));
    const path = resolve(join(process.cwd(), url.replace(/^https?:\/\/[^/]+/, '')));
    if (!path.startsWith(root + sep)) return;
    if (fs.existsSync(path)) fs.unlinkSync(path);
  } catch {
    // eski faylni o'chirib bo'lmasa — jarayon to'xtamaydi
  }
}

const str = (v: unknown, max: number): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

/**
 * SPEAKING ishlari: o'quvchi javobni yozadi → ovoz bilan aytadi → teacher baholaydi.
 * Kontent (savollar) ilovada (`ilova/src/content/speaking`) — server faqat ishni saqlaydi.
 */
@Injectable()
export class SpeakingService {
  private readonly logger = new Logger(SpeakingService.name);

  constructor(
    @InjectRepository(SpeakingSubmission) private readonly repo: Repository<SpeakingSubmission>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly xp: XpService,
    private readonly lessonScore: LessonScoreService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── O'quvchi ───────────────────────────────────────────────────────────

  /** GET /speaking/lessons/:lessonId — mening ishim (yo'q bo'lsa null) */
  async mine(userId: string, lessonId: string) {
    const s = await this.repo.findOne({ where: { userId, lessonId } });
    return s ? this.studentView(s) : null;
  }

  /** O'quvchi bahoni ko'rdi */
  async markSeen(userId: string, lessonId: string) {
    await this.repo.update({ userId, lessonId, status: SpeakingStatus.graded }, { seenAt: new Date() });
    return { ok: true };
  }

  /** multipart `payload` maydonini tekshiradi */
  parsePayload(raw: unknown): SubmitSpeakingPayload {
    let p: any;
    try {
      p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      throw new BadRequestException("payload JSON emas");
    }
    if (!p || typeof p !== 'object') throw new BadRequestException('payload kerak');
    const taskKey = str(p.taskKey, 60);
    if (!taskKey || !/^lesson\d+:speaking$/.test(taskKey)) throw new BadRequestException("taskKey noto'g'ri");
    if (!Array.isArray(p.items) || !p.items.length || p.items.length > MAX_ITEMS) {
      throw new BadRequestException("items noto'g'ri");
    }
    const seen = new Set<number>();
    const items = p.items.map((it: any) => {
      const no = Number(it?.no);
      if (!Number.isInteger(no) || no < 1 || no > 30 || seen.has(no)) throw new BadRequestException("Savol raqami noto'g'ri");
      seen.add(no);
      const q = str(it.q, 500);
      if (!q) throw new BadRequestException('Savol matni kerak');
      const dur = Number(it.durationSec);
      return {
        no,
        q,
        written: str(it.written, 3000),
        durationSec: Number.isFinite(dur) && dur > 0 ? Math.min(600, Math.round(dur)) : null,
        peeked: !!it.peeked,
        retakes: Math.max(0, Math.min(99, Number(it.retakes) || 0)),
      };
    });
    return {
      taskKey,
      title: str(p.title, 200),
      kind: p.kind === 'monologue' ? 'monologue' : 'questions',
      items,
    };
  }

  /**
   * POST /speaking/lessons/:lessonId — ishni topshirish. Faqat yangi yozilgan savollar uchun fayl
   * keladi (`audio_<no>`): birinchi topshirishda HAMMA savol, qayta topshirishda — qayta aytilganlari.
   * Qayta aytilgan savol bahosi tozalanadi va ish yana o'qituvchi navbatiga tushadi.
   */
  async submit(userId: string, lessonId: string, rawPayload: unknown, files: Express.Multer.File[]) {
    const fileByNo = new Map<number, Express.Multer.File>();
    for (const f of files ?? []) {
      const m = /^audio_(\d+)$/.exec(f.fieldname);
      if (m) fileByNo.set(Number(m[1]), f);
      else removeUpload(this.urlOf(f));
    }
    const cleanup = () => fileByNo.forEach((f) => removeUpload(this.urlOf(f)));

    try {
      const payload = this.parsePayload(rawPayload);
      const [lesson] = await this.ds.query(`SELECT id FROM lessons WHERE id = $1`, [lessonId]);
      if (!lesson) throw new NotFoundException('Dars topilmadi');

      const existing = await this.repo.findOne({ where: { userId, lessonId } });
      const oldByNo = new Map<number, SpeakingItem>((existing?.items ?? []).map((i) => [i.no, i]));
      const wasGraded = existing?.status === SpeakingStatus.graded;

      const items: SpeakingItem[] = payload.items.map((p) => {
        const file = fileByNo.get(p.no);
        const old = oldByNo.get(p.no);
        if (!file) {
          if (!old?.audioUrl) throw new BadRequestException(`${p.no}-savolning ovoz yozuvi yo'q`);
          return old; // o'zgarmagan savol — bahosi bilan qoladi
        }
        if (old?.audioUrl) removeUpload(old.audioUrl);
        return {
          no: p.no,
          q: p.q,
          written: p.written ?? null,
          audioUrl: this.urlOf(file),
          durationSec: p.durationSec ?? null,
          peeked: !!p.peeked,
          retakes: p.retakes ?? 0,
          score: null,
          tags: [],
          fixes: [],
          resubmitted: wasGraded || old?.score != null,
        };
      });
      // Ilovadan olib tashlangan savollar — fayli o'chiriladi
      for (const [no, old] of oldByNo) {
        if (!items.some((i) => i.no === no)) removeUpload(old.audioUrl);
      }
      items.sort((a, b) => a.no - b.no);

      const changed = items.some((i) => fileByNo.has(i.no));
      if (!changed && existing) return this.studentView(existing);

      const now = new Date();
      const row = existing ?? this.repo.create({ userId, lessonId, coins: 0 });
      row.taskKey = payload.taskKey;
      row.title = payload.title ?? null;
      row.kind = payload.kind ?? 'questions';
      row.items = items;
      row.status = SpeakingStatus.pending;
      row.submittedAt = now;
      const saved = await this.repo.save(row);
      return this.studentView(saved);
    } catch (e) {
      cleanup();
      throw e;
    }
  }

  private urlOf(f: Express.Multer.File) {
    return `/uploads/${SPEAKING_UPLOAD_DIR}/${f.filename}`;
  }

  private async studentView(s: SpeakingSubmission) {
    let teacherName: string | null = null;
    if (s.gradedBy) {
      const [t] = await this.ds.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [s.gradedBy]);
      teacherName = t ? [t.first_name, t.last_name].filter(Boolean).join(' ') || null : null;
    }
    const graded = s.status === SpeakingStatus.graded;
    return {
      id: s.id,
      lessonId: s.lessonId,
      taskKey: s.taskKey,
      status: s.status,
      submittedAt: s.submittedAt,
      gradedAt: s.gradedAt,
      // Qayta topshirilgan ishda eski baho ko'rinib turadi (yangi savollar baholanmaguncha)
      percent: s.percent,
      coins: s.coins,
      comment: graded || s.gradedAt ? s.comment : null,
      commentAudioUrl: graded || s.gradedAt ? s.commentAudioUrl : null,
      teacherName,
      seen: !!s.seenAt && (!s.gradedAt || s.seenAt >= s.gradedAt),
      items: s.items.map((i) => ({
        no: i.no,
        q: i.q,
        written: i.written,
        audioUrl: i.audioUrl,
        durationSec: i.durationSec,
        score: i.score,
        fixes: i.fixes ?? [],
        resubmitted: !!i.resubmitted,
      })),
    };
  }

  // ── Teacher ────────────────────────────────────────────────────────────

  private async assertVisible(viewer: Viewer, studentId: string) {
    const [ok] = await this.ds.query(`SELECT 1 FROM users u WHERE u.id = $3 AND ${VISIBLE_SQL('u.id')}`, [
      viewer.sub,
      isAdmin(viewer),
      studentId,
    ]);
    if (!ok) throw new ForbiddenException("Bu o'quvchi sizning guruhingizda emas");
  }

  /**
   * GET /teacher/speaking?status=pending|graded&search=&page= — ishlar ro'yxati.
   * Navbat (pending) — eng eskisi birinchi; baholanganlar — eng so'nggisi birinchi.
   */
  async list(viewer: Viewer, q: { status?: string; search?: string; page?: number; limit?: number }) {
    const status = q.status === 'graded' ? SpeakingStatus.graded : SpeakingStatus.pending;
    const limit = Math.min(100, Math.max(5, Number(q.limit) || 30));
    const page = Math.max(1, Number(q.page) || 1);
    const search = q.search?.trim() || null;
    // $1 viewer, $2 admin, $3 qidiruv — ikkala so'rovda bir xil; ro'yxatda $4 holat, $5/$6 sahifa
    const base: unknown[] = [viewer.sub, isAdmin(viewer), search ? `%${search}%` : null];
    const where = `${VISIBLE_SQL('s.user_id')}
      AND ($3::text IS NULL OR u.first_name ILIKE $3 OR u.last_name ILIKE $3 OR u.username ILIKE $3
           OR (u.is_guest AND RIGHT(u.id::text, 6) ILIKE $3) OR l.lesson_name ILIKE $3)`;

    const [rows, counts] = await Promise.all([
      this.ds.query(
        `SELECT s.id, s.status, s.percent, s.coins, s.title, s.kind, s.submitted_at, s.graded_at,
                s.items, s.lesson_id, l.lesson_name, l.order_index, un.number AS unit_number,
                u.id AS user_id, u.first_name, u.last_name, u.username, u.avatar_url, u.is_guest,
                (SELECT string_agg(g.name, ', ' ORDER BY g.name)
                   FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = u.id) AS group_names
           FROM speaking_submissions s
           JOIN users u ON u.id = s.user_id
           JOIN lessons l ON l.id = s.lesson_id
           LEFT JOIN units un ON un.id = l.unit_id
          WHERE s.status = $4 AND ${where}
          ORDER BY ${status === SpeakingStatus.pending ? 's.submitted_at ASC' : 's.graded_at DESC NULLS LAST'}
          LIMIT $5 OFFSET $6`,
        [...base, status, limit, (page - 1) * limit],
      ),
      this.ds.query(
        `SELECT s.status, count(*)::int AS n
           FROM speaking_submissions s
           JOIN users u ON u.id = s.user_id
           JOIN lessons l ON l.id = s.lesson_id
          WHERE ${where}
          GROUP BY s.status`,
        base,
      ),
    ]);

    const countOf = (st: string) => Number(counts.find((c: any) => c.status === st)?.n ?? 0);
    return {
      counts: { pending: countOf(SpeakingStatus.pending), graded: countOf(SpeakingStatus.graded) },
      page,
      limit,
      items: rows.map((r: any) => this.rowView(r)),
    };
  }

  private rowView(r: any) {
    const items: SpeakingItem[] = Array.isArray(r.items) ? r.items : [];
    return {
      id: r.id,
      status: r.status,
      percent: r.percent,
      coins: r.coins,
      title: r.title,
      kind: r.kind,
      submittedAt: r.submitted_at,
      gradedAt: r.graded_at,
      student: {
        id: r.user_id,
        firstName: r.first_name,
        lastName: r.last_name,
        username: r.username,
        avatarUrl: r.avatar_url,
        isGuest: !!r.is_guest,
        guestCode: r.is_guest ? String(r.user_id).slice(-6) : null,
        groups: r.group_names ?? null,
      },
      lesson: {
        id: r.lesson_id,
        code: r.unit_number != null ? `${r.unit_number}.${r.order_index}` : `${r.order_index}`,
        title: r.lesson_name,
      },
      itemsCount: items.length,
      gradedCount: items.filter((i) => i.score != null).length,
      totalSec: items.reduce((a, i) => a + (Number(i.durationSec) || 0), 0),
      resubmitted: items.some((i) => i.resubmitted && i.score == null),
    };
  }

  private async loadRow(where: string, params: unknown[]) {
    const [r] = await this.ds.query(
      `SELECT s.*, l.lesson_name, l.order_index, un.number AS unit_number,
              u.id AS user_id, u.first_name, u.last_name, u.username, u.avatar_url, u.is_guest,
              (SELECT string_agg(g.name, ', ' ORDER BY g.name)
                 FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = u.id) AS group_names,
              (SELECT concat_ws(' ', t.first_name, t.last_name) FROM users t WHERE t.id = s.graded_by) AS grader_name
         FROM speaking_submissions s
         JOIN users u ON u.id = s.user_id
         JOIN lessons l ON l.id = s.lesson_id
         LEFT JOIN units un ON un.id = l.unit_id
        WHERE ${where}`,
      params,
    );
    return r ?? null;
  }

  private detailView(r: any) {
    const items: SpeakingItem[] = Array.isArray(r.items) ? r.items : [];
    return {
      ...this.rowView(r),
      comment: r.comment,
      commentAudioUrl: r.comment_audio_url,
      graderName: r.grader_name || null,
      items: items.map((i) => ({
        no: i.no,
        q: i.q,
        written: i.written,
        audioUrl: i.audioUrl,
        durationSec: i.durationSec,
        peeked: !!i.peeked,
        retakes: i.retakes ?? 0,
        score: i.score,
        tags: i.tags ?? [],
        fixes: i.fixes ?? [],
        resubmitted: !!i.resubmitted,
      })),
    };
  }

  /** GET /teacher/speaking/:id */
  async detail(viewer: Viewer, id: string) {
    const r = await this.loadRow(`s.id = $1`, [id]);
    if (!r) throw new NotFoundException('Ish topilmadi');
    await this.assertVisible(viewer, r.user_id);
    return this.detailView(r);
  }

  /** GET /teacher/speaking/students/:studentId/lessons/:lessonId — o'quvchi sahifasidagi mavzu sheet'i uchun */
  async byStudentLesson(viewer: Viewer, studentId: string, lessonId: string) {
    await this.assertVisible(viewer, studentId);
    const r = await this.loadRow(`s.user_id = $1 AND s.lesson_id = $2`, [studentId, lessonId]);
    return r ? this.detailView(r) : null;
  }

  /**
   * PUT /teacher/speaking/:id/grade — ballar, teglar, tuzatishlar, izoh.
   * `final` — hamma savol baholangan bo'lishi shart: foiz → `lesson_progress.speaking_score`,
   * coin (3+ ball olgan har savol = 1, bir marta), o'quvchiga bildirishnoma.
   */
  async grade(viewer: Viewer, id: string, dto: GradeSpeakingDto) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Ish topilmadi');
    await this.assertVisible(viewer, s.userId);

    const byNo = new Map(dto.items.map((i) => [i.no, i]));
    s.items = s.items.map((it) => {
      const g = byNo.get(it.no);
      if (!g) return it;
      return {
        ...it,
        score: g.score ?? null,
        tags: (g.tags ?? []).map((t) => t.trim()).filter(Boolean),
        fixes: (g.fixes ?? [])
          .map((f) => ({ wrong: f.wrong.trim(), right: f.right.trim() }))
          .filter((f) => f.wrong || f.right),
      };
    });
    if (dto.comment !== undefined) s.comment = dto.comment?.trim() || null;

    if (!dto.final) {
      await this.repo.save(s);
      return this.detail(viewer, id);
    }

    if (s.items.some((i) => i.score == null)) {
      throw new BadRequestException('Hamma savolga ball qo\'ying');
    }
    const mean = s.items.reduce((a, i) => a + Number(i.score), 0) / s.items.length;
    const firstGrade = !s.gradedAt;
    s.percent = Math.round((mean / 5) * 100);
    s.status = SpeakingStatus.graded;
    s.gradedAt = new Date();
    s.gradedBy = viewer.sub;
    s.seenAt = null;
    s.items = s.items.map((i) => ({ ...i, resubmitted: false }));

    // Coin — har savol uchun bir marta (qayta baholashda takrorlanmaydi)
    let coins = 0;
    for (const it of s.items) {
      if (Number(it.score) < COIN_MIN_SCORE) continue;
      coins += await this.xp
        .award({
          userId: s.userId,
          amount: 1,
          source: XpSource.speaking,
          referenceId: s.lessonId,
          referenceKey: `speaking:${s.id}:${it.no}`,
        })
        .catch(() => 0);
    }
    s.coins = (s.coins ?? 0) + coins;
    await this.repo.save(s);

    await this.saveLessonScore(s.userId, s.lessonId, s.percent);
    await this.notifyStudent(s, viewer.sub, firstGrade).catch((e) =>
      this.logger.warn(`Speaking bildirishnomasi yuborilmadi: ${(e as Error).message}`),
    );
    return this.detail(viewer, id);
  }

  /** `lesson_progress.speaking_score` → dars balli qayta hisoblanadi (yozuv bo'lmasa ochiladi) */
  private async saveLessonScore(userId: string, lessonId: string, percent: number) {
    try {
      await this.ds.query(
        `INSERT INTO lesson_progress (user_id, lesson_id, status, speaking_score, attempts, time_spent_sec)
         VALUES ($1, $2, 'in_progress', $3, 1, 0)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET speaking_score = EXCLUDED.speaking_score, updated_at = now()`,
        [userId, lessonId, percent],
      );
      await this.lessonScore.refresh(userId, lessonId);
    } catch (e) {
      this.logger.warn(`Speaking balli yozilmadi (${userId}, ${lessonId}): ${(e as Error).message}`);
    }
  }

  private async notifyStudent(s: SpeakingSubmission, teacherId: string, firstGrade: boolean) {
    const [l] = await this.ds.query(
      `SELECT l.lesson_name, l.order_index, un.number AS unit_number
         FROM lessons l LEFT JOIN units un ON un.id = l.unit_id WHERE l.id = $1`,
      [s.lessonId],
    );
    const label = l ? `${l.unit_number != null ? `${l.unit_number}.${l.order_index}` : l.order_index}-dars · ${l.lesson_name}` : null;
    await this.notifications.notify([s.userId], {
      type: NotificationType.teacher_message,
      title: firstGrade ? 'Speaking baholandi' : 'Speaking qayta baholandi',
      body: `${label ? `${label}: ` : ''}${s.percent}%${s.comment ? ` — «${s.comment.slice(0, 120)}»` : ''}`,
      senderId: teacherId,
      action: { type: 'lesson', id: s.lessonId, label },
      referenceId: s.id,
      referenceType: 'speaking',
      channel: 'teacher',
      preference: 'teacherMessages',
    });
  }

  /** POST /teacher/speaking/:id/voice — o'qituvchining ovozli izohi (eski fayl o'chiriladi) */
  async setVoice(viewer: Viewer, id: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    const s = await this.repo.findOne({ where: { id } });
    if (!s) {
      removeUpload(this.urlOf(file));
      throw new NotFoundException('Ish topilmadi');
    }
    try {
      await this.assertVisible(viewer, s.userId);
    } catch (e) {
      removeUpload(this.urlOf(file));
      throw e;
    }
    removeUpload(s.commentAudioUrl);
    s.commentAudioUrl = this.urlOf(file);
    await this.repo.save(s);
    return this.detail(viewer, id);
  }

  /** DELETE /teacher/speaking/:id/voice */
  async removeVoice(viewer: Viewer, id: string) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Ish topilmadi');
    await this.assertVisible(viewer, s.userId);
    removeUpload(s.commentAudioUrl);
    s.commentAudioUrl = null;
    await this.repo.save(s);
    return this.detail(viewer, id);
  }
}

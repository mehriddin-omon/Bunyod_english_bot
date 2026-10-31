import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Readable } from 'stream';
import {
  OnlineLesson,
  OnlineLessonAttendance,
  OnlineLessonRecording,
  OnlineLessonStatus,
  RecordingStatus,
  RecordingVisibility,
} from 'src/common/core/entitys/online-lesson.entity';
import { NotificationType } from 'src/common/utils/enum';
import { tashkentTime, tashkentWhen } from 'src/common/utils/tashkent-time';
import { NotificationsService } from '../notifications/notifications.service';
import { OnlineLessonsService } from './online-lessons.service';
import { RecordingStorageService } from './recording-storage.service';
import { ZoomClient, ZoomRecordingFile } from './zoom.client';

/** Asosiy MP4 — ekran + so'zlovchi ko'rinishi afzal */
const RECORDING_PRIORITY = [
  'shared_screen_with_speaker_view',
  'shared_screen_with_speaker_view(CC)',
  'shared_screen_with_gallery_view',
  'speaker_view',
  'active_speaker',
  'gallery_view',
  'shared_screen',
];
const MAX_COPY_ATTEMPTS = 3;

function normName(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Onlayn darslarning fon ishlari (2026-11):
 *  - Zoom webhook hodisalari (boshlandi, tugadi, qatnashchi kirdi/chiqdi, yozuv tayyor)
 *  - yozuvni Zoom'dan omborga ko'chirish va Zoom'dan o'chirish
 *  - har daqiqada: eslatmalar, unutilgan darslarni yopish, xato yozuvlarni qayta urinish
 */
@Injectable()
export class OnlineLessonsJobs implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OnlineLessonsJobs.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private readonly copying = new Set<string>();

  constructor(
    @InjectRepository(OnlineLesson) private readonly lessonRepo: Repository<OnlineLesson>,
    @InjectRepository(OnlineLessonAttendance) private readonly attRepo: Repository<OnlineLessonAttendance>,
    @InjectRepository(OnlineLessonRecording) private readonly recordingRepo: Repository<OnlineLessonRecording>,
    private readonly lessons: OnlineLessonsService,
    private readonly notifications: NotificationsService,
    private readonly zoom: ZoomClient,
    private readonly storage: RecordingStorageService,
    private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

  async handleEvent(event: string, payload: any) {
    const obj = payload?.object ?? {};
    const meetingId = obj.id !== undefined && obj.id !== null ? String(obj.id) : null;
    if (!meetingId) return;
    const lesson = await this.lessonRepo.findOne({ where: { zoomMeetingId: meetingId } });
    if (!lesson) return;

    switch (event) {
      case 'meeting.started':
        return this.onStarted(lesson, obj);
      case 'meeting.ended':
        return this.onEnded(lesson, obj);
      case 'meeting.participant_joined':
        return this.onJoined(lesson, obj);
      case 'meeting.participant_left':
        return this.onLeft(lesson, obj);
      case 'recording.completed':
        return this.onRecordingCompleted(lesson, obj);
      default:
        return;
    }
  }

  private async onStarted(lesson: OnlineLesson, obj: any) {
    if (lesson.status === OnlineLessonStatus.cancelled) return;
    lesson.status = OnlineLessonStatus.live;
    lesson.startedAt = obj.start_time ? new Date(obj.start_time) : new Date();
    if (obj.uuid) lesson.zoomUuid = obj.uuid;
    lesson.endedAt = null;
    await this.lessonRepo.save(lesson);
    await this.lessons.sendStartedReminder(lesson);
  }

  private async onEnded(lesson: OnlineLesson, obj: any) {
    if (lesson.status === OnlineLessonStatus.cancelled) return;
    lesson.status = OnlineLessonStatus.ended;
    lesson.endedAt = obj.end_time ? new Date(obj.end_time) : new Date();
    if (obj.uuid) lesson.zoomUuid = obj.uuid;
    await this.lessonRepo.save(lesson);
    // Ochiq qolgan kirishlarni yopamiz
    await this.ds.query(
      `UPDATE online_lesson_attendance
          SET leave_time = $2,
              duration_sec = GREATEST(0, EXTRACT(EPOCH FROM ($2::timestamptz - join_time))::int)
        WHERE lesson_id = $1 AND leave_time IS NULL`,
      [lesson.id, lesson.endedAt],
    );
    await this.syncGroupAttendance(lesson).catch((e) =>
      this.logger.warn(`Guruh davomatiga yozilmadi (${lesson.id}): ${(e as Error).message}`),
    );
    if (lesson.settings?.record) {
      const existing = await this.recordingRepo.findOne({ where: { lessonId: lesson.id } });
      if (!existing) {
        await this.recordingRepo.save(
          this.recordingRepo.create({ lessonId: lesson.id, zoomUuid: lesson.zoomUuid, status: RecordingStatus.zoom_processing }),
        );
      }
    }
  }

  private async onJoined(lesson: OnlineLesson, obj: any) {
    const p = obj.participant ?? {};
    // Host (o'qituvchi) davomatga yozilmaydi
    if (p.id && obj.host_id && p.id === obj.host_id) return;
    const name: string = p.user_name ?? p.name ?? 'Noma\'lum';
    const userId = await this.matchUser(lesson.id, name);
    await this.attRepo.save(
      this.attRepo.create({
        lessonId: lesson.id,
        userId,
        displayName: name.slice(0, 200),
        participantKey: p.participant_uuid ?? p.user_id ?? p.id ?? null,
        joinTime: p.join_time ? new Date(p.join_time) : new Date(),
        leaveTime: null,
        durationSec: 0,
      }),
    );
  }

  private async onLeft(lesson: OnlineLesson, obj: any) {
    const p = obj.participant ?? {};
    const key = p.participant_uuid ?? p.user_id ?? p.id ?? null;
    const name: string = p.user_name ?? p.name ?? '';
    const leave = p.leave_time ? new Date(p.leave_time) : new Date();
    const rows: { id: string; join_time: Date }[] = await this.ds.query(
      `SELECT id, join_time FROM online_lesson_attendance
        WHERE lesson_id = $1 AND leave_time IS NULL
          AND (${key ? 'participant_key = $2' : 'display_name = $2'})
        ORDER BY join_time DESC LIMIT 1`,
      [lesson.id, key ?? name],
    );
    const row = rows[0];
    if (!row) return;
    const sec = Math.max(0, Math.round((leave.getTime() - new Date(row.join_time).getTime()) / 1000));
    await this.attRepo.update({ id: row.id }, { leaveTime: leave, durationSec: sec });
  }

  private async onRecordingCompleted(lesson: OnlineLesson, obj: any) {
    let rec = await this.recordingRepo.findOne({ where: { lessonId: lesson.id } });
    if (!rec) {
      rec = this.recordingRepo.create({ lessonId: lesson.id, status: RecordingStatus.zoom_processing });
    }
    if (rec.status === RecordingStatus.ready) return;
    rec.zoomUuid = obj.uuid ?? rec.zoomUuid ?? lesson.zoomUuid;
    const file = pickPrimary(obj.recording_files ?? []);
    if (file) {
      rec.zoomFileId = file.id;
      rec.sizeBytes = String(file.file_size ?? 0);
    }
    rec.status = RecordingStatus.copying;
    await this.recordingRepo.save(rec);
    void this.copy(rec.id);
  }

  /** Zoom'dagi ism → taklif qilingan o'quvchi */
  private async matchUser(lessonId: string, displayName: string): Promise<string | null> {
    const invitees: { user_id: string; first_name: string | null; last_name: string | null; clicked: Date | null }[] =
      await this.ds.query(
        `SELECT i.user_id, u.first_name, u.last_name, i.join_clicked_at AS clicked
           FROM online_lesson_invitees i JOIN users u ON u.id = i.user_id
          WHERE i.lesson_id = $1`,
        [lessonId],
      );
    const n = normName(displayName);
    if (!n) return null;
    const exact = invitees.filter((i) => {
      const fl = normName(`${i.first_name ?? ''} ${i.last_name ?? ''}`);
      const lf = normName(`${i.last_name ?? ''} ${i.first_name ?? ''}`);
      return n === fl || n === lf;
    });
    if (exact.length === 1) return exact[0].user_id;
    const first = n.split(' ')[0];
    const byFirst = invitees.filter((i) => normName(i.first_name) === first);
    if (byFirst.length === 1) return byFirst[0].user_id;
    // Bir xil ismlilar orasidan «Qo'shilish» bosgan bitta bo'lsa — o'sha
    const clicked = (exact.length ? exact : byFirst).filter((i) => i.clicked);
    if (clicked.length === 1) return clicked[0].user_id;
    return null;
  }

  // ── Yozuvni ko'chirish ───────────────────────────────────────────────────

  async copy(recordingId: string) {
    if (this.copying.has(recordingId)) return;
    this.copying.add(recordingId);
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    try {
      if (!rec || rec.status === RecordingStatus.ready) return;
      const lesson = await this.lessonRepo.findOne({ where: { id: rec.lessonId } });
      if (!lesson) return;
      const uuid = rec.zoomUuid ?? lesson.zoomUuid;
      if (!uuid) throw new Error('Zoom uuid yo\'q');

      rec.status = RecordingStatus.copying;
      rec.attempts += 1;
      await this.recordingRepo.save(rec);

      const data = await this.zoom.getRecordings(uuid);
      const file = pickPrimary(data.recording_files ?? []);
      if (!file) throw new Error('MP4 yozuv topilmadi (Zoom hali tayyorlamoqda bo\'lishi mumkin)');

      const res = await this.zoom.download(file.download_url);
      const d = new Date(lesson.startsAt);
      const key = `recordings/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${lesson.id}.mp4`;
      const kind = await this.storage.put(key, Readable.fromWeb(res.body as any), 'video/mp4');

      const start = file.recording_start ? new Date(file.recording_start).getTime() : NaN;
      const end = file.recording_end ? new Date(file.recording_end).getTime() : NaN;
      rec.durationSec =
        Number.isFinite(start) && Number.isFinite(end) && end > start
          ? Math.round((end - start) / 1000)
          : Math.round(Number(data.duration ?? lesson.durationMin) * 60);
      rec.zoomFileId = file.id;
      rec.sizeBytes = String(file.file_size ?? 0);
      rec.storageKind = kind;
      rec.storageKey = key;
      rec.status = RecordingStatus.ready;
      rec.copiedAt = new Date();
      rec.error = null;
      await this.recordingRepo.save(rec);

      // Zoom'dagi nusxa — 10 GB bulut to'lmasin (trash'ga, 30 kun ichida tiklash mumkin)
      try {
        await this.zoom.deleteRecordings(uuid);
        rec.zoomDeletedAt = new Date();
        await this.recordingRepo.save(rec);
      } catch (err) {
        this.logger.warn(`Zoom'dagi yozuv o'chirilmadi: ${(err as Error).message}`);
      }

      if (lesson.recordingVisibility !== RecordingVisibility.hidden) {
        const ids = await this.lessons.inviteeIds(lesson.id);
        await this.notifications.notify(ids, {
          type: NotificationType.recording_ready,
          title: 'Dars yozuvi tayyor',
          body: `${lesson.topic} — ${tashkentWhen(new Date(lesson.startsAt))}`,
          action: { type: 'recording', id: rec.id, label: lesson.topic },
          senderId: lesson.teacherId,
          referenceId: rec.id,
          referenceType: 'recording',
          channel: 'lessons',
          preference: 'onlineLessons',
        });
      }
    } catch (err) {
      this.logger.error(`Yozuv ko'chirilmadi (${recordingId}): ${(err as Error).message}`);
      if (rec) {
        rec.status = RecordingStatus.failed;
        rec.error = (err as Error).message?.slice(0, 500) ?? 'Xato';
        await this.recordingRepo.save(rec).catch(() => {});
      }
    } finally {
      this.copying.delete(recordingId);
    }
  }

  /** Teacher «Qayta urinish» */
  async retry(recordingId: string) {
    await this.recordingRepo.update({ id: recordingId }, { attempts: 0, status: RecordingStatus.copying });
    void this.copy(recordingId);
    return { retrying: true };
  }

  // ── Har daqiqalik ish ────────────────────────────────────────────────────

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.sendReminders();
      await this.closeForgotten();
      if (this.zoom.isConfigured()) await this.retryRecordings();
    } catch (err) {
      this.logger.error(`Onlayn dars ishlari: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private async sendReminders() {
    const due: OnlineLesson[] = await this.lessonRepo
      .createQueryBuilder('l')
      .where('l.status = :s', { s: OnlineLessonStatus.scheduled })
      .andWhere(`l.startsAt <= now() + interval '8 days'`)
      .andWhere(`l.startsAt >= now() - interval '5 minutes'`)
      .getMany();
    const now = Date.now();
    for (const l of due) {
      const start = new Date(l.startsAt).getTime();
      const sent = new Set(l.remindersSent ?? []);
      // Eng yaqin (eng kichik) bajarilishi kerak bo'lganini yuboramiz, kattaroqlari «o'tkazib» yuboriladi
      const pending = (l.reminders ?? []).filter((m) => !sent.has(m) && now >= start - m * 60000);
      if (!pending.length) continue;
      const nearest = Math.min(...pending);
      pending.forEach((m) => sent.add(m));
      await this.lessonRepo.update({ id: l.id }, { remindersSent: [...sent] });

      if (nearest === 0) {
        // 0 — «boshlandi»: Zoom darsida webhook yuboradi; zaxira rejimda shu yerda
        if (!l.zoomMeetingId) {
          const fresh = await this.lessonRepo.findOne({ where: { id: l.id } });
          if (fresh) await this.notifyStart(fresh);
        }
        continue;
      }
      const ids = await this.lessons.inviteeIds(l.id);
      const minutesLeft = Math.max(1, Math.round((start - now) / 60000));
      await this.notifications.notify(ids, {
        type: NotificationType.online_lesson,
        title: reminderTitle(minutesLeft, new Date(start)),
        body: `${l.topic} · ${tashkentTime(new Date(start))} · ${l.durationMin} daqiqa`,
        action: { type: 'online_lesson', id: l.id, label: l.topic },
        senderId: l.teacherId,
        referenceId: l.id,
        referenceType: 'online_lesson',
        channel: 'lessons',
        preference: 'onlineLessons',
      });
    }
  }

  private async notifyStart(l: OnlineLesson) {
    const ids = await this.lessons.inviteeIds(l.id);
    await this.notifications.notify(ids, {
      type: NotificationType.online_lesson,
      title: `Dars boshlanmoqda: ${l.topic}`,
      body: "Hozir qo'shiling",
      action: { type: 'online_lesson', id: l.id, label: l.topic },
      senderId: l.teacherId,
      referenceId: l.id,
      referenceType: 'online_lesson',
      channel: 'lessons',
      preference: 'onlineLessons',
    });
  }

  /** Webhook kelmagan / zaxira rejim: vaqti 2 soatdan oshgan darslar yopiladi */
  /**
   * Zoom davomati → guruhning «Davomat» tabi (schedule_sessions + attendance).
   * Faqat guruhlarga yuborilgan Zoom darslari. Har guruh uchun shu sanadagi sessiya topiladi
   * (yo'q bo'lsa guruh jadvali asosida yaratiladi), a'zolarga keldi / kech keldi / kelmadi
   * belgilanadi. Qo'lda qo'yilgan belgi ustidan yozilmaydi (ON CONFLICT DO NOTHING).
   */
  async syncGroupAttendance(lesson: OnlineLesson) {
    if (!lesson.zoomMeetingId || lesson.audience?.mode !== 'groups') return;
    const groupIds = lesson.audience.groupIds ?? [];
    if (!groupIds.length) return;

    const startRef = new Date(lesson.startedAt ?? lesson.startsAt);
    const att: { user_id: string; first_join: Date }[] = await this.ds.query(
      `SELECT user_id, MIN(join_time) AS first_join FROM online_lesson_attendance
        WHERE lesson_id = $1 AND user_id IS NOT NULL GROUP BY user_id`,
      [lesson.id],
    );
    const joined = new Map(att.map((a) => [a.user_id, new Date(a.first_join)]));
    const [{ d: sessionDate, t: startTime }]: { d: string; t: string }[] = await this.ds.query(
      `SELECT to_char($1::timestamptz AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS d,
              to_char($1::timestamptz AT TIME ZONE 'Asia/Tashkent', 'HH24:MI') AS t`,
      [lesson.startsAt],
    );

    for (const groupId of groupIds) {
      const [group]: { teacher_id: string | null }[] = await this.ds.query(
        `SELECT teacher_id FROM groups WHERE id = $1`,
        [groupId],
      );
      if (!group) continue;

      let [session]: { id: string }[] = await this.ds.query(
        `SELECT id FROM schedule_sessions WHERE group_id = $1 AND session_date = $2 AND status <> 'cancelled'
          ORDER BY abs(extract(epoch FROM (start_time - $3::time))) ASC LIMIT 1`,
        [groupId, sessionDate, startTime],
      );
      if (!session) {
        // Sessiya jadval yozuviga bog'lanadi: dars jadvaldan yaratilgan bo'lsa o'sha, aks holda guruhning jadvali
        const [sched]: { id: string }[] = await this.ds.query(
          `SELECT id FROM schedules WHERE group_id = $1
            ORDER BY (id = $2::uuid) DESC, created_at DESC LIMIT 1`,
          [groupId, lesson.scheduleId ?? '00000000-0000-0000-0000-000000000000'],
        );
        if (!sched) continue; // jadvali yo'q guruh — davomat jadvali ham yo'q
        // Eski sxemada ManyToOne uchun alohida "scheduleId"/"groupId"/"teacherId" ustunlari ham bor —
        // bo'lsa ular ham to'ldiriladi (relations bilan o'qiydigan joylar uchun)
        const rel = await this.relationColumns('schedule_sessions', ['scheduleId', 'groupId', 'teacherId']);
        const cols = ['schedule_id', 'group_id', 'teacher_id', ...rel.map((c) => `"${c}"`)];
        const teacher = group.teacher_id ?? lesson.teacherId;
        const relVals = rel.map((c) => (c === 'scheduleId' ? sched.id : c === 'groupId' ? groupId : teacher));
        const vals = [sched.id, groupId, teacher, ...relVals, sessionDate, startTime, lesson.durationMin, lesson.topic];
        const n = cols.length;
        [session] = await this.ds.query(
          `INSERT INTO schedule_sessions (${cols.join(', ')}, session_date, start_time, duration_minutes, topic, status, notes)
           VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, 'completed', 'Onlayn dars (Zoom)')
           RETURNING id`,
          vals,
        );
      } else {
        await this.ds.query(`UPDATE schedule_sessions SET status = 'completed', updated_at = now() WHERE id = $1 AND status = 'scheduled'`, [session.id]);
      }

      const members: { user_id: string }[] = await this.ds.query(
        `SELECT gm.user_id FROM group_members gm JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = $1 AND u.role = 'student'`,
        [groupId],
      );
      if (!members.length) continue;
      const attRel = await this.relationColumns('attendance', ['sessionId', 'userId']);
      const attCols = ['session_id', 'user_id', 'status', 'joined_at', ...attRel.map((c) => `"${c}"`)];
      const values: any[] = [];
      const rows = members.map((m, i) => {
        const j = joined.get(m.user_id);
        const lateMin = j ? Math.round((j.getTime() - startRef.getTime()) / 60000) : null;
        const status = j ? (lateMin !== null && lateMin >= 5 ? 'late' : 'present') : 'absent';
        values.push(session.id, m.user_id, status, j ?? null, ...attRel.map((c) => (c === 'sessionId' ? session.id : m.user_id)));
        const b = i * attCols.length;
        return `(${attCols.map((_, k) => `$${b + k + 1}`).join(', ')})`;
      });
      await this.ds.query(
        `INSERT INTO attendance (${attCols.join(', ')}) VALUES ${rows.join(', ')}
         ON CONFLICT (session_id, user_id) DO NOTHING`,
        values,
      );
    }
  }

  private readonly relColumnsCache = new Map<string, string[]>();

  /** Jadvalda mavjud bo'lgan ManyToOne yordamchi ustunlari (camelCase) */
  private async relationColumns(table: string, candidates: string[]): Promise<string[]> {
    const cached = this.relColumnsCache.get(table);
    if (cached) return cached;
    const rows: { column_name: string }[] = await this.ds.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1 AND column_name = ANY($2::text[])`,
      [table, candidates],
    );
    const list = candidates.filter((c) => rows.some((r) => r.column_name === c));
    this.relColumnsCache.set(table, list);
    return list;
  }

  private async closeForgotten() {
    await this.ds.query(
      `UPDATE online_lessons
          SET status = 'ended', ended_at = COALESCE(ended_at, starts_at + duration_min * interval '1 minute'), updated_at = now()
        WHERE status IN ('scheduled', 'live')
          AND (starts_at + duration_min * interval '1 minute') < now() - interval '2 hours'`,
    );
  }

  private async retryRecordings() {
    // Xato bo'lganlar (30 daqiqadan keyin) va webhook kelmay qolganlar (3 soatdan keyin)
    const rows: { id: string }[] = await this.ds.query(
      `SELECT id FROM online_lesson_recordings
        WHERE (status = 'failed' AND attempts < $1 AND updated_at < now() - interval '30 minutes')
           OR (status = 'zoom_processing' AND created_at < now() - interval '3 hours' AND attempts < $1)
           OR (status = 'copying' AND updated_at < now() - interval '3 hours' AND attempts < $1)
        LIMIT 3`,
      [MAX_COPY_ATTEMPTS],
    );
    for (const r of rows) void this.copy(r.id);
  }
}

function pickPrimary(files: ZoomRecordingFile[]): ZoomRecordingFile | null {
  const mp4 = files.filter((f) => (f.file_type ?? '').toUpperCase() === 'MP4' && f.status !== 'processing');
  if (!mp4.length) return null;
  for (const t of RECORDING_PRIORITY) {
    const f = mp4.find((x) => x.recording_type === t);
    if (f) return f;
  }
  return mp4.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
}

function reminderTitle(minutesLeft: number, start: Date): string {
  if (minutesLeft >= 20 * 60) return `Ertaga onlayn dars — ${tashkentTime(start)}`;
  if (minutesLeft >= 50) {
    const h = Math.round(minutesLeft / 60);
    return `Onlayn dars ${h} soatdan keyin`;
  }
  return `Onlayn dars ${minutesLeft} daqiqadan keyin`;
}

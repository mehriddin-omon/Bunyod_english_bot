import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  OnlineLesson,
  OnlineLessonInvitee,
  OnlineLessonRecording,
  OnlineLessonSettings,
  OnlineLessonStatus,
  RecordingStatus,
  RecordingView,
  RecordingVisibility,
} from 'src/common/core/entitys/online-lesson.entity';
import type { AudienceSpec } from 'src/common/core/entitys/notification-broadcast.entity';
import { AudienceService, Requester } from 'src/common/services/audience.service';
import { NotificationType, Role } from 'src/common/utils/enum';
import { tashkentWhen } from 'src/common/utils/tashkent-time';
import { NotificationsService } from '../notifications/notifications.service';
import { ZoomClient, ZoomError } from './zoom.client';
import { RecordingStorageService } from './recording-storage.service';
import {
  CreateOnlineLessonDto,
  RecordingProgressDto,
  SendRecordingDto,
  UpdateOnlineLessonDto,
} from './dto/online-lesson.dto';

const ADMIN_ROLES: string[] = [Role.admin, Role.superAdmin];
/** O'quvchi «Qo'shilish» tugmasini darsdan shuncha oldin ko'radi */
export const JOIN_OPENS_BEFORE_MIN = 15;
/** Dars tugash vaqtidan keyin ham shuncha vaqt qo'shilish mumkin (cho'zilgan dars) */
const JOIN_GRACE_AFTER_MIN = 30;
const DEFAULT_SETTINGS: OnlineLessonSettings = { record: true, waitingRoom: true, muteOnEntry: true };
const DEFAULT_REMINDERS = [60, 10, 0];

function endsAt(l: { startsAt: Date; durationMin: number }): Date {
  return new Date(new Date(l.startsAt).getTime() + l.durationMin * 60000);
}

@Injectable()
export class OnlineLessonsService {
  private readonly logger = new Logger(OnlineLessonsService.name);

  constructor(
    @InjectRepository(OnlineLesson) private readonly lessonRepo: Repository<OnlineLesson>,
    @InjectRepository(OnlineLessonInvitee) private readonly inviteeRepo: Repository<OnlineLessonInvitee>,
    @InjectRepository(OnlineLessonRecording) private readonly recordingRepo: Repository<OnlineLessonRecording>,
    @InjectRepository(RecordingView) private readonly viewRepo: Repository<RecordingView>,
    private readonly audience: AudienceService,
    private readonly notifications: NotificationsService,
    private readonly zoom: ZoomClient,
    private readonly storage: RecordingStorageService,
    private readonly ds: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // TEACHER
  // ══════════════════════════════════════════════════════════════════════════

  async summary(requester: Requester) {
    const zoom = await this.zoom.status();
    const own = !ADMIN_ROLES.includes(requester.role as string);
    const [month]: any[] = await this.ds.query(
      `SELECT COUNT(*)::int AS lessons, COALESCE(SUM(duration_min), 0)::int AS minutes
         FROM online_lessons
        WHERE status <> 'cancelled' ${own ? 'AND teacher_id = $1' : ''}
          AND starts_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent')
          AND starts_at <= now()`,
      own ? [requester.sub] : [],
    );
    const [rec]: any[] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE r.status = 'ready')::int AS ready,
              COUNT(*) FILTER (WHERE r.status IN ('zoom_processing', 'copying'))::int AS pending,
              COUNT(*) FILTER (WHERE r.status = 'failed')::int AS failed,
              COALESCE(SUM(r.size_bytes) FILTER (WHERE r.status = 'ready'), 0)::bigint AS bytes
         FROM online_lesson_recordings r
         JOIN online_lessons l ON l.id = r.lesson_id
        ${own ? 'WHERE l.teacher_id = $1' : ''}`,
      own ? [requester.sub] : [],
    );
    return {
      zoom: { configured: zoom.configured, ok: zoom.ok, error: zoom.error ?? null },
      storage: {
        kind: this.storage.kind,
        readyCount: rec?.ready ?? 0,
        pendingCount: rec?.pending ?? 0,
        failedCount: rec?.failed ?? 0,
        totalBytes: Number(rec?.bytes ?? 0),
      },
      month: { lessons: month?.lessons ?? 0, minutes: month?.minutes ?? 0 },
      joinOpensBeforeMin: JOIN_OPENS_BEFORE_MIN,
    };
  }

  async create(dto: CreateOnlineLessonDto, requester: Requester) {
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException("Sana noto'g'ri");
    if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new BadRequestException("Boshlanish vaqti o'tib ketgan");
    }
    const manual = !!dto.manualJoinUrl;
    if (!manual && !this.zoom.isConfigured()) {
      throw new BadRequestException(
        "Zoom ulanmagan: serverdagi .env ga ZOOM_* kalitlarini kiriting yoki o'z dars havolangizni qo'lda kiriting",
      );
    }

    const settings: OnlineLessonSettings = manual
      ? { record: false, waitingRoom: false, muteOnEntry: false }
      : { ...DEFAULT_SETTINGS, ...(dto.settings ?? {}) };
    const audience = this.cleanAudience(dto.audience);
    const inviteeIds = await this.audience.resolve(audience, requester);
    if (!inviteeIds.length) throw new BadRequestException("Tanlangan ro'yxatda o'quvchi yo'q");

    if (!manual) await this.assertNoConflict(startsAt, dto.durationMin, null);

    let zoomMeetingId: string | null = null;
    let zoomUuid: string | null = null;
    let joinUrl = dto.manualJoinUrl ?? '';
    let passcode: string | null = null;
    if (!manual) {
      try {
        const m = await this.zoom.createMeeting({
          topic: dto.topic.trim(),
          startsAt,
          durationMin: dto.durationMin,
          record: settings.record,
          waitingRoom: settings.waitingRoom,
          muteOnEntry: settings.muteOnEntry,
        });
        zoomMeetingId = String(m.id);
        zoomUuid = m.uuid ?? null;
        joinUrl = m.join_url;
        passcode = m.password ?? null;
      } catch (err) {
        throw new BadRequestException(this.zoomMessage(err));
      }
    }

    const lesson = await this.lessonRepo.save(
      this.lessonRepo.create({
        teacherId: requester.sub,
        topic: dto.topic.trim(),
        startsAt,
        durationMin: dto.durationMin,
        audience,
        scheduleId: dto.scheduleId ?? null,
        zoomMeetingId,
        zoomUuid,
        joinUrl,
        passcode,
        settings,
        reminders: this.cleanReminders(dto.reminders),
        remindersSent: [],
        recordingVisibility: (dto.recordingVisibility as RecordingVisibility) ?? RecordingVisibility.invited,
        status: OnlineLessonStatus.scheduled,
      }),
    );
    await this.addInvitees(lesson.id, inviteeIds);

    const teacherName = await this.userName(requester.sub);
    setImmediate(() =>
      void this.notifications
        .notify(inviteeIds, {
          type: NotificationType.online_lesson,
          title: `Onlayn dars: ${lesson.topic}`,
          body: `${tashkentWhen(lesson.startsAt)} · ${lesson.durationMin} daqiqa${teacherName ? ` · ${teacherName}` : ''}`,
          action: { type: 'online_lesson', id: lesson.id, label: lesson.topic },
          senderId: requester.sub,
          referenceId: lesson.id,
          referenceType: 'online_lesson',
          channel: 'lessons',
          preference: 'onlineLessons',
        })
        .catch((e) => this.logger.error(e)),
    );

    return this.teacherDetail(lesson.id, requester);
  }

  async update(id: string, dto: UpdateOnlineLessonDto, requester: Requester) {
    const lesson = await this.findOwned(id, requester);
    if (lesson.status !== OnlineLessonStatus.scheduled) {
      throw new BadRequestException("Boshlangan yoki tugagan darsni o'zgartirib bo'lmaydi");
    }

    const prevStart = new Date(lesson.startsAt).getTime();
    const prevDuration = lesson.durationMin;
    if (dto.topic !== undefined) lesson.topic = dto.topic.trim();
    if (dto.startsAt !== undefined) {
      const s = new Date(dto.startsAt);
      if (Number.isNaN(s.getTime())) throw new BadRequestException("Sana noto'g'ri");
      if (s.getTime() < Date.now() - 5 * 60 * 1000) throw new BadRequestException("Boshlanish vaqti o'tib ketgan");
      lesson.startsAt = s;
    }
    if (dto.durationMin !== undefined) lesson.durationMin = dto.durationMin;
    if (dto.settings !== undefined && lesson.zoomMeetingId) lesson.settings = { ...lesson.settings, ...dto.settings };
    if (dto.reminders !== undefined) lesson.reminders = this.cleanReminders(dto.reminders);
    if (dto.recordingVisibility !== undefined) lesson.recordingVisibility = dto.recordingVisibility as RecordingVisibility;
    if (dto.manualJoinUrl !== undefined && !lesson.zoomMeetingId) lesson.joinUrl = dto.manualJoinUrl;

    const timeChanged = new Date(lesson.startsAt).getTime() !== prevStart || lesson.durationMin !== prevDuration;
    if (timeChanged && lesson.zoomMeetingId) await this.assertNoConflict(lesson.startsAt, lesson.durationMin, lesson.id);
    if (timeChanged) lesson.remindersSent = [];

    if (lesson.zoomMeetingId) {
      try {
        await this.zoom.updateMeeting(lesson.zoomMeetingId, {
          topic: lesson.topic,
          startsAt: lesson.startsAt,
          durationMin: lesson.durationMin,
          record: lesson.settings.record,
          waitingRoom: lesson.settings.waitingRoom,
          muteOnEntry: lesson.settings.muteOnEntry,
        });
      } catch (err) {
        throw new BadRequestException(this.zoomMessage(err));
      }
    }

    let newInvitees: string[] = [];
    if (dto.audience !== undefined) {
      lesson.audience = this.cleanAudience(dto.audience);
      const ids = await this.audience.resolve(lesson.audience, requester);
      if (!ids.length) throw new BadRequestException("Tanlangan ro'yxatda o'quvchi yo'q");
      const existing = await this.inviteeRepo.find({ where: { lessonId: lesson.id } });
      const existingIds = new Set(existing.map((e) => e.userId));
      const keep = new Set(ids);
      const removed = existing.filter((e) => !keep.has(e.userId)).map((e) => e.id);
      if (removed.length) await this.inviteeRepo.delete({ id: In(removed) });
      newInvitees = ids.filter((u) => !existingIds.has(u));
      await this.addInvitees(lesson.id, newInvitees);
    }

    await this.lessonRepo.save(lesson);

    const all = await this.inviteeIds(lesson.id);
    if (timeChanged) {
      const old = all.filter((u) => !newInvitees.includes(u));
      void this.notifications
        .notify(old, {
          type: NotificationType.online_lesson,
          title: `Dars vaqti o'zgardi: ${lesson.topic}`,
          body: `Yangi vaqt: ${tashkentWhen(lesson.startsAt)} · ${lesson.durationMin} daqiqa`,
          action: { type: 'online_lesson', id: lesson.id, label: lesson.topic },
          senderId: lesson.teacherId,
          referenceId: lesson.id,
          referenceType: 'online_lesson',
          channel: 'lessons',
          preference: 'onlineLessons',
        })
        .catch(() => {});
    }
    if (newInvitees.length) {
      void this.notifications
        .notify(newInvitees, {
          type: NotificationType.online_lesson,
          title: `Onlayn dars: ${lesson.topic}`,
          body: `${tashkentWhen(lesson.startsAt)} · ${lesson.durationMin} daqiqa`,
          action: { type: 'online_lesson', id: lesson.id, label: lesson.topic },
          senderId: lesson.teacherId,
          referenceId: lesson.id,
          referenceType: 'online_lesson',
          channel: 'lessons',
          preference: 'onlineLessons',
        })
        .catch(() => {});
    }
    return this.teacherDetail(lesson.id, requester);
  }

  async cancel(id: string, requester: Requester) {
    const lesson = await this.findOwned(id, requester);
    if (lesson.status === OnlineLessonStatus.ended || lesson.status === OnlineLessonStatus.cancelled) {
      throw new BadRequestException("Bu darsni bekor qilib bo'lmaydi");
    }
    if (lesson.zoomMeetingId) {
      await this.zoom.deleteMeeting(lesson.zoomMeetingId).catch((e) => this.logger.warn(this.zoomMessage(e)));
    }
    lesson.status = OnlineLessonStatus.cancelled;
    await this.lessonRepo.save(lesson);
    const ids = await this.inviteeIds(lesson.id);
    void this.notifications
      .notify(ids, {
        type: NotificationType.online_lesson,
        title: `Dars bekor qilindi: ${lesson.topic}`,
        body: `${tashkentWhen(lesson.startsAt)} dagi onlayn dars bo'lmaydi`,
        action: { type: 'online_lesson', id: lesson.id, label: lesson.topic },
        senderId: lesson.teacherId,
        referenceId: lesson.id,
        referenceType: 'online_lesson',
        channel: 'lessons',
        preference: 'onlineLessons',
      })
      .catch(() => {});
    return { cancelled: true };
  }

  /** Teacher «Zoom'da boshlash» — har safar Zoom'dan yangi start_url (2 soat amal qiladi) */
  async start(id: string, requester: Requester) {
    const lesson = await this.findOwned(id, requester);
    if (lesson.status === OnlineLessonStatus.cancelled) throw new BadRequestException('Dars bekor qilingan');
    if (!lesson.zoomMeetingId) {
      if (lesson.status === OnlineLessonStatus.scheduled) {
        lesson.status = OnlineLessonStatus.live;
        lesson.startedAt = new Date();
        await this.lessonRepo.save(lesson);
        void this.sendStartedReminder(lesson);
      }
      return { startUrl: lesson.joinUrl, manual: true };
    }
    try {
      const m = await this.zoom.getMeeting(lesson.zoomMeetingId);
      return { startUrl: m.start_url, manual: false };
    } catch (err) {
      throw new BadRequestException(this.zoomMessage(err));
    }
  }

  /** Zaxira rejimdagi darsni teacher o'zi yakunlaydi */
  async finish(id: string, requester: Requester) {
    const lesson = await this.findOwned(id, requester);
    if (lesson.status === OnlineLessonStatus.live || lesson.status === OnlineLessonStatus.scheduled) {
      lesson.status = OnlineLessonStatus.ended;
      lesson.endedAt = new Date();
      await this.lessonRepo.save(lesson);
    }
    return { ended: true };
  }

  async teacherList(requester: Requester, tab: string) {
    const own = !ADMIN_ROLES.includes(requester.role as string);
    const params: any[] = [];
    const where: string[] = [];
    if (own) {
      params.push(requester.sub);
      where.push(`l.teacher_id = $${params.length}`);
    }
    if (tab === 'past') {
      where.push(`(l.status IN ('ended', 'cancelled') OR (l.starts_at + l.duration_min * interval '1 minute') < now() - interval '30 minutes')`);
    } else {
      where.push(`l.status IN ('scheduled', 'live') AND (l.starts_at + l.duration_min * interval '1 minute') >= now() - interval '30 minutes'`);
    }
    const order = tab === 'past' ? 'l.starts_at DESC' : 'l.starts_at ASC';
    const rows: { id: string }[] = await this.ds.query(
      `SELECT l.id FROM online_lessons l WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 100`,
      params,
    );
    return this.decorateTeacher(rows.map((r) => r.id));
  }

  async teacherDetail(id: string, requester: Requester) {
    await this.findOwned(id, requester);
    const [item] = await this.decorateTeacher([id]);
    return item;
  }

  /** Davomat: har bir taklif qilingan + ism bo'yicha topilmagan qatnashchilar */
  async attendance(id: string, requester: Requester) {
    const lesson = await this.findOwned(id, requester);
    const invitees: any[] = await this.ds.query(
      `SELECT i.user_id, i.join_clicked_at, u.first_name, u.last_name, u.is_guest, u.avatar_url
         FROM online_lesson_invitees i JOIN users u ON u.id = i.user_id
        WHERE i.lesson_id = $1
        ORDER BY u.first_name ASC`,
      [lesson.id],
    );
    const rows: any[] = await this.ds.query(
      `SELECT user_id, display_name, MIN(join_time) AS first_join, SUM(duration_sec)::int AS total_sec,
              BOOL_OR(leave_time IS NULL) AS still_in
         FROM online_lesson_attendance WHERE lesson_id = $1
        GROUP BY user_id, display_name`,
      [lesson.id],
    );
    const startRef = lesson.startedAt ? new Date(lesson.startedAt) : new Date(lesson.startsAt);
    const byUser = new Map<string, { firstJoin: Date; totalSec: number; stillIn: boolean }>();
    const unknown: { name: string; totalSec: number }[] = [];
    for (const r of rows) {
      if (r.user_id) {
        const prev = byUser.get(r.user_id);
        const fj = new Date(r.first_join);
        byUser.set(r.user_id, {
          firstJoin: prev && prev.firstJoin < fj ? prev.firstJoin : fj,
          totalSec: (prev?.totalSec ?? 0) + Number(r.total_sec ?? 0),
          stillIn: (prev?.stillIn ?? false) || !!r.still_in,
        });
      } else {
        unknown.push({ name: r.display_name, totalSec: Number(r.total_sec ?? 0) });
      }
    }
    const list = invitees.map((i) => {
      const a = byUser.get(i.user_id);
      const lateMin = a ? Math.max(0, Math.round((a.firstJoin.getTime() - startRef.getTime()) / 60000)) : null;
      return {
        userId: i.user_id,
        firstName: i.first_name,
        lastName: i.last_name,
        isGuest: !!i.is_guest,
        avatarUrl: i.avatar_url ?? null,
        attended: !!a,
        totalSec: a?.totalSec ?? 0,
        stillIn: a?.stillIn ?? false,
        lateMin: lateMin !== null && lateMin >= 5 ? lateMin : 0,
        joinClicked: !!i.join_clicked_at,
      };
    });
    return {
      automatic: !!lesson.zoomMeetingId,
      attendedCount: list.filter((x) => x.attended).length,
      invitedCount: list.length,
      students: list,
      unknownParticipants: unknown,
    };
  }

  /** Yozuv orqali egalikni tekshirish (qayta urinish uchun) */
  async teacherDetailByRecording(recordingId: string, requester: Requester) {
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!rec) throw new NotFoundException('Yozuv topilmadi');
    await this.findOwned(rec.lessonId, requester);
    return rec;
  }

  async setRecordingVisibility(recordingId: string, visibility: RecordingVisibility, requester: Requester) {
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!rec) throw new NotFoundException('Yozuv topilmadi');
    const lesson = await this.findOwned(rec.lessonId, requester);
    lesson.recordingVisibility = visibility;
    await this.lessonRepo.save(lesson);
    return { visibility };
  }

  /** Teacher yozuvni ko'rish havolasi */
  async teacherRecordingUrl(recordingId: string, requester: Requester) {
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!rec) throw new NotFoundException('Yozuv topilmadi');
    await this.findOwned(rec.lessonId, requester);
    if (rec.status !== RecordingStatus.ready || !rec.storageKey) throw new BadRequestException('Yozuv hali tayyor emas');
    return { url: await this.storage.url(rec.storageKind, rec.storageKey), durationSec: rec.durationSec };
  }

  /** «Ularga yozuvni yuborish» — qatnashmaganlarga (yoki hammaga) bildirishnoma */
  async sendRecording(recordingId: string, dto: SendRecordingDto, requester: Requester) {
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!rec || rec.status !== RecordingStatus.ready) throw new BadRequestException('Yozuv hali tayyor emas');
    const lesson = await this.findOwned(rec.lessonId, requester);
    let ids = await this.inviteeIds(lesson.id);
    if ((dto.to ?? 'absent') === 'absent') {
      const att: { user_id: string }[] = await this.ds.query(
        `SELECT DISTINCT user_id FROM online_lesson_attendance WHERE lesson_id = $1 AND user_id IS NOT NULL`,
        [lesson.id],
      );
      const present = new Set(att.map((a) => a.user_id));
      ids = ids.filter((u) => !present.has(u));
    }
    if (lesson.recordingVisibility === RecordingVisibility.hidden) {
      lesson.recordingVisibility = RecordingVisibility.invited;
      await this.lessonRepo.save(lesson);
    }
    const res = await this.notifications.notify(ids, {
      type: NotificationType.recording_ready,
      title: `Dars yozuvi: ${lesson.topic}`,
      body: "Darsni o'tkazib yubordingiz — yozuvni ko'rib chiqing",
      action: { type: 'recording', id: rec.id, label: lesson.topic },
      senderId: lesson.teacherId,
      referenceId: rec.id,
      referenceType: 'recording',
      channel: 'lessons',
      preference: 'onlineLessons',
    });
    return { sent: res.recipientCount };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // O'QUVCHI
  // ══════════════════════════════════════════════════════════════════════════

  async studentList(userId: string, tab: string) {
    const past = tab === 'past';
    const rows: any[] = await this.ds.query(
      `SELECT l.id, l.topic, l.starts_at, l.duration_min, l.status, l.started_at,
              u.first_name AS t_first, u.last_name AS t_last, u.avatar_url AS t_avatar
         FROM online_lesson_invitees i
         JOIN online_lessons l ON l.id = i.lesson_id
         JOIN users u ON u.id = l.teacher_id
        WHERE i.user_id = $1 AND l.status <> 'cancelled'
          AND ${
            past
              ? `(l.status = 'ended' OR (l.starts_at + l.duration_min * interval '1 minute') < now() - interval '${JOIN_GRACE_AFTER_MIN} minutes')`
              : `l.status IN ('scheduled', 'live') AND (l.starts_at + l.duration_min * interval '1 minute') >= now() - interval '${JOIN_GRACE_AFTER_MIN} minutes'`
          }
        ORDER BY l.starts_at ${past ? 'DESC' : 'ASC'}
        LIMIT 50`,
      [userId],
    );
    return rows.map((r) => this.formatStudentLesson(r));
  }

  /** Bosh sahifa kartasi: hozir qo'shilish mumkin bo'lgan eng yaqin dars (yo'q — null) */
  async studentLive(userId: string) {
    const rows: any[] = await this.ds.query(
      `SELECT l.id, l.topic, l.starts_at, l.duration_min, l.status, l.started_at,
              u.first_name AS t_first, u.last_name AS t_last, u.avatar_url AS t_avatar
         FROM online_lesson_invitees i
         JOIN online_lessons l ON l.id = i.lesson_id
         JOIN users u ON u.id = l.teacher_id
        WHERE i.user_id = $1
          AND l.status IN ('scheduled', 'live')
          AND l.starts_at <= now() + interval '${JOIN_OPENS_BEFORE_MIN} minutes'
          AND (l.status = 'live' OR (l.starts_at + l.duration_min * interval '1 minute') >= now() - interval '${JOIN_GRACE_AFTER_MIN} minutes')
        ORDER BY l.starts_at ASC
        LIMIT 1`,
      [userId],
    );
    return rows[0] ? this.formatStudentLesson(rows[0]) : null;
  }

  async studentLesson(id: string, userId: string) {
    const rows: any[] = await this.ds.query(
      `SELECT l.id, l.topic, l.starts_at, l.duration_min, l.status, l.started_at,
              u.first_name AS t_first, u.last_name AS t_last, u.avatar_url AS t_avatar
         FROM online_lesson_invitees i
         JOIN online_lessons l ON l.id = i.lesson_id
         JOIN users u ON u.id = l.teacher_id
        WHERE i.user_id = $1 AND l.id = $2`,
      [userId, id],
    );
    if (!rows[0]) throw new NotFoundException('Dars topilmadi yoki siz taklif qilinmagansiz');
    return this.formatStudentLesson(rows[0]);
  }

  async join(id: string, userId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const invitee = await this.inviteeRepo.findOne({ where: { lessonId: id, userId } });
    if (!invitee) throw new ForbiddenException('Siz bu darsga taklif qilinmagansiz');
    if (lesson.status === OnlineLessonStatus.cancelled) throw new BadRequestException('Dars bekor qilingan');
    if (lesson.status === OnlineLessonStatus.ended) throw new BadRequestException('Dars tugagan');
    const now = Date.now();
    const opens = new Date(lesson.startsAt).getTime() - JOIN_OPENS_BEFORE_MIN * 60000;
    const closes = endsAt(lesson).getTime() + JOIN_GRACE_AFTER_MIN * 60000;
    if (now < opens) throw new BadRequestException(`Qo'shilish darsdan ${JOIN_OPENS_BEFORE_MIN} daqiqa oldin ochiladi`);
    if (lesson.status !== OnlineLessonStatus.live && now > closes) throw new BadRequestException('Dars tugagan');

    if (!invitee.joinClickedAt) {
      invitee.joinClickedAt = new Date();
      await this.inviteeRepo.save(invitee);
    }
    const webUrl = lesson.zoomMeetingId
      ? `https://app.zoom.us/wc/join/${lesson.zoomMeetingId}${lesson.passcode ? `?pwd=${encodeURIComponent(lesson.passcode)}` : ''}`
      : lesson.joinUrl;
    return { joinUrl: lesson.joinUrl, webUrl, meetingId: lesson.zoomMeetingId, passcode: lesson.passcode };
  }

  async studentRecordings(userId: string) {
    const rows: any[] = await this.ds.query(
      `SELECT r.id, r.duration_sec, r.status, r.lesson_id, l.topic, l.starts_at, l.recording_visibility,
              u.first_name AS t_first, u.last_name AS t_last,
              v.position_sec, v.completed
         FROM online_lesson_recordings r
         JOIN online_lessons l ON l.id = r.lesson_id
         JOIN users u ON u.id = l.teacher_id
         LEFT JOIN recording_views v ON v.recording_id = r.id AND v.user_id = $1
        WHERE r.status IN ('ready', 'zoom_processing', 'copying')
          AND l.recording_visibility <> 'hidden'
          AND (l.recording_visibility = 'all'
               OR EXISTS (SELECT 1 FROM online_lesson_invitees i WHERE i.lesson_id = l.id AND i.user_id = $1))
        ORDER BY l.starts_at DESC
        LIMIT 100`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      lessonId: r.lesson_id,
      topic: r.topic,
      startsAt: r.starts_at,
      durationSec: Number(r.duration_sec ?? 0),
      ready: r.status === 'ready',
      teacher: { firstName: r.t_first, lastName: r.t_last },
      positionSec: Number(r.position_sec ?? 0),
      completed: !!r.completed,
    }));
  }

  async play(recordingId: string, userId: string) {
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!rec) throw new NotFoundException('Yozuv topilmadi');
    const lesson = await this.lessonRepo.findOne({ where: { id: rec.lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await this.assertCanWatch(lesson, userId);
    if (rec.status !== RecordingStatus.ready || !rec.storageKey) {
      throw new BadRequestException('Yozuv hali tayyorlanmoqda');
    }
    const view = await this.viewRepo.findOne({ where: { recordingId, userId } });
    return {
      url: await this.storage.url(rec.storageKind, rec.storageKey),
      durationSec: rec.durationSec,
      positionSec: view?.positionSec ?? 0,
      completed: view?.completed ?? false,
      topic: lesson.topic,
      startsAt: lesson.startsAt,
    };
  }

  async saveProgress(recordingId: string, userId: string, dto: RecordingProgressDto) {
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!rec) throw new NotFoundException('Yozuv topilmadi');
    const lesson = await this.lessonRepo.findOne({ where: { id: rec.lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await this.assertCanWatch(lesson, userId);
    let view = await this.viewRepo.findOne({ where: { recordingId, userId } });
    if (!view) view = this.viewRepo.create({ recordingId, userId, positionSec: 0, completed: false });
    view.positionSec = dto.positionSec;
    if (dto.completed) view.completed = true;
    else if (rec.durationSec > 0 && dto.positionSec >= rec.durationSec * 0.9) view.completed = true;
    await this.viewRepo.save(view);
    return { saved: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Ichki yordamchilar
  // ══════════════════════════════════════════════════════════════════════════

  private async assertCanWatch(lesson: OnlineLesson, userId: string) {
    if (lesson.teacherId === userId) return;
    if (lesson.recordingVisibility === RecordingVisibility.hidden) throw new ForbiddenException('Yozuv yopiq');
    if (lesson.recordingVisibility === RecordingVisibility.all) return;
    const inv = await this.inviteeRepo.findOne({ where: { lessonId: lesson.id, userId } });
    if (!inv) {
      const staff: { role: string }[] = await this.ds.query(`SELECT role FROM users WHERE id = $1`, [userId]);
      if (!['teacher', 'admin', 'superAdmin', 'subTeacher'].includes(staff?.[0]?.role)) {
        throw new ForbiddenException("Bu yozuvni ko'rish huquqingiz yo'q");
      }
    }
  }

  private formatStudentLesson(r: any) {
    const startsAt = new Date(r.starts_at);
    const end = new Date(startsAt.getTime() + Number(r.duration_min) * 60000);
    const opensAt = new Date(startsAt.getTime() - JOIN_OPENS_BEFORE_MIN * 60000);
    const now = Date.now();
    const canJoin =
      r.status === 'live' ||
      (r.status === 'scheduled' && now >= opensAt.getTime() && now <= end.getTime() + JOIN_GRACE_AFTER_MIN * 60000);
    return {
      id: r.id,
      topic: r.topic,
      startsAt,
      endsAt: end,
      durationMin: Number(r.duration_min),
      status: r.status as OnlineLessonStatus,
      startedAt: r.started_at ?? null,
      isLive: r.status === 'live',
      canJoin,
      joinOpensAt: opensAt,
      teacher: { firstName: r.t_first, lastName: r.t_last, avatarUrl: r.t_avatar ?? null },
    };
  }

  private async decorateTeacher(ids: string[]) {
    if (!ids.length) return [];
    const lessons = await this.lessonRepo.find({ where: { id: In(ids) } });
    const order = new Map(ids.map((id, i) => [id, i]));
    lessons.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const counts: any[] = await this.ds.query(
      `SELECT l.id,
              (SELECT COUNT(*) FROM online_lesson_invitees i WHERE i.lesson_id = l.id)::int AS invited,
              (SELECT COUNT(DISTINCT a.user_id) FROM online_lesson_attendance a WHERE a.lesson_id = l.id AND a.user_id IS NOT NULL)::int AS attended
         FROM online_lessons l WHERE l.id = ANY($1::uuid[])`,
      [ids],
    );
    const countMap = new Map(counts.map((c) => [c.id, c]));
    const recs = await this.recordingRepo.find({ where: { lessonId: In(ids) } });
    const recMap = new Map(recs.map((r) => [r.lessonId, r]));
    const viewCounts: any[] = recs.length
      ? await this.ds.query(
          `SELECT recording_id, COUNT(*)::int AS c FROM recording_views WHERE recording_id = ANY($1::uuid[]) GROUP BY recording_id`,
          [recs.map((r) => r.id)],
        )
      : [];
    const viewMap = new Map(viewCounts.map((v) => [v.recording_id, v.c]));
    const groupIds = [...new Set(lessons.flatMap((l) => l.audience?.groupIds ?? []))];
    const groups: { id: string; name: string }[] = groupIds.length
      ? await this.ds.query(`SELECT id, name FROM groups WHERE id = ANY($1::uuid[])`, [groupIds])
      : [];
    const gName = new Map(groups.map((g) => [g.id, g.name]));

    return lessons.map((l) => {
      const rec = recMap.get(l.id);
      const c = countMap.get(l.id);
      return {
        id: l.id,
        topic: l.topic,
        startsAt: l.startsAt,
        endsAt: endsAt(l),
        durationMin: l.durationMin,
        status: l.status,
        startedAt: l.startedAt,
        endedAt: l.endedAt,
        audience: l.audience,
        audienceLabel: this.audienceLabel(l.audience, gName),
        invitedCount: c?.invited ?? 0,
        attendedCount: c?.attended ?? 0,
        isManual: !l.zoomMeetingId,
        zoomMeetingId: l.zoomMeetingId,
        joinUrl: l.joinUrl,
        passcode: l.passcode,
        settings: l.settings,
        reminders: l.reminders,
        recordingVisibility: l.recordingVisibility,
        scheduleId: l.scheduleId,
        recording: rec
          ? {
              id: rec.id,
              status: rec.status,
              durationSec: rec.durationSec,
              sizeBytes: Number(rec.sizeBytes ?? 0),
              storageKind: rec.storageKind,
              copiedAt: rec.copiedAt,
              zoomDeletedAt: rec.zoomDeletedAt,
              error: rec.error,
              viewCount: viewMap.get(rec.id) ?? 0,
            }
          : null,
      };
    });
  }

  private audienceLabel(a: AudienceSpec, gName: Map<string, string>): string {
    if (!a || a.mode === 'all') return a?.includeGuests === false ? "Barcha o'quvchilar" : 'Hammasi';
    if (a.mode === 'groups') {
      const names = (a.groupIds ?? []).map((id) => gName.get(id)).filter(Boolean) as string[];
      return (names.length ? names.join(', ') : 'Guruhlar') + (a.includeGuests ? ' + mehmonlar' : '');
    }
    return `${(a.userIds ?? []).length} ta tanlangan`;
  }

  private cleanAudience(a: AudienceSpec): AudienceSpec {
    return {
      mode: a.mode,
      groupIds: a.mode === 'groups' ? [...new Set(a.groupIds ?? [])] : [],
      userIds: a.mode === 'users' ? [...new Set(a.userIds ?? [])] : [],
      includeGuests: a.mode === 'users' ? false : a.includeGuests ?? a.mode === 'all',
    };
  }

  private cleanReminders(r?: number[]): number[] {
    const list = r ?? DEFAULT_REMINDERS;
    return [...new Set(list.map((x) => Math.round(x)).filter((x) => x >= 0))].sort((a, b) => b - a);
  }

  private async addInvitees(lessonId: string, userIds: string[]) {
    for (let i = 0; i < userIds.length; i += 500) {
      const chunk = userIds.slice(i, i + 500);
      if (!chunk.length) continue;
      await this.inviteeRepo
        .createQueryBuilder()
        .insert()
        .into(OnlineLessonInvitee)
        .values(chunk.map((userId) => ({ lessonId, userId })))
        .orIgnore()
        .execute();
    }
  }

  async inviteeIds(lessonId: string): Promise<string[]> {
    const rows = await this.inviteeRepo.find({ where: { lessonId }, select: ['userId'] });
    return rows.map((r) => r.userId);
  }

  /** Barcha Zoom darslar bitta Zoom foydalanuvchi nomidan — vaqtlar kesishmasligi kerak */
  private async assertNoConflict(startsAt: Date, durationMin: number, exceptId: string | null) {
    const end = new Date(startsAt.getTime() + durationMin * 60000);
    const rows: { topic: string; starts_at: Date }[] = await this.ds.query(
      `SELECT topic, starts_at FROM online_lessons
        WHERE status IN ('scheduled', 'live') AND zoom_meeting_id IS NOT NULL
          ${exceptId ? 'AND id <> $3' : ''}
          AND starts_at < $2
          AND (starts_at + duration_min * interval '1 minute') > $1
        LIMIT 1`,
      exceptId ? [startsAt, end, exceptId] : [startsAt, end],
    );
    if (rows.length) {
      throw new ConflictException(
        `Bu vaqtda boshqa onlayn dars bor: «${rows[0].topic}» (${tashkentWhen(new Date(rows[0].starts_at))})`,
      );
    }
  }

  private async findOwned(id: string, requester: Requester) {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (lesson.teacherId !== requester.sub && !ADMIN_ROLES.includes(requester.role as string)) {
      throw new ForbiddenException('Bu dars sizniki emas');
    }
    return lesson;
  }

  private async userName(userId: string): Promise<string | null> {
    const rows: any[] = await this.ds.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);
    if (!rows[0]) return null;
    return `${rows[0].first_name ?? ''} ${rows[0].last_name ?? ''}`.trim() || null;
  }

  private zoomMessage(err: unknown): string {
    if (err instanceof ZoomError) return err.message;
    return `Zoom bilan bog'lanib bo'lmadi: ${(err as Error)?.message ?? err}`;
  }

  /** «Dars boshlandi» eslatmasi (0 daqiqa) — bir marta */
  async sendStartedReminder(lesson: OnlineLesson) {
    if (!lesson.reminders?.includes(0) || lesson.remindersSent?.includes(0)) return;
    await this.lessonRepo.update({ id: lesson.id }, { remindersSent: [...(lesson.remindersSent ?? []), 0] });
    const ids = await this.inviteeIds(lesson.id);
    await this.notifications.notify(ids, {
      type: NotificationType.online_lesson,
      title: `Dars boshlandi: ${lesson.topic}`,
      body: "Hozir qo'shiling — o'qituvchi kutmoqda",
      action: { type: 'online_lesson', id: lesson.id, label: lesson.topic },
      senderId: lesson.teacherId,
      referenceId: lesson.id,
      referenceType: 'online_lesson',
      channel: 'lessons',
      preference: 'onlineLessons',
    });
  }
}

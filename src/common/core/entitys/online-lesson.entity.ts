import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import type { AudienceSpec } from './notification-broadcast.entity';

export enum OnlineLessonStatus {
  scheduled = 'scheduled',
  live = 'live',
  ended = 'ended',
  cancelled = 'cancelled',
}

/** Yozuv kimga ko'rinadi */
export enum RecordingVisibility {
  invited = 'invited',
  all = 'all',
  hidden = 'hidden',
}

export interface OnlineLessonSettings {
  /** Zoom bulutiga avtomatik yozib olish */
  record: boolean;
  waitingRoom: boolean;
  muteOnEntry: boolean;
}

/**
 * Onlayn (Zoom) dars — 2026-11.
 * `zoomMeetingId` bo'sh bo'lsa — teacher o'z havolasini qo'lda kiritgan (zaxira rejim):
 * xabar va eslatmalar ishlaydi, avto yozuv va davomat yo'q.
 */
@Entity({ name: 'online_lessons' })
@Index(['teacherId', 'startsAt'])
@Index(['status', 'startsAt'])
export class OnlineLesson extends BaseEntity {
  @Column({ type: 'uuid', name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ type: 'varchar', name: 'topic', length: 200 })
  topic: string;

  @Column({ type: 'timestamptz', name: 'starts_at' })
  startsAt: Date;

  @Column({ type: 'int', name: 'duration_min', default: 90 })
  durationMin: number;

  @Column({ type: 'jsonb', name: 'audience' })
  audience: AudienceSpec;

  /** Jadvaldagi dars (schedules) — ixtiyoriy */
  @Column({ type: 'uuid', name: 'schedule_id', nullable: true })
  scheduleId: string | null;

  @Index()
  @Column({ type: 'varchar', name: 'zoom_meeting_id', nullable: true })
  zoomMeetingId: string | null;

  /** Oxirgi o'tkazilgan instance uuid (yozuv va hisobot shu bo'yicha) */
  @Column({ type: 'varchar', name: 'zoom_uuid', nullable: true })
  zoomUuid: string | null;

  @Column({ type: 'text', name: 'join_url' })
  joinUrl: string;

  @Column({ type: 'varchar', name: 'passcode', nullable: true })
  passcode: string | null;

  @Column({ type: 'jsonb', name: 'settings' })
  settings: OnlineLessonSettings;

  /** Eslatmalar: darsdan necha daqiqa oldin (0 = boshlanganda) */
  @Column({ type: 'jsonb', name: 'reminders', default: () => `'[60,10,0]'` })
  reminders: number[];

  @Column({ type: 'jsonb', name: 'reminders_sent', default: () => `'[]'` })
  remindersSent: number[];

  @Column({ type: 'varchar', name: 'recording_visibility', default: RecordingVisibility.invited })
  recordingVisibility: RecordingVisibility;

  @Column({ type: 'varchar', name: 'status', default: OnlineLessonStatus.scheduled })
  status: OnlineLessonStatus;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt: Date | null;
}

/** Taklif qilinganlar — dars yaratilganda AudienceService'dan */
@Entity({ name: 'online_lesson_invitees' })
@Index(['lessonId', 'userId'], { unique: true })
@Index(['userId'])
export class OnlineLessonInvitee extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => OnlineLesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: OnlineLesson;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Ilovada «Qo'shilish» bosilgan vaqt (davomatni ism bilan bog'lashda yordam beradi) */
  @Column({ type: 'timestamptz', name: 'join_clicked_at', nullable: true })
  joinClickedAt: Date | null;
}

/** Zoom'dagi har bir kirish-chiqish (webhook participant_joined / left) */
@Entity({ name: 'online_lesson_attendance' })
@Index(['lessonId'])
export class OnlineLessonAttendance extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => OnlineLesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: OnlineLesson;

  /** Ism bo'yicha topilgan o'quvchi (topilmasa null) */
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', name: 'display_name' })
  displayName: string;

  @Column({ type: 'varchar', name: 'participant_key', nullable: true })
  participantKey: string | null;

  @Column({ type: 'timestamptz', name: 'join_time' })
  joinTime: Date;

  @Column({ type: 'timestamptz', name: 'leave_time', nullable: true })
  leaveTime: Date | null;

  @Column({ type: 'int', name: 'duration_sec', default: 0 })
  durationSec: number;
}

export enum RecordingStatus {
  zoom_processing = 'zoom_processing',
  copying = 'copying',
  ready = 'ready',
  failed = 'failed',
}

/** Dars yozuvi — Zoom'dan bizning omborga (Spaces yoki lokal disk) ko'chiriladi */
@Entity({ name: 'online_lesson_recordings' })
@Index(['lessonId'], { unique: true })
export class OnlineLessonRecording extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => OnlineLesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: OnlineLesson;

  @Column({ type: 'varchar', name: 'zoom_uuid', nullable: true })
  zoomUuid: string | null;

  @Column({ type: 'varchar', name: 'zoom_file_id', nullable: true })
  zoomFileId: string | null;

  @Column({ type: 'bigint', name: 'size_bytes', default: 0 })
  sizeBytes: string;

  @Column({ type: 'int', name: 'duration_sec', default: 0 })
  durationSec: number;

  @Column({ type: 'varchar', name: 'status', default: RecordingStatus.zoom_processing })
  status: RecordingStatus;

  /** spaces | local */
  @Column({ type: 'varchar', name: 'storage_kind', nullable: true })
  storageKind: string | null;

  @Column({ type: 'varchar', name: 'storage_key', nullable: true })
  storageKey: string | null;

  @Column({ type: 'timestamptz', name: 'copied_at', nullable: true })
  copiedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'zoom_deleted_at', nullable: true })
  zoomDeletedAt: Date | null;

  @Column({ type: 'int', name: 'attempts', default: 0 })
  attempts: number;

  @Column({ type: 'text', name: 'error', nullable: true })
  error: string | null;
}

/** Kim qayergacha ko'rdi — «12:40 da to'xtagansiz» */
@Entity({ name: 'recording_views' })
@Index(['recordingId', 'userId'], { unique: true })
export class RecordingView extends BaseEntity {
  @Column({ type: 'uuid', name: 'recording_id' })
  recordingId: string;

  @ManyToOne(() => OnlineLessonRecording, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recording_id' })
  recording: OnlineLessonRecording;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', name: 'position_sec', default: 0 })
  positionSec: number;

  @Column({ type: 'boolean', name: 'completed', default: false })
  completed: boolean;
}

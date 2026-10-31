import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

/** O'qituvchi tuzatishi: «I watch» → «I watched» */
export interface SpeakingFix {
  wrong: string;
  right: string;
}

/**
 * Bitta savolga javob. Savol matni ilovadan keladi (kontent ilova ichida —
 * `ilova/src/content/speaking`), server uni faqat saqlaydi va teacherga ko'rsatadi.
 */
export interface SpeakingItem {
  /** Savol raqami (1..n) — ilovadagi tartib */
  no: number;
  /** Savol / topshiriq matni */
  q: string;
  /** O'quvchi avval yozib tayyorlagan javob */
  written: string | null;
  /** Ovoz yozuvi: /uploads/speaking/<fayl> */
  audioUrl: string | null;
  durationSec: number | null;
  /** O'quvchi yozganiga qarab gapirdimi («yashirilgan javob» ochilgan) */
  peeked: boolean;
  /** Necha marta qayta yozgan */
  retakes: number;
  /** 1..5 — o'qituvchi bahosi; null — hali baholanmagan */
  score: number | null;
  tags: string[];
  fixes: SpeakingFix[];
  /** Baholangandan keyin qayta topshirilgan */
  resubmitted: boolean;
}

export enum SpeakingStatus {
  /** Topshirilgan — o'qituvchi navbatida */
  pending = 'pending',
  graded = 'graded',
}

/**
 * SPEAKING ishi (2026-11): o'quvchi har savolga avval javob yozadi, keyin ovoz bilan aytadi,
 * o'qituvchi teacher panelda eshitib 1–5 ball, tuzatish va izoh qo'yadi.
 * Bitta o'quvchi + dars = bitta ish (qayta topshirilgan savollar shu yozuvda almashtiriladi).
 * Baho → `lesson_progress.speaking_score` (dars balli formulasiga kiradi) + coin + bildirishnoma.
 */
@Entity({ name: 'speaking_submissions' })
@Index(['userId', 'lessonId'], { unique: true })
@Index(['status', 'submittedAt'])
export class SpeakingSubmission extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  /** Ilovadagi kontent kaliti: "lesson5:speaking" */
  @Column({ type: 'varchar', length: 60, name: 'task_key' })
  taskKey: string;

  @Column({ type: 'varchar', length: 200, name: 'title', nullable: true })
  title: string | null;

  /** `questions` — savol-javob, `monologue` — bitta mavzuda gapirish */
  @Column({ type: 'varchar', length: 20, name: 'kind', default: 'questions' })
  kind: string;

  @Column({ type: 'varchar', length: 20, name: 'status', default: SpeakingStatus.pending })
  status: SpeakingStatus;

  @Column({ type: 'jsonb', name: 'items', default: () => `'[]'::jsonb` })
  items: SpeakingItem[];

  /** Umumiy izoh (matn) */
  @Column({ type: 'text', name: 'comment', nullable: true })
  comment: string | null;

  /** O'qituvchining ovozli izohi: /uploads/speaking/<fayl> */
  @Column({ type: 'varchar', name: 'comment_audio_url', nullable: true })
  commentAudioUrl: string | null;

  /** 0–100: savollar ballari o'rtachasi / 5 */
  @Column({ type: 'int', name: 'percent', nullable: true })
  percent: number | null;

  /** Shu ish uchun jami berilgan coin */
  @Column({ type: 'int', name: 'coins', default: 0 })
  coins: number;

  @Column({ type: 'timestamptz', name: 'submitted_at' })
  submittedAt: Date;

  @Column({ type: 'timestamptz', name: 'graded_at', nullable: true })
  gradedAt: Date | null;

  @Column({ type: 'uuid', name: 'graded_by', nullable: true })
  gradedBy: string | null;

  /** O'quvchi bahoni ko'rdi (ilovada «Yangi baho» belgisi o'chadi) */
  @Column({ type: 'timestamptz', name: 'seen_at', nullable: true })
  seenAt: Date | null;
}

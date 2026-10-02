import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

/**
 * STATIK mashqlar natijalari (yangi oqim).
 *
 * Mashq kontenti endi mobil ilova ichida statik saqlanadi — backend faqat
 * NATIJANI qabul qiladi. Har «Tekshirish» bosilishi = alohida yozuv
 * (urinishlar tarixi to'liq saqlanadi, teacher panel dinamikani ko'ra oladi).
 *
 * exerciseKey — ilova kodidagi barqaror kalit (masalan "lesson1:ex1").
 * clientAttemptId — ilova generatsiya qiladigan UUID: offline navbat ikki
 * marta yuborilsa ham (userId, clientAttemptId) unikal indeksi tufayli
 * dublikat yozilmaydi (ON CONFLICT DO NOTHING).
 */
@Entity({ name: 'exercise_results' })
@Index(['userId', 'clientAttemptId'], { unique: true })
@Index(['lessonId', 'exerciseKey'])
@Index(['userId', 'lessonId'])
export class ExerciseResult extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** topic_id — dars (backend lessons.id) */
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  /** Ilova kodidagi statik mashq kaliti, masalan "lesson1:ex1" */
  @Column({ type: 'varchar', length: 120, name: 'exercise_key' })
  exerciseKey: string;

  /** Nechinchi urinish (har «Tekshirish» bosilganda ilovada +1) */
  @Column({ type: 'int', name: 'attempt_number' })
  attemptNumber: number;

  /** Natija — har qanday mashq turida ham foizga keltiriladi (0–100) */
  @Column({ type: 'int', name: 'percent' })
  percent: number;

  /**
   * Nechta javob to'g'ri bo'ldi va mashqda jami nechta savol bor edi.
   *
   * Coin aynan shundan hisoblanadi (1 to'g'ri javob = 1 coin), shuning uchun
   * foizdan qayta hisoblash yetarli emas: 85% — 20 savolli mashqda 17 ta,
   * 13 savollida 11 ta. Eski ilova versiyalaridan bu maydonlarsiz yozuvlar
   * kelishi mumkin, shu bois nullable — bunday yozuv coin bermaydi.
   */
  @Column({ type: 'int', name: 'correct_count', nullable: true })
  correctCount: number | null;

  @Column({ type: 'int', name: 'total_count', nullable: true })
  totalCount: number | null;

  /**
   * Shu mashq TEGISHLI BO'LIMDA jami nechta mashq borligi (masalan 1-darsning
   * grammar bo'limida 4 ta). Kontent ilovada statik bo'lgani uchun backend buni
   * o'zi bilolmaydi — ilova har natija bilan birga aytib yuboradi va progress
   * shundan hisoblanadi (`done / section_total`).
   *
   * MAX() bilan o'qiladi: mavzuga yangi mashq qo'shilsa yangi yozuvlar kattaroq
   * son bilan keladi va jami o'z-o'zidan yangilanadi. Eski ilova versiyasidan
   * kelgan yozuvda NULL — u holda progress hisoblanmaydi (eski xatti-harakat).
   */
  @Column({ type: 'int', name: 'section_total', nullable: true })
  sectionTotal: number | null;

  /** Mashq qachon ishlangan (ilovadagi vaqt — offline'da keyin sync bo'ladi) */
  @Column({ type: 'timestamptz', name: 'answered_at' })
  answeredAt: Date;

  /** Idempotentlik kaliti — ilova generatsiya qiladi */
  @Column({ type: 'uuid', name: 'client_attempt_id' })
  clientAttemptId: string;
}

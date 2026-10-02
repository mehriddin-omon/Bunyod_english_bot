import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

/**
 * LUG'AT BOSQICHLARI — talabaning dars lug'ati bo'yicha bosqich progressi.
 *
 * Bir qator = talaba × dars × bosqich. Bosqichlar ketma-ket ochiladi
 * (qoidalar `VOCAB_STAGES` da, `vocabulary.service.ts`):
 *   1 — oddiy karta (flashcard), oxirigacha ko'rilsa o'tildi
 *   2 — variantli test, 80%+
 *   3 — eshitib topish (audio), 80%+
 *   4 — yozib yodlash (typing), 80%+
 *
 * `passed` bir marta `true` bo'lsa qaytib `false` bo'lmaydi — keyingi
 * urinishlar faqat `lastPercent` / `bestPercent` ni yangilaydi.
 */
@Entity({ name: 'vocabulary_stage_progress' })
@Index(['userId', 'lessonId', 'stage'], { unique: true })
export class VocabularyStageProgress extends BaseEntity {
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

  /** 1..4 */
  @Column({ type: 'smallint', name: 'stage' })
  stage: number;

  @Column({ type: 'int', name: 'attempts', default: 0 })
  attempts: number;

  @Column({ type: 'int', name: 'last_percent', default: 0 })
  lastPercent: number;

  @Column({ type: 'int', name: 'best_percent', default: 0 })
  bestPercent: number;

  @Column({ type: 'boolean', name: 'passed', default: false })
  passed: boolean;

  @Column({ type: 'timestamptz', name: 'passed_at', nullable: true })
  passedAt: Date | null;
}

import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';
import { LessonProgressStatus } from 'src/common/utils/enum';

@Entity({ name: 'lesson_progress' })
@Index(['userId', 'lessonId'], { unique: true })
export class LessonProgress extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  lesson: Lesson;

  @Column({ type: 'varchar', name: 'status', enum: LessonProgressStatus, default: LessonProgressStatus.not_started })
  status: LessonProgressStatus;

  @Column({ type: 'int', name: 'score', nullable: true })
  score: number | null;

  @Column({ type: 'int', name: 'grammar_score', nullable: true })
  grammarScore: number | null;

  @Column({ type: 'int', name: 'vocabulary_score', nullable: true })
  vocabularyScore: number | null;

  @Column({ type: 'int', name: 'listening_score', nullable: true })
  listeningScore: number | null;

  @Column({ type: 'int', name: 'reading_score', nullable: true })
  readingScore: number | null;

  @Column({ type: 'int', name: 'speaking_score', nullable: true })
  speakingScore: number | null;

  @Column({ type: 'int', name: 'time_spent_sec', default: 0 })
  timeSpentSec: number;

  @Column({ type: 'int', name: 'attempts', default: 1 })
  attempts: number;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;
}

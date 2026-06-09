import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from 'src/common/core/entitys/base.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { CurriculumLesson } from 'src/common/core/entitys/lesson.entity';
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

  @ManyToOne(() => CurriculumLesson, { onDelete: 'CASCADE' })
  lesson: CurriculumLesson;

  @Column({ type: 'varchar', name: 'status', enum: LessonProgressStatus, default: LessonProgressStatus.not_started })
  status: LessonProgressStatus;

  @Column({ type: 'integer', name: 'progress', default: 0, comment: '0–100' })
  progress: number;

  @Column({ type: 'integer', name: 'score', nullable: true })
  score?: number;

  @Column({ type: 'integer', name: 'total_questions', nullable: true })
  totalQuestions?: number;

  @Column({ type: 'integer', name: 'correct_answers', nullable: true })
  correctAnswers?: number;

  @Column({ type: 'integer', name: 'time_spent_sec', default: 0 })
  timeSpentSec: number;

  @Column({ type: 'integer', name: 'attempts', default: 1 })
  attempts: number;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt?: Date;
}

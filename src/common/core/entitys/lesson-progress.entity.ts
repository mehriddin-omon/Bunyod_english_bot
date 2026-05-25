import { Entity, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/common/core/entitys/base.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';

@Entity({ name: 'lesson_progress' })
@Index(['userId', 'lessonId'])
export class LessonProgress extends BaseEntity {
  @Column({
    type: 'uuid',
    name: 'user_id',
  })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'uuid',
    name: 'lesson_id',
  })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  lesson: Lesson;

  @Column({
    type: 'integer',
    name: 'progress',
    default: 0,
  })
  progress: number;

  @Column({
    type: 'integer',
    name: 'score',
    nullable: true,
  })
  score?: number;

  @Column({
    type: 'integer',
    name: 'total_questions',
    nullable: true,
  })
  totalQuestions?: number;

  @Column({
    type: 'integer',
    name: 'correct_answers',
    nullable: true,
  })
  correctAnswers?: number;

  @CreateDateColumn({
    name: 'completed_at',
    nullable: true,
  })
  completedAt?: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    nullable: true,
  })
  updatedAt?: Date;
}

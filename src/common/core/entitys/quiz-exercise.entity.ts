import { Column, Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { QuizContent } from './quiz-content.entity';
import { QuizItem } from './quiz-item.entity';

@Entity({ name: 'quiz_exercises' })
export class QuizExercise extends BaseEntity {
  @Column({ type: 'uuid', name: 'quiz_id' })
  quizId: string;

  @ManyToOne(() => QuizContent, (q) => q.exercises, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: QuizContent;

  @Column({ type: 'varchar', name: 'title', nullable: true })
  title: string | null;

  @Column({ type: 'text', name: 'instructions', nullable: true })
  instructions: string | null;

  @Column({ type: 'varchar', name: 'exercise_type' })
  exerciseType: string; // 'matching' | 'fill_in_blank' | 'multiple_choice'

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @OneToMany(() => QuizItem, (i) => i.exercise, { cascade: true })
  items: QuizItem[];
}

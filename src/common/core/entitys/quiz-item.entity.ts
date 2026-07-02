import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { QuizExercise } from './quiz-exercise.entity';

@Entity({ name: 'quiz_items' })
export class QuizItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'exercise_id' })
  exerciseId: string;

  @ManyToOne(() => QuizExercise, (e) => e.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exercise_id' })
  exercise: QuizExercise;

  @Column({ type: 'text', name: 'item_text' })
  itemText: string;

  @Column({ type: 'varchar', name: 'correct_answer' })
  correctAnswer: string;

  @Column({ type: 'text', name: 'options', nullable: true })
  options: string | null; // JSON: faqat multiple_choice uchun ["am","is","are"]

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

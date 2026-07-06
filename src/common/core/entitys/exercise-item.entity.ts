import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Exercise } from './exercise.entity';

/** 3.3: oddiy satrlar massivi YOKI obyektlar massivi */
export type ExerciseOption =
  string |
  {
    text: string;
    isCorrect?: boolean;
    imageUrl?: string | null;
    matchKey?: string | null
  };

@Entity({ name: 'exercise_items' })
export class ExerciseItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'exercise_id' })
  exerciseId: string;

  @ManyToOne(() => Exercise, (e) => e.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exercise_id' })
  exercise: Exercise;

  /** gap / savol matni / o'zbekcha gap (translation) */
  @Column({ type: 'text', name: 'item_text' })
  itemText: string;

  /** to'g'ri javob / 'true'|'false' / model tarjima */
  @Column({ type: 'varchar', name: 'correct_answer' })
  correctAnswer: string;

  @Column({ type: 'jsonb', name: 'options', nullable: true })
  options: ExerciseOption[] | null;

  /** listening savollaridagi rasm (savol darajasida) */
  @Column({ type: 'varchar', name: 'image_url', nullable: true })
  imageUrl: string | null;

  /** correct_explanation (reading/listeningdan ko'chadi) */
  @Column({ type: 'text', name: 'explanation', nullable: true })
  explanation: string | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

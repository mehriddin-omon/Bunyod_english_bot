import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ReadingQuestion } from './reading-question.entity';

@Entity({ name: 'reading_options' })
export class ReadingOption extends BaseEntity {
  @Column({ type: 'uuid', name: 'question_id' })
  questionId: string;

  @ManyToOne(() => ReadingQuestion, (q) => q.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: ReadingQuestion;

  @Column({ type: 'text', name: 'option_text' })
  optionText: string;

  @Column({ type: 'boolean', name: 'is_correct', default: false })
  isCorrect: boolean;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

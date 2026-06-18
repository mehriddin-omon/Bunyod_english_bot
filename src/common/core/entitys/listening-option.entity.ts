import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ListeningQuestion } from './listening-question.entity';

@Entity({ name: 'listening_options' })
export class ListeningOption extends BaseEntity {
  @Column({ type: 'uuid', name: 'question_id' })
  questionId: string;

  @ManyToOne(() => ListeningQuestion, (q) => q.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: ListeningQuestion;

  @Column({ type: 'text', name: 'option_text' })
  optionText: string;

  @Column({ type: 'boolean', name: 'is_correct', default: false })
  isCorrect: boolean;

  @Column({ type: 'varchar', name: 'image_url', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', name: 'match_key', nullable: true })
  matchKey: string | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

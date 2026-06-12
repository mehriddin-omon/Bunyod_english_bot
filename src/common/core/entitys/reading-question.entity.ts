import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ReadingContent } from './reading-content.entity';
import { ReadingOption } from './reading-option.entity';
import { QuestionType } from 'src/common/utils/enum';

@Entity({ name: 'reading_questions' })
export class ReadingQuestion extends BaseEntity {
  @Column({ type: 'uuid', name: 'reading_id' })
  readingId: string;

  @ManyToOne(() => ReadingContent, (r) => r.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reading_id' })
  readingContent: ReadingContent;

  @Column({ type: 'text', name: 'question_text' })
  questionText: string;

  @Column({ type: 'varchar', name: 'question_type', enum: QuestionType })
  questionType: QuestionType;

  @Column({ type: 'text', name: 'correct_explanation', nullable: true })
  correctExplanation: string | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @OneToMany(() => ReadingOption, (o) => o.question, { cascade: true })
  options: ReadingOption[];
}

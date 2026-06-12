import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ListeningContent } from './listening-content.entity';
import { ListeningOption } from './listening-option.entity';
import { QuestionType } from 'src/common/utils/enum';

@Entity({ name: 'listening_questions' })
export class ListeningQuestion extends BaseEntity {
  @Column({ type: 'uuid', name: 'listening_id' })
  listeningId: string;

  @ManyToOne(() => ListeningContent, (l) => l.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listening_id' })
  listeningContent: ListeningContent;

  @Column({ type: 'text', name: 'question_text' })
  questionText: string;

  @Column({ type: 'varchar', name: 'question_type', enum: QuestionType })
  questionType: QuestionType;

  @Column({ type: 'text', name: 'correct_explanation', nullable: true })
  correctExplanation: string | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @OneToMany(() => ListeningOption, (o) => o.question, { cascade: true })
  options: ListeningOption[];
}

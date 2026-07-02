import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { QuizItem } from './quiz-item.entity';
import { QuizContent } from './quiz-content.entity';

@Entity({ name: 'quiz_student_answers' })
@Index(['userId', 'itemId'], { unique: true })
export class QuizStudentAnswer extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'item_id' })
  itemId: string;

  @ManyToOne(() => QuizItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: QuizItem;

  @Column({ type: 'uuid', name: 'quiz_id' })
  quizId: string;

  @ManyToOne(() => QuizContent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: QuizContent;

  @Column({ type: 'varchar', name: 'given_answer' })
  givenAnswer: string;

  @Column({ type: 'boolean', name: 'is_correct', default: false })
  isCorrect: boolean;

  @Column({ type: 'timestamptz', name: 'answered_at', default: () => 'now()' })
  answeredAt: Date;
}

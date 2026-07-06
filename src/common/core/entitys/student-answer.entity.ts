import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';
import { StudentAnswerBlockType } from '../../utils/enum';

/**
 * Barcha blok turlari (quiz, reading, listening, ...) uchun yagona
 * savol-darajasidagi student javoblari jadvali.
 * questionId polimorf: quiz_items.id / reading_questions.id / listening_questions.id
 */
@Entity({ name: 'student_answers' })
@Index(['userId', 'blockType', 'questionId'], { unique: true })
export class StudentAnswer extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({
    type: 'enum',
    enum: StudentAnswerBlockType,
    enumName: 'student_answer_block_type_enum',
    name: 'block_type',
  })
  blockType: StudentAnswerBlockType;

  /** Blok (content) idsi: quiz_contents / reading_contents / listening_contents */
  @Column({ type: 'uuid', name: 'block_id' })
  blockId: string;

  /** Savol idsi (polimorf, FK yo'q) */
  @Column({ type: 'uuid', name: 'question_id' })
  questionId: string;

  @Column({ type: 'text', name: 'given_answer' })
  givenAnswer: string;

  @Column({ type: 'boolean', name: 'is_correct', default: false })
  isCorrect: boolean;

  @Column({ type: 'timestamptz', name: 'answered_at', default: () => 'now()' })
  answeredAt: Date;
}

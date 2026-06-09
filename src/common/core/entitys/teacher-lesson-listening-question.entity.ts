import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonListening } from './teacher-lesson-listening.entity';

@Entity({ name: 'lesson_listening_questions' })
export class LessonListeningQuestion extends BaseEntity {
  @Column({ type: 'uuid', name: 'listening_id' })
  listeningId: string;

  @ManyToOne(() => LessonListening, (l) => l.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listening_id' })
  listening: LessonListening;

  @Column({ type: 'varchar', name: 'type' })
  type: 'mcq' | 'true_false';

  @Column({ type: 'text', name: 'question' })
  question: string;

  @Column({ type: 'simple-array', name: 'options', nullable: true })
  options: string[] | null;

  @Column({ type: 'varchar', name: 'correct_answer' })
  correctAnswer: string;

  @Column({ type: 'text', name: 'explanation', nullable: true })
  explanation: string | null;

  @Column({ type: 'int', name: 'order', default: 0 })
  order: number;
}

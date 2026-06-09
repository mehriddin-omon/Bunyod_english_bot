import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonReading } from './teacher-lesson-reading.entity';

@Entity({ name: 'lesson_reading_questions' })
export class LessonReadingQuestion extends BaseEntity {
  @Column({ type: 'uuid', name: 'reading_id' })
  readingId: string;

  @ManyToOne(() => LessonReading, (r) => r.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reading_id' })
  reading: LessonReading;

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

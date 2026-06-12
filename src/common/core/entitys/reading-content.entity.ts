import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './lesson.entity';
import { ReadingQuestion } from './reading-question.entity';

@Entity({ name: 'reading_contents' })
export class ReadingContent extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'text', name: 'text_content' })
  textContent: string;

  @Column({ type: 'int', name: 'word_count', nullable: true })
  wordCount: number | null;

  @Column({ type: 'int', name: 'reading_time_minutes', nullable: true })
  readingTimeMinutes: number | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @OneToMany(() => ReadingQuestion, (q) => q.readingContent, { cascade: true })
  questions: ReadingQuestion[];
}

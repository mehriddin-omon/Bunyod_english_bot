import { Column, Entity, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonBlock } from './teacher-lesson-block.entity';
import { LessonReadingQuestion } from './teacher-lesson-reading-question.entity';

@Entity({ name: 'lesson_readings' })
export class LessonReading extends BaseEntity {
  @Column({ type: 'uuid', name: 'block_id', unique: true })
  blockId: string;

  @OneToOne(() => LessonBlock, (b) => b.readingBlock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' })
  block: LessonBlock;

  @Column({ type: 'varchar', name: 'title', default: '' })
  title: string;

  @Column({ type: 'varchar', name: 'author', nullable: true })
  author: string | null;

  @Column({ type: 'text', name: 'text', default: '' })
  text: string;

  @Column({ type: 'int', name: 'word_count', nullable: true })
  wordCount: number | null;

  @Column({ type: 'int', name: 'read_time_minutes', nullable: true })
  readTimeMinutes: number | null;

  @Column({ type: 'varchar', name: 'cefr_level', nullable: true })
  cefrLevel: string | null;

  @Column({ type: 'jsonb', name: 'highlights', default: [] })
  highlights: { word: string; type: 'past_simple' | 'past_continuous' | 'new_word' }[];

  @OneToMany(() => LessonReadingQuestion, (q) => q.reading, { cascade: true })
  questions: LessonReadingQuestion[];
}

import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './lesson.entity';

// Eslatma: savollar endi Exercise/ExerciseItem da, owner_block_type='reading' +
// owner_block_id=reading_contents.id orqali (polimorf) — qarang: exercise.entity.ts.
@Entity({ name: 'reading_contents' })
export class ReadingContent extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'varchar', name: 'author', nullable: true })
  author: string | null;

  @Column({ type: 'text', name: 'text_content' })
  textContent: string;

  @Column({ type: 'varchar', name: 'cefr_level', nullable: true })
  cefrLevel: string | null;

  // Teacher UI dagi so'z belgilashlari: [{ word, type }]
  @Column({ type: 'jsonb', name: 'highlights', nullable: true })
  highlights: { word: string; type: string }[] | null;

  @Column({ type: 'int', name: 'word_count', nullable: true })
  wordCount: number | null;

  @Column({ type: 'int', name: 'reading_time_minutes', nullable: true })
  readingTimeMinutes: number | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

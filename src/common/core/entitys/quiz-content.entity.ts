import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './lesson.entity';

// Eslatma: mashqlar (Exercise) endi FK relation orqali emas, balki
// owner_block_type='quiz' + owner_block_id=quiz_contents.id (polimorf) orqali
// bog'lanadi — qarang: exercise.entity.ts, quiz.md 3.1.
@Entity({ name: 'quiz_contents' })
export class QuizContent extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ type: 'varchar', name: 'title', default: 'Quiz' })
  title: string;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

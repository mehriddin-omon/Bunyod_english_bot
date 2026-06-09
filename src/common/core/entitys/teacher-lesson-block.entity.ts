import { Column, Entity, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './teacher-lesson.entity';
import { LessonVocab } from './teacher-lesson-vocab.entity';
import { LessonReading } from './teacher-lesson-reading.entity';
import { LessonListening } from './teacher-lesson-listening.entity';
import { LessonSpeaking } from './teacher-lesson-speaking.entity';

@Entity({ name: 'lesson_blocks' })
export class LessonBlock extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, (l) => l.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ type: 'varchar', name: 'type' })
  type: 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'speaking' | 'quiz';

  @Column({ type: 'int', name: 'order', default: 0 })
  order: number;

  @Column({ type: 'uuid', name: 'grammar_id', nullable: true })
  grammarId: string | null;

  @OneToOne(() => LessonVocab, (v) => v.block, { nullable: true, cascade: true, eager: false })
  vocabBlock: LessonVocab | null;

  @OneToOne(() => LessonReading, (r) => r.block, { nullable: true, cascade: true, eager: false })
  readingBlock: LessonReading | null;

  @OneToOne(() => LessonListening, (l) => l.block, { nullable: true, cascade: true, eager: false })
  listeningBlock: LessonListening | null;

  @OneToOne(() => LessonSpeaking, (s) => s.block, { nullable: true, cascade: true, eager: false })
  speakingBlock: LessonSpeaking | null;
}

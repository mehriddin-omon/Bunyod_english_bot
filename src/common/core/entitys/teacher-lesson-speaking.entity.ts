import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonBlock } from './teacher-lesson-block.entity';

@Entity({ name: 'lesson_speakings' })
export class LessonSpeaking extends BaseEntity {
  @Column({ type: 'uuid', name: 'block_id', unique: true })
  blockId: string;

  @OneToOne(() => LessonBlock, (b) => b.speakingBlock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' })
  block: LessonBlock;

  @Column({ type: 'varchar', name: 'title', nullable: true })
  title: string | null;

  @Column({ type: 'text', name: 'instructions', nullable: true })
  instructions: string | null;

  @Column({ type: 'simple-array', name: 'topics', nullable: true })
  topics: string[] | null;

  @Column({ type: 'simple-array', name: 'examples', nullable: true })
  examples: string[] | null;

  @Column({ type: 'int', name: 'duration_minutes', nullable: true })
  durationMinutes: number | null;
}

import { Column, Entity, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonBlock } from './teacher-lesson-block.entity';
import { LessonListeningQuestion } from './teacher-lesson-listening-question.entity';

@Entity({ name: 'lesson_listenings' })
export class LessonListening extends BaseEntity {
  @Column({ type: 'uuid', name: 'block_id', unique: true })
  blockId: string;

  @OneToOne(() => LessonBlock, (b) => b.listeningBlock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' })
  block: LessonBlock;

  @Column({ type: 'varchar', name: 'title', default: '' })
  title: string;

  @Column({ type: 'varchar', name: 'audio_url', nullable: true })
  audioUrl: string | null;

  @Column({ type: 'int', name: 'duration', nullable: true })
  duration: number | null;

  @Column({ type: 'varchar', name: 'track_code', nullable: true })
  trackCode: string | null;

  @Column({ type: 'jsonb', name: 'speakers', default: [] })
  speakers: { id: string; name: string }[];

  @Column({ type: 'jsonb', name: 'transcript', default: [] })
  transcript: { speaker: string; timeStart: number; text: string }[];

  @OneToMany(() => LessonListeningQuestion, (q) => q.listening, { cascade: true })
  questions: LessonListeningQuestion[];
}

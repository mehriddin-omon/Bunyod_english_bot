import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './lesson.entity';
import { ListeningTranscript } from './listening-transcript.entity';

// Eslatma: savollar endi Exercise/ExerciseItem da, owner_block_type='listening' +
// owner_block_id=listening_contents.id orqali (polimorf) — qarang: exercise.entity.ts.
@Entity({ name: 'listening_contents' })
export class ListeningContent extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'varchar', name: 'file_id' })
  fileId: string;

  @Column({ type: 'int', name: 'duration_seconds', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'varchar', name: 'track_code', nullable: true })
  trackCode: string | null;

  @Column({ type: 'jsonb', name: 'speakers', nullable: true })
  speakers: { label: string; name: string }[] | null;

  @Column({ type: 'varchar', name: 'image_url', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @OneToMany(() => ListeningTranscript, (t) => t.listeningContent, { cascade: true })
  transcripts: ListeningTranscript[];
}

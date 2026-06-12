import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ListeningContent } from './listening-content.entity';

@Entity({ name: 'listening_transcripts' })
export class ListeningTranscript extends BaseEntity {
  @Column({ type: 'uuid', name: 'listening_id' })
  listeningId: string;

  @ManyToOne(() => ListeningContent, (l) => l.transcripts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listening_id' })
  listeningContent: ListeningContent;

  @Column({ type: 'varchar', name: 'speaker_name', nullable: true })
  speakerName: string | null;

  @Column({ type: 'float', name: 'timestamp_sec', nullable: true })
  timestampSec: number | null;

  @Column({ type: 'text', name: 'text_content' })
  textContent: string;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

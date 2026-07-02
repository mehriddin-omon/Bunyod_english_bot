import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { VocabularyRelation } from './vocabulary-relation.entity';

export enum VocabStatus {
  new      = 'new',
  learning = 'learning',
  mastered = 'mastered',
}

@Entity({ name: 'user_vocabulary_progress' })
@Index(['userId', 'pairId'], { unique: true })
export class UserVocabularyProgress extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'pair_id' })
  pairId: string;

  @ManyToOne(() => VocabularyRelation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: VocabularyRelation;

  @Column({ type: 'varchar', name: 'status', enum: VocabStatus, default: VocabStatus.new })
  status: VocabStatus;

  @Column({ type: 'int', name: 'attempts', default: 0 })
  attempts: number;

  @Column({ type: 'int', name: 'wrong_attempts', default: 0 })
  wrongAttempts: number;

  @Column({ type: 'timestamptz', name: 'next_review_at', nullable: true })
  nextReviewAt: Date | null;
}

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

  /**
   * SRS pog'onasi (2026-11, «Lenta»): 0 → +1 kun, 1 → +3, 2 → +7, 3 → +30,
   * 4 — uzoq muddatli (next_review_at = null). «Eslay olmadim» → 0.
   */
  @Column({ type: 'int', name: 'srs_step', default: 0 })
  srsStep: number;

  /** Tanishuv (shorts) da birinchi marta ko'rilgan payt */
  @Column({ type: 'timestamptz', name: 'seen_at', nullable: true })
  seenAt: Date | null;

  /** Oxirgi takror (Lenta «Esladim / Eslay olmadim») */
  @Column({ type: 'timestamptz', name: 'last_reviewed_at', nullable: true })
  lastReviewedAt: Date | null;

  /** «O'sish nuqtalari» dan chiqarilgan (3 pog'onadan xatosiz o'tdi) */
  @Column({ type: 'boolean', name: 'growth_cleared', default: false })
  growthCleared: boolean;
}

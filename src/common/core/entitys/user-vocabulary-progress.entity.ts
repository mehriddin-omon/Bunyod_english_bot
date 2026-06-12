import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Vocabulary } from './vocabulary.entity';
import { VocabStatus } from 'src/common/utils/enum';

@Entity({ name: 'user_vocabulary_progress' })
@Index(['userId', 'vocabularyId'], { unique: true })
export class UserVocabularyProgress extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'vocabulary_id' })
  vocabularyId: string;

  @ManyToOne(() => Vocabulary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vocabulary_id' })
  vocabulary: Vocabulary;

  @Column({ type: 'varchar', name: 'status', enum: VocabStatus, default: VocabStatus.new })
  status: VocabStatus;

  @Column({ type: 'int', name: 'strength', default: 0 })
  strength: number;

  @Column({ type: 'int', name: 'attempts', default: 0 })
  attempts: number;

  @Column({ type: 'int', name: 'wrong_attempts', default: 0 })
  wrongAttempts: number;

  @Column({ type: 'boolean', name: 'is_hard', default: false })
  isHard: boolean;

  @Column({ type: 'timestamptz', name: 'last_reviewed_at', nullable: true })
  lastReviewedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'next_review_at', nullable: true })
  nextReviewAt: Date | null;
}

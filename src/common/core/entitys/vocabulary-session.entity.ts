import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity({ name: 'vocabulary_sessions' })
@Index(['userId', 'createdAt'])
export class VocabularySession extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', name: 'completed_count', default: 0 })
  completedCount: number;

  @Column({ type: 'int', name: 'time_spent_sec', default: 0 })
  timeSpentSec: number;
}

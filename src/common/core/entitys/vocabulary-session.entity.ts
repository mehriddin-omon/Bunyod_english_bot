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

  /** Bosqichli sessiya bo'lsa — qaysi dars lug'ati (aks holda null) */
  @Column({ type: 'uuid', name: 'lesson_id', nullable: true })
  lessonId: string | null;

  /** Lug'at bosqichi (1..4); filtr bo'yicha oddiy takrorlashda null */
  @Column({ type: 'smallint', name: 'stage', nullable: true })
  stage: number | null;

  /** Sessiyada nechta karta berilgan — bosqich foizi shunga nisbatan hisoblanadi */
  @Column({ type: 'int', name: 'total_cards', default: 0 })
  totalCards: number;
}

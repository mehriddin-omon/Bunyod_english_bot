import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { VocabularyRelation } from './vocabulary-relation.entity';

/**
 * SAQLANGAN SO'ZLAR (2026-11) — o'quvchi shorts / qidiruvda «Saqlash» bosgan
 * so'zlar. Serverda saqlanadi (qurilma almashsa ham yo'qolmaydi). Coin yo'q.
 */
@Entity({ name: 'vocabulary_saved' })
@Index(['userId', 'pairId'], { unique: true })
export class VocabularySaved extends BaseEntity {
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
}

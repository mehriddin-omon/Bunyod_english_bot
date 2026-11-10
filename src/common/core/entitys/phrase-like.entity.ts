import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Phrase } from './phrase.entity';

/**
 * IBORA like'i — izoh like'idan BUTUNLAY alohida sanoq.
 * Bitta o'quvchi bitta iboraga 1 marta bosadi, qayta bosilsa yozuv o'chadi.
 */
@Entity({ name: 'phrase_likes' })
@Index(['phraseId', 'userId'], { unique: true })
@Index(['userId'])
export class PhraseLike extends BaseEntity {
  @Column({ type: 'uuid', name: 'phrase_id' })
  phraseId: string;

  @ManyToOne(() => Phrase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phrase_id' })
  phrase: Phrase;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

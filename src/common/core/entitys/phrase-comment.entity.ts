import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Phrase } from './phrase.entity';

/**
 * active — hammaga ko'rinadi
 * hidden — teacher yashirgan yoki 3 ta xabar kelgani uchun avtomatik yashirilgan
 */
export type PhraseCommentStatus = 'active' | 'hidden';

/**
 * IBORA IZOHI — «Siz bu iborani qay holatda ishlatgansiz yoki ishlatar edingiz?»
 * degan savolning javobi.
 *
 * Kartada FAQAT 1 ta izoh ko'rinadi: eng ko'p like olgani, like'lar teng bo'lsa
 * ENG AVVAL yozilgani (`ORDER BY like_count DESC, created_at ASC`).
 * Coin berilmaydi (lug'at izohlaridan farqi — bu yerda like faqat tartib uchun).
 */
@Entity({ name: 'phrase_comments' })
@Index(['phraseId', 'status', 'likeCount'])
@Index(['userId'])
export class PhraseComment extends BaseEntity {
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

  @Column({ type: 'text', name: 'body' })
  body: string;

  @Column({ type: 'varchar', length: 16, name: 'status', default: 'active' })
  status: PhraseCommentStatus;

  @Column({ type: 'int', name: 'like_count', default: 0 })
  likeCount: number;

  @Column({ type: 'int', name: 'report_count', default: 0 })
  reportCount: number;
}

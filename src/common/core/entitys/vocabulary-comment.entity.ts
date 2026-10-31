import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { VocabularyRelation } from './vocabulary-relation.entity';

/** Izoh turi: mnemonika · misol gap · yangi ma'no taklifi */
export type VocabularyCommentKind = 'mnemonic' | 'sentence' | 'meaning';

/**
 * active   — hammaga ko'rinadi, like oladi
 * pending  — yangi ma'no taklifi, teacher tasdiqlamaguncha like/coin hisoblanmaydi
 * rejected — teacher rad etgan (faqat muallifga ko'rinadi)
 * hidden   — teacher yashirgan yoki 3 ta xabar kelgani uchun avtomatik yashirilgan
 */
export type VocabularyCommentStatus = 'active' | 'pending' | 'rejected' | 'hidden';

/**
 * LUG'AT IZOHI (talabalar yozadi: mnemonika, misol gap, yangi ma'no).
 *
 * Izoh JUFTLIKKA (book–kitob) emas, INGLIZCHA SO'ZGA bog'lanadi (`word_key`):
 * lug'at almashtirilib juftlik o'chsa ham izoh yo'qolmaydi, "book" ning hamma
 * ma'nolari bitta joyda yig'iladi. Ma'no (`meaning_key`) — ixtiyoriy yorliq:
 * o'zbekcha tarjimaning kichik harfdagi matni (juftlik id'siga emas — id lug'at
 * almashtirilganda o'zgaradi).
 *
 * COIN: izoh 10 like'ga yetganda +1, 100 da +1, 1000 da +1 … (cheklovsiz).
 * Hisob `VocabularyCommentsService` da, coin `XpService` orqali (bir martalik kalit).
 */
@Entity({ name: 'vocabulary_comments' })
@Index(['wordKey', 'status'])
@Index(['userId', 'wordKey'])
export class VocabularyComment extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** inglizcha so'z, kichik harf, trim — guruhlash kaliti */
  @Column({ type: 'varchar', length: 120, name: 'word_key' })
  wordKey: string;

  /** ko'rsatish uchun asl yozuv */
  @Column({ type: 'varchar', length: 120, name: 'word_text' })
  wordText: string;

  @Column({ type: 'varchar', length: 16, name: 'kind' })
  kind: VocabularyCommentKind;

  /** izoh matni (mnemonika / gap). `meaning` turida — misol gap */
  @Column({ type: 'text', name: 'body' })
  body: string;

  /** ma'no yorlig'i (o'zbekcha tarjima); `meaning` turida — taklif qilingan yangi ma'no */
  @Column({ type: 'varchar', length: 160, name: 'meaning_text', nullable: true })
  meaningText: string | null;

  @Column({ type: 'varchar', length: 160, name: 'meaning_key', nullable: true })
  meaningKey: string | null;

  /** yozilgan paytdagi juftlik (ma'lumot uchun; o'chsa NULL — izoh qoladi) */
  @Column({ type: 'uuid', name: 'pair_id', nullable: true })
  pairId: string | null;

  @ManyToOne(() => VocabularyRelation, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pair_id' })
  pair: VocabularyRelation | null;

  @Column({ type: 'varchar', length: 16, name: 'status', default: 'active' })
  status: VocabularyCommentStatus;

  @Column({ type: 'int', name: 'like_count', default: 0 })
  likeCount: number;

  /** nechta bosqich (10/100/1000…) uchun coin berilgan */
  @Column({ type: 'int', name: 'coins_awarded', default: 0 })
  coinsAwarded: number;

  @Column({ type: 'int', name: 'report_count', default: 0 })
  reportCount: number;

  @Column({ type: 'boolean', name: 'pinned', default: false })
  pinned: boolean;

  @Column({ type: 'varchar', length: 200, name: 'moderation_note', nullable: true })
  moderationNote: string | null;
}

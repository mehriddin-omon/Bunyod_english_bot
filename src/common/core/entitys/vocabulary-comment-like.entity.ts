import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { VocabularyComment } from './vocabulary-comment.entity';

/** Bitta talaba bitta izohga FAQAT 1 marta like bosadi (+1) — (comment_id, user_id) UNIQUE. */
@Entity({ name: 'vocabulary_comment_likes' })
@Index(['commentId', 'userId'], { unique: true })
@Index(['userId'])
export class VocabularyCommentLike extends BaseEntity {
  @Column({ type: 'uuid', name: 'comment_id' })
  commentId: string;

  @ManyToOne(() => VocabularyComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: VocabularyComment;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

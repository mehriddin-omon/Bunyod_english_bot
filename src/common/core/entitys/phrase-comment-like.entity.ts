import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { PhraseComment } from './phrase-comment.entity';

/** IZOH like'i — ibora like'idan alohida. Bitta o'quvchi bitta izohga 1 marta. */
@Entity({ name: 'phrase_comment_likes' })
@Index(['commentId', 'userId'], { unique: true })
@Index(['userId'])
export class PhraseCommentLike extends BaseEntity {
  @Column({ type: 'uuid', name: 'comment_id' })
  commentId: string;

  @ManyToOne(() => PhraseComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: PhraseComment;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

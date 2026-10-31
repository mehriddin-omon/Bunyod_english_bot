import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { VocabularyComment } from './vocabulary-comment.entity';

/** Izoh haqida xabar. Bir talaba bir izohga bitta xabar; teacher ko'rib chiqqach `resolved = true`. */
@Entity({ name: 'vocabulary_comment_reports' })
@Index(['commentId', 'userId'], { unique: true })
export class VocabularyCommentReport extends BaseEntity {
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

  @Column({ type: 'varchar', length: 200, name: 'reason', nullable: true })
  reason: string | null;

  @Column({ type: 'boolean', name: 'resolved', default: false })
  resolved: boolean;
}

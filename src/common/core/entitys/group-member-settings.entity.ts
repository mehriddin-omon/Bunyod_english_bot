import { Column, Entity, ManyToOne, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

@Entity({ name: 'group_member_settings' })
@Index(['groupId', 'userId'], { unique: true })
export class GroupMemberSettings extends BaseEntity {
  @Column({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'boolean', name: 'is_free', default: false })
  isFree: boolean;

  @Column({ type: 'int', name: 'manual_unlock_ceiling', nullable: true })
  manualUnlockCeiling: number | null;
}

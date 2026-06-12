import { Entity, Column, ManyToMany, ManyToOne, JoinTable } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GroupStatus } from 'src/common/utils/enum';

@Entity({ name: 'groups' })
export class Group extends BaseEntity {
  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'varchar', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', name: 'color', nullable: true })
  color: string | null;

  @Column({ type: 'uuid', name: 'teacher_id', nullable: true })
  teacherId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  teacher: User | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @Column({ type: 'varchar', name: 'status', enum: GroupStatus, default: GroupStatus.active })
  status: GroupStatus;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'group_members',
    joinColumn: { name: 'group_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  members: User[];
}

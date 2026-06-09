import { Entity, Column, ManyToMany, ManyToOne, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/core/entitys/base.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { GroupStatus } from 'src/common/utils/enum';

@Entity({ name: 'groups' })
export class Group extends BaseEntity {
  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'varchar', name: 'description', nullable: true })
  description?: string;

  @Column({ type: 'varchar', name: 'color', nullable: true })
  color?: string;

  @Column({ type: 'varchar', name: 'cefr_level', nullable: true })
  cefrLevel?: string;

  @Column({ type: 'int', name: 'max_students', nullable: true })
  maxStudents?: number;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate?: string;

  @Column({ type: 'uuid', name: 'teacher_id', nullable: true })
  teacherId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  teacher?: User;

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

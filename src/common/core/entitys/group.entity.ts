import { Entity, Column, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from 'src/common/core/entitys/base.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';

@Entity({ name: 'groups' })
export class Group extends BaseEntity {
  @Column({
    type: 'varchar',
    name: 'name',
  })
  name: string;

  @Column({
    type: 'varchar',
    name: 'description',
    nullable: true,
  })
  description?: string;

  @Column({
    type: 'uuid',
    name: 'created_by',
  })
  createdBy: string;

  @ManyToMany(() => User, (user) => user.groups, { cascade: true, onDelete: 'CASCADE' })
  @JoinTable({
    name: 'group_members',
    joinColumn: { name: 'group_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  members: User[];

  @ManyToMany(() => Lesson, { cascade: true, onDelete: 'CASCADE' })
  @JoinTable({
    name: 'group_lessons',
    joinColumn: { name: 'group_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'lesson_id', referencedColumnName: 'id' },
  })
  lessons: Lesson[];
}

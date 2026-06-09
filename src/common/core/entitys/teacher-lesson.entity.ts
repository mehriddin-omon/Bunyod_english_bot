import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';
import { LessonBlock } from './teacher-lesson-block.entity';

@Entity({ name: 'lessons' })
export class Lesson extends BaseEntity {
  @Column({ type: 'uuid', name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'varchar', name: 'lesson_code', nullable: true })
  lessonCode: string | null;

  @Column({ type: 'int', name: 'unit_number', nullable: true })
  unitNumber: number | null;

  @Column({ type: 'varchar', name: 'cefr_level', nullable: true })
  cefrLevel: string | null;

  @Column({ type: 'varchar', name: 'status', default: 'draft' })
  status: 'draft' | 'published' | 'scheduled';

  @Column({ type: 'uuid', name: 'group_id', nullable: true })
  groupId: string | null;

  @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @OneToMany(() => LessonBlock, (b) => b.lesson, { cascade: ['insert', 'update', 'remove'] })
  blocks: LessonBlock[];
}

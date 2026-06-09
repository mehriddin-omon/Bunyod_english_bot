import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CurriculumLesson } from './lesson.entity';
import { LessonStatus } from 'src/common/utils/enum';

@Entity({ name: 'units' })
export class Unit extends BaseEntity {
  @Column({ type: 'int', name: 'number', unique: true })
  number: number;

  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ type: 'varchar', name: 'status', enum: LessonStatus, default: LessonStatus.draft })
  status: LessonStatus;

  @OneToMany(() => CurriculumLesson, (lesson) => lesson.unit)
  lessons: CurriculumLesson[];
}

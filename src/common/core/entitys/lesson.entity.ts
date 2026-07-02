import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonStatus } from 'src/common/utils/enum';
import { Unit } from './unit.entity';
import { Group } from './group.entity';

@Entity({ name: 'lessons' })
export class Lesson extends BaseEntity {
  @Column({ type: 'varchar', name: 'lesson_name' })
  lessonName: string;

  @Column({ type: 'varchar', name: 'cefr_level', nullable: true })
  cefrLevel: string | null;

  @Column({ type: 'uuid', name: 'group_id', nullable: true })
  groupId: string | null;

  @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ type: 'uuid', name: 'unit_id', nullable: true })
  unitId: string | null;

  @ManyToOne(() => Unit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ type: 'varchar', name: 'status', enum: LessonStatus, default: LessonStatus.draft })
  status: LessonStatus;

  @Column({ type: 'int', name: 'estimated_minutes', default: 15 })
  estimatedMinutes: number;
}

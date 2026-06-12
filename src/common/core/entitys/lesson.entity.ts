import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonStatus } from 'src/common/utils/enum';
import { Unit } from './unit.entity';

@Entity({ name: 'lessons' })
export class Lesson extends BaseEntity {
  @Column({ type: 'uuid', name: 'unit_id' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'varchar', name: 'lesson_number', nullable: true })
  lessonNumber: string | null;

  @Column({ type: 'varchar', name: 'lesson_name' })
  lessonName: string;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ type: 'varchar', name: 'status', enum: LessonStatus, default: LessonStatus.draft })
  status: LessonStatus;
}

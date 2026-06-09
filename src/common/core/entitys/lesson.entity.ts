import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonStatus, LessonType } from 'src/common/utils/enum';
import { Unit } from './unit.entity';
import { LessonProgress } from './lesson-progress.entity';

@Entity({ name: 'curriculum_lessons' })
export class CurriculumLesson extends BaseEntity {
  @Column({ type: 'uuid', name: 'unit_id', nullable: true })
  unitId: string;

  @ManyToOne(() => Unit, (unit) => unit.lessons, { onDelete: 'CASCADE', nullable: true })
  unit: Unit;

  @Column({ type: 'varchar', name: 'lesson_number', nullable: true })
  lessonNumber: string;

  @Column({ type: 'varchar', name: 'lesson_name' })
  lessonName: string;

  @Column({ type: 'varchar', name: 'lesson_type', enum: LessonType, default: LessonType.grammar })
  lessonType: LessonType;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ type: 'int', name: 'duration_minutes', default: 15 })
  durationMinutes: number;

  @Column({ type: 'varchar', name: 'status', enum: LessonStatus, default: LessonStatus.draft })
  status: LessonStatus;

  @Column({ type: 'jsonb', name: 'content', nullable: true })
  content: Record<string, any> | null;

  @OneToMany(() => LessonProgress, (p) => p.lesson)
  progress: LessonProgress[];
}

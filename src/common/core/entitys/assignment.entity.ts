import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';
import { Lesson } from './lesson.entity';
import { AssignmentType, AssignmentStatus, SubmissionStatus } from 'src/common/utils/enum';

@Entity({ name: 'assignments' })
@Index(['groupId', 'status'])
export class Assignment extends BaseEntity {
  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string;

  @Column({ type: 'varchar', name: 'type', enum: AssignmentType })
  type: AssignmentType;

  @Column({ type: 'uuid', name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  teacher: User;

  @Column({ type: 'uuid', name: 'group_id', nullable: true })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'SET NULL', nullable: true })
  group: Group;

  @Column({ type: 'uuid', name: 'lesson_id', nullable: true })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'SET NULL', nullable: true })
  lesson: Lesson;

  @Column({ type: 'timestamptz', name: 'due_date', nullable: true })
  dueDate: Date;

  @Column({ type: 'int', name: 'max_score', default: 100 })
  maxScore: number;

  @Column({ type: 'varchar', name: 'status', enum: AssignmentStatus, default: AssignmentStatus.draft })
  status: AssignmentStatus;
}

@Entity({ name: 'assignment_submissions' })
@Index(['assignmentId', 'studentId'], { unique: true })
export class AssignmentSubmission extends BaseEntity {
  @Column({ type: 'uuid', name: 'assignment_id' })
  assignmentId: string;

  @ManyToOne(() => Assignment, { onDelete: 'CASCADE' })
  assignment: Assignment;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  student: User;

  @Column({ type: 'varchar', name: 'file_id', nullable: true })
  fileId: string | null;

  @Column({ type: 'text', name: 'text_content', nullable: true })
  textContent: string | null;

  @Column({ type: 'int', name: 'score', nullable: true })
  score: number | null;

  @Column({ type: 'text', name: 'feedback', nullable: true })
  feedback: string | null;

  @Column({ type: 'varchar', name: 'status', enum: SubmissionStatus, default: SubmissionStatus.pending })
  status: SubmissionStatus;

  @Column({ type: 'timestamptz', name: 'submitted_at', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamptz', name: 'graded_at', nullable: true })
  gradedAt: Date;

  @Column({ type: 'uuid', name: 'graded_by', nullable: true })
  gradedBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  grader: User;
}

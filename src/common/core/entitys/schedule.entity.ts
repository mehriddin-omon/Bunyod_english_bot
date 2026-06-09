import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';
import { SessionStatus, AttendanceStatus } from 'src/common/utils/enum';

@Entity({ name: 'schedules' })
export class Schedule extends BaseEntity {
  @Column({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  group: Group;

  @Column({ type: 'uuid', name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  teacher: User;

  @Column({ type: 'varchar', name: 'topic', nullable: true })
  topic: string;

  @Column({ type: 'varchar', name: 'days_of_week', comment: 'JSON array: [0,2,4]' })
  daysOfWeek: string;

  @Column({ type: 'time', name: 'start_time' })
  startTime: string;

  @Column({ type: 'int', name: 'duration_minutes', default: 90 })
  durationMinutes: number;

  @Column({ type: 'boolean', name: 'is_recurring', default: true })
  isRecurring: boolean;

  @Column({ type: 'date', name: 'valid_from' })
  validFrom: string;

  @Column({ type: 'date', name: 'valid_until', nullable: true })
  validUntil: string;
}

@Entity({ name: 'schedule_sessions' })
@Index(['groupId', 'sessionDate'])
export class ScheduleSession extends BaseEntity {
  @Column({ type: 'uuid', name: 'schedule_id' })
  scheduleId: string;

  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  schedule: Schedule;

  @Column({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  group: Group;

  @Column({ type: 'uuid', name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  teacher: User;

  @Column({ type: 'date', name: 'session_date' })
  sessionDate: string;

  @Column({ type: 'time', name: 'start_time' })
  startTime: string;

  @Column({ type: 'int', name: 'duration_minutes', default: 90 })
  durationMinutes: number;

  @Column({ type: 'varchar', name: 'topic', nullable: true })
  topic: string;

  @Column({ type: 'varchar', name: 'status', enum: SessionStatus, default: SessionStatus.scheduled })
  status: SessionStatus;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string;
}

@Entity({ name: 'attendance' })
@Index(['sessionId', 'userId'], { unique: true })
export class Attendance extends BaseEntity {
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => ScheduleSession, { onDelete: 'CASCADE' })
  session: ScheduleSession;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', name: 'status', enum: AttendanceStatus })
  status: AttendanceStatus;

  @Column({ type: 'timestamptz', name: 'joined_at', nullable: true })
  joinedAt: Date;
}

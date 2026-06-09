import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { ActivityType } from 'src/common/utils/enum';

@Entity({ name: 'daily_tracking' })
@Index(['userId', 'date'], { unique: true })
export class DailyTracking extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'date', name: 'date' })
  date: string;

  @Column({ type: 'int', name: 'minutes_spent', default: 0 })
  minutesSpent: number;

  @Column({ type: 'int', name: 'lessons_completed', default: 0 })
  lessonsCompleted: number;

  @Column({ type: 'int', name: 'vocabulary_reviewed', default: 0 })
  vocabularyReviewed: number;

  @Column({ type: 'boolean', name: 'listening_done', default: false })
  listeningDone: boolean;

  @Column({ type: 'int', name: 'goal_minutes', default: 30 })
  goalMinutes: number;
}

@Entity({ name: 'activity_log' })
@Index(['userId', 'dayOfWeek', 'hourOfDay'])
export class ActivityLog extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'timestamptz', name: 'logged_at', default: () => 'NOW()' })
  loggedAt: Date;

  @Column({ type: 'int', name: 'day_of_week', comment: '0=Monday, 6=Sunday' })
  dayOfWeek: number;

  @Column({ type: 'int', name: 'hour_of_day', comment: '0–23' })
  hourOfDay: number;

  @Column({ type: 'int', name: 'duration_minutes', default: 1 })
  durationMinutes: number;

  @Column({ type: 'varchar', name: 'activity_type', enum: ActivityType })
  activityType: ActivityType;
}

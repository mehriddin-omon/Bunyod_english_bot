import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { AchievementCondition } from 'src/common/utils/enum';

@Entity({ name: 'achievements' })
export class Achievement extends BaseEntity {
  @Column({ type: 'varchar', name: 'code', unique: true })
  code: string;

  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string;

  @Column({ type: 'varchar', name: 'icon', nullable: true })
  icon: string;

  @Column({ type: 'int', name: 'xp_reward', default: 0 })
  xpReward: number;

  @Column({ type: 'varchar', name: 'condition_type', enum: AchievementCondition })
  conditionType: AchievementCondition;

  @Column({ type: 'int', name: 'condition_value' })
  conditionValue: number;
}

@Entity({ name: 'user_achievements' })
@Index(['userId', 'achievementId'], { unique: true })
export class UserAchievement extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'uuid', name: 'achievement_id' })
  achievementId: string;

  @ManyToOne(() => Achievement, { onDelete: 'CASCADE' })
  achievement: Achievement;

  @Column({ type: 'timestamptz', name: 'earned_at', default: () => 'NOW()' })
  earnedAt: Date;
}

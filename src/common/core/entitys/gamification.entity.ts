import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { League, XpSource, SkillType, CefrLevel } from 'src/common/utils/enum';

@Entity({ name: 'user_gamification' })
export class UserGamification extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'int', name: 'level', default: 1 })
  level: number;

  @Column({ type: 'int', name: 'xp_total', default: 0 })
  xpTotal: number;

  @Column({ type: 'int', name: 'xp_weekly', default: 0 })
  xpWeekly: number;

  @Column({ type: 'varchar', name: 'league', enum: League, default: League.bronze })
  league: League;

  @Column({ type: 'int', name: 'streak_current', default: 0 })
  streakCurrent: number;

  @Column({ type: 'int', name: 'streak_max', default: 0 })
  streakMax: number;

  @Column({ type: 'date', name: 'last_activity_date', nullable: true })
  lastActivityDate: string;

  @Column({ type: 'int', name: 'rank_weekly', nullable: true })
  rankWeekly: number;
}

@Entity({ name: 'xp_transactions' })
@Index(['userId', 'createdAt'])
export class XpTransaction extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'int', name: 'amount' })
  amount: number;

  @Column({ type: 'varchar', name: 'source', enum: XpSource })
  source: XpSource;

  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId: string;
}

@Entity({ name: 'user_skills' })
@Index(['userId', 'skill'], { unique: true })
export class UserSkill extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', name: 'skill', enum: SkillType })
  skill: SkillType;

  @Column({ type: 'varchar', name: 'cefr_level', enum: CefrLevel, default: CefrLevel.A1 })
  cefrLevel: CefrLevel;

  @Column({ type: 'int', name: 'score', default: 0 })
  score: number;

  @Column({ type: 'int', name: 'words_count', nullable: true, comment: 'Faqat vocabulary skill uchun' })
  wordsCount: number;
}

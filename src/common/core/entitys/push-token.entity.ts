import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/**
 * Qurilma push tokeni (Expo Push Service, 2026-11).
 * Bitta foydalanuvchida bir nechta qurilma bo'lishi mumkin; token boshqa
 * userga o'tsa (bitta telefonda boshqa akkaunt) — egasi almashtiriladi.
 */
@Entity({ name: 'push_tokens' })
@Index(['userId', 'isActive'])
export class PushToken extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', name: 'token' })
  token: string;

  /** android | ios */
  @Column({ type: 'varchar', name: 'platform', default: 'android' })
  platform: string;

  @Column({ type: 'int', name: 'app_build', nullable: true })
  appBuild: number | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt: Date | null;
}

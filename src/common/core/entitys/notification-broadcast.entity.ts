import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export type AudienceMode = 'all' | 'groups' | 'users';

/** Kimga yuboriladi — bildirishnoma ham, onlayn dars taklifi ham shu shaklda */
export interface AudienceSpec {
  mode: AudienceMode;
  groupIds?: string[];
  /** `users` rejimi: qo'lda tanlanganlar — o'quvchilar va mehmonlar bitta ro'yxatda */
  userIds?: string[];
  /** `groups` / `all`: mehmon rejimidagilar ham qo'shilsinmi */
  includeGuests?: boolean;
}

export type NotificationActionType = 'list' | 'lesson' | 'online_lesson' | 'recording' | 'chat' | 'url';

/** Bildirishnoma bosilganda ilovada nima ochiladi */
export interface NotificationAction {
  type: NotificationActionType;
  id?: string | null;
  url?: string | null;
  /** ko'rsatish uchun nom: "5-dars · Present Continuous" */
  label?: string | null;
}

export enum BroadcastStatus {
  draft = 'draft',
  scheduled = 'scheduled',
  sending = 'sending',
  sent = 'sent',
  cancelled = 'cancelled',
}

/** Teacher yuborgan bitta ommaviy xabar (2026-11) */
@Entity({ name: 'notification_broadcasts' })
@Index(['senderId', 'createdAt'])
@Index(['status', 'scheduledAt'])
export class NotificationBroadcast extends BaseEntity {
  @Column({ type: 'uuid', name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'varchar', name: 'title', length: 120 })
  title: string;

  @Column({ type: 'text', name: 'body' })
  body: string;

  @Column({ type: 'jsonb', name: 'audience' })
  audience: AudienceSpec;

  @Column({ type: 'jsonb', name: 'action', nullable: true })
  action: NotificationAction | null;

  @Column({ type: 'varchar', name: 'status', default: BroadcastStatus.draft })
  status: BroadcastStatus;

  @Column({ type: 'timestamptz', name: 'scheduled_at', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'int', name: 'recipient_count', default: 0 })
  recipientCount: number;

  @Column({ type: 'int', name: 'push_count', default: 0 })
  pushCount: number;
}

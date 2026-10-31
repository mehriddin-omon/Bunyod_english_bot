import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { NotificationType } from 'src/common/utils/enum';
import type { NotificationAction } from './notification-broadcast.entity';

@Entity({ name: 'notifications' })
@Index(['userId', 'isRead'])
export class Notification extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', name: 'type', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', name: 'title' })
  title: string;

  @Column({ type: 'text', name: 'body', nullable: true })
  body: string;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ type: 'varchar', name: 'reference_type', nullable: true })
  referenceType: string;

  // ── 2026-11: teacher xabarlari va push ─────────────────────────────────────

  /** Kim yubordi (teacher xabari) — tizim xabarlarida null */
  @Column({ type: 'uuid', name: 'sender_id', nullable: true })
  senderId: string | null;

  /** Ommaviy xabar (notification_broadcasts) — statistika shu bo'yicha */
  @Index()
  @Column({ type: 'uuid', name: 'broadcast_id', nullable: true })
  broadcastId: string | null;

  /** Bosilganda ilovada nima ochiladi: { type: lesson|online_lesson|recording|chat|url|list, id?, url? } */
  @Column({ type: 'jsonb', name: 'action', nullable: true })
  action: NotificationAction | null;

  /** none — push yuborilmadi (token yo'q yoki o'chirilgan), sent — Expo qabul qildi */
  @Column({ type: 'varchar', name: 'push_status', default: 'none' })
  pushStatus: string;

  /** Push yoki karta bosib ochilgan vaqt */
  @Column({ type: 'timestamptz', name: 'opened_at', nullable: true })
  openedAt: Date | null;
}

@Entity({ name: 'messages' })
@Index(['receiverId', 'isRead'])
export class Message extends BaseEntity {
  @Column({ type: 'uuid', name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  sender: User;

  @Column({ type: 'uuid', name: 'receiver_id' })
  receiverId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  receiver: User;

  @Column({ type: 'text', name: 'body' })
  body: string;

  @Column({ type: 'text', name: 'attachments', nullable: true, comment: 'JSON: [{file_id, type, name}]' })
  attachments: string;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  isRead: boolean;
}

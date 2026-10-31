import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

/** Guruhning umumiy chati (2026-11) — har guruhga bitta, avtomatik yaratiladi */
@Entity({ name: 'group_chats' })
export class GroupChat extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  /** Faqat o'qituvchi yozadi (e'lonlar rejimi) */
  @Column({ type: 'boolean', name: 'teacher_only', default: false })
  teacherOnly: boolean;

  @Column({ type: 'uuid', name: 'pinned_message_id', nullable: true })
  pinnedMessageId: string | null;
}

@Entity({ name: 'chat_messages' })
@Index(['chatId', 'createdAt'])
export class ChatMessage extends BaseEntity {
  @Column({ type: 'uuid', name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => GroupChat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: GroupChat;

  @Column({ type: 'uuid', name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'text', name: 'body' })
  body: string;

  @Column({ type: 'uuid', name: 'reply_to_id', nullable: true })
  replyToId: string | null;

  /** Ilova yuborgan vaqtinchalik id — takror yuborishdan saqlaydi */
  @Column({ type: 'varchar', name: 'client_id', nullable: true })
  clientId: string | null;

  @Column({ type: 'timestamptz', name: 'edited_at', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'uuid', name: 'deleted_by', nullable: true })
  deletedBy: string | null;
}

@Entity({ name: 'chat_reads' })
@Index(['chatId', 'userId'], { unique: true })
export class ChatRead extends BaseEntity {
  @Column({ type: 'uuid', name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => GroupChat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: GroupChat;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'timestamptz', name: 'last_read_at' })
  lastReadAt: Date;
}

/** Teacher «Yozishni cheklash» */
@Entity({ name: 'chat_restrictions' })
@Index(['chatId', 'userId'], { unique: true })
export class ChatRestriction extends BaseEntity {
  @Column({ type: 'uuid', name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => GroupChat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: GroupChat;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'timestamptz', name: 'muted_until' })
  mutedUntil: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;
}

export enum ChatReportStatus {
  open = 'open',
  resolved = 'resolved',
}

@Entity({ name: 'chat_reports' })
@Index(['messageId', 'reporterId'], { unique: true })
export class ChatReport extends BaseEntity {
  @Column({ type: 'uuid', name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => GroupChat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: GroupChat;

  @Column({ type: 'uuid', name: 'message_id' })
  messageId: string;

  @ManyToOne(() => ChatMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: ChatMessage;

  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ type: 'varchar', name: 'reason', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', name: 'status', default: ChatReportStatus.open })
  status: ChatReportStatus;

  @Column({ type: 'uuid', name: 'resolved_by', nullable: true })
  resolvedBy: string | null;
}

/** O'quvchi boshqa birovning xabarlarini o'zida yashiradi */
@Entity({ name: 'chat_user_blocks' })
@Index(['userId', 'blockedUserId'], { unique: true })
export class ChatUserBlock extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'blocked_user_id' })
  blockedUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_user_id' })
  blockedUser: User;
}

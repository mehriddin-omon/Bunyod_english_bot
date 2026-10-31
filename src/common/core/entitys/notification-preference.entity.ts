import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/** O'quvchi qaysi turdagi push'larni o'chirgan (2026-11). Qator bo'lmasa — hammasi yoqilgan. */
@Entity({ name: 'notification_preferences' })
export class NotificationPreference {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'boolean', name: 'teacher_messages', default: true })
  teacherMessages: boolean;

  @Column({ type: 'boolean', name: 'online_lessons', default: true })
  onlineLessons: boolean;

  @Column({ type: 'boolean', name: 'group_chat', default: true })
  groupChat: boolean;

  /** Chat shu vaqtgacha ovozsiz (push kelmaydi) */
  @Column({ type: 'timestamptz', name: 'chat_muted_until', nullable: true })
  chatMutedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

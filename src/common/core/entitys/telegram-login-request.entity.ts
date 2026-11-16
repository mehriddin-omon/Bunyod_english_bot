import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TelegramLoginStatus = 'PENDING' | 'AWAITING_CONTACT' | 'CONFIRMED' | 'USED';

/**
 * Telegram orqali kirish / ro'yxatdan o'tish so'rovi (2026-11, Abu Tolib usuli).
 * Ilova `start` bilan ochadi → bot tasdiqlaydi (CONFIRMED) → ilova `poll` bilan tokenlarni oladi (USED).
 * Token va poll siri bazada faqat sha256 ko'rinishida.
 */
@Entity({ name: 'telegram_login_requests' })
export class TelegramLoginRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'varchar', name: 'poll_secret_hash' })
  pollSecretHash: string;

  @Column({ type: 'varchar', name: 'status', default: 'PENDING' })
  status: TelegramLoginStatus;

  @Index()
  @Column({ type: 'bigint', name: 'telegram_chat_id', nullable: true })
  telegramChatId: string | null;

  /** Tasdiqlangan foydalanuvchi */
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  /** So'rovni mehmon ochgan bo'lsa — yangi akkaunt o'rniga SHU mehmon saqlanadi (progress joyida) */
  @Column({ type: 'uuid', name: 'guest_user_id', nullable: true })
  guestUserId: string | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'confirmed_at', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Telegram orqali kirish / ro'yxatdan o'tish (2026-11): DinoEnglish Telegram boti.
 * `telegram_login_requests` — ilova ↔ bot o'rtasidagi bir martalik so'rovlar.
 */
export class AddTelegramLogin1791000000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "telegram_login_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token_hash" varchar NOT NULL,
        "poll_secret_hash" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "telegram_chat_id" bigint,
        "user_id" uuid,
        "guest_user_id" uuid,
        "expires_at" timestamptz NOT NULL,
        "confirmed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tg_login_token" ON "telegram_login_requests" ("token_hash")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tg_login_chat" ON "telegram_login_requests" ("telegram_chat_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "telegram_login_requests"`);
  }
}

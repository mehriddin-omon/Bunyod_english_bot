import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MEHMON AKKAUNT (2026-10).
 *
 * Ilovada yangi foydalanuvchi login sahifasini ko'rmaydi — "Boshlash"
 * bosilganda `POST /auth/guest` mehmon student yaratadi. Keyin
 * `POST /auth/upgrade` uni oddiy akkauntga aylantiradi.
 *
 * Development'da `synchronize` o'zi qo'shadi; bu production uchun.
 * Idempotent: IF NOT EXISTS bilan.
 */
export class AddUserIsGuest1789600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_guest" boolean NOT NULL DEFAULT false`,
    );
    // Eskirgan mehmonlarni tozalash va ro'yxatlarda ajratish uchun
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_is_guest" ON "users" ("is_guest") WHERE "is_guest" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_is_guest"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_guest"`);
  }
}

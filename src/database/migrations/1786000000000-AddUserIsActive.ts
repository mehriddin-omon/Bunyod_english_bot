import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.is_active` — foydalanuvchining tizimga kira olish holati.
 * false bo'lsa `POST /auth/login` va `POST /auth/refresh` rad etadi.
 * O'qituvchi buni "O'quvchilarim" bo'limidan boshqaradi.
 *
 * Mavjud yozuvlar uchun default `true` — hech kim bloklanib qolmaydi.
 * Idempotent: IF NOT EXISTS bilan, qayta ishga tushirish xavfsiz.
 */
export class AddUserIsActive1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_role_is_active" ON "users" ("role", "is_active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_role_is_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"`);
  }
}

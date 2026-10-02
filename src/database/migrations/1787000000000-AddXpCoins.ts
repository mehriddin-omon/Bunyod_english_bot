import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * COIN (XP) tizimini bir joyga yig'ish uchun ikki o'zgarish.
 *
 * 1) `xp_transactions.reference_key` + qisman unique indeks.
 *    Mukofot "allaqachon berilganmi" degan savolga shu ustun javob beradi.
 *    `reference_id` uuid bo'lgani uchun statik mashq kalitini
 *    ("lesson1:grammar:ex1") u yerga sig'dirib bo'lmaydi.
 *    Indeks QISMAN: eski yozuvlarda reference_key NULL, ular bir-biriga
 *    to'sqinlik qilmasligi kerak.
 *
 * 2) `exercise_results.correct_count` / `total_count`.
 *    Coin 1 to'g'ri javob = 1 coin qoidasi bilan beriladi, foizdan qayta
 *    hisoblash esa noto'g'ri natija beradi (85% — 20 savolda 17, 13 da 11).
 *    Eski yozuvlarda NULL — ular coin bermaydi.
 *
 * Idempotent: IF NOT EXISTS bilan, qayta ishga tushirish xavfsiz.
 */
export class AddXpCoins1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "xp_transactions" ADD COLUMN IF NOT EXISTS "reference_key" varchar(160)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_xp_transactions_user_source_ref_key"
         ON "xp_transactions" ("user_id", "source", "reference_key")
       WHERE "reference_key" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "exercise_results" ADD COLUMN IF NOT EXISTS "correct_count" int`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_results" ADD COLUMN IF NOT EXISTS "total_count" int`,
    );
    // Bo'limdagi jami mashqlar soni — bo'lim progressi shundan hisoblanadi
    await queryRunner.query(
      `ALTER TABLE "exercise_results" ADD COLUMN IF NOT EXISTS "section_total" int`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exercise_results" DROP COLUMN IF EXISTS "section_total"`);
    await queryRunner.query(`ALTER TABLE "exercise_results" DROP COLUMN IF EXISTS "total_count"`);
    await queryRunner.query(`ALTER TABLE "exercise_results" DROP COLUMN IF EXISTS "correct_count"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_xp_transactions_user_source_ref_key"`);
    await queryRunner.query(`ALTER TABLE "xp_transactions" DROP COLUMN IF EXISTS "reference_key"`);
  }
}

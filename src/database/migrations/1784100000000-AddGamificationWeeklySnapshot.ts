import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Haftalik reyting o'zgarishini hisoblash uchun user_gamification jadvaliga
 * "o'tgan hafta boshidagi XP snapshot" ustunlari qo'shiladi. To'liq tarixiy
 * jadval o'rniga eng oddiy yechim: joriy xp_weekly/rank_weekly qiymatlarini
 * hafta almashganda snapshotga ko'chirib, farqni hisoblash uchun ishlatamiz.
 */
export class AddGamificationWeeklySnapshot1784100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_gamification"
        ADD COLUMN IF NOT EXISTS "previous_week_xp" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "previous_rank_weekly" integer,
        ADD COLUMN IF NOT EXISTS "week_snapshot_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_gamification"
        DROP COLUMN IF EXISTS "week_snapshot_at",
        DROP COLUMN IF EXISTS "previous_rank_weekly",
        DROP COLUMN IF EXISTS "previous_week_xp"
    `);
  }
}

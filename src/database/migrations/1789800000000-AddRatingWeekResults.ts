import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * REYTING — HAFTA YAKUNI (2026-10).
 *
 * `rating_week_results` — har guruhning yopilgan haftasidagi o'rinlar,
 * liga o'tishi va talaba "Hafta yakuni" oynasini ko'rganmi.
 * Batafsil: `RatingWeekResult` entity va `rating.service.ts`.
 *
 * Development'da `synchronize` o'zi yaratadi; bu production uchun.
 * Idempotent: IF NOT EXISTS bilan.
 */
export class AddRatingWeekResults1789800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rating_week_results" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "week_start" date NOT NULL,
        "rank" integer NOT NULL,
        "total" integer NOT NULL,
        "coins" integer NOT NULL,
        "league_before" character varying NOT NULL,
        "league_after" character varying NOT NULL,
        "promoted" boolean NOT NULL DEFAULT false,
        "seen_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_rating_week_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rating_week_results_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rating_week_results_user_week" ON "rating_week_results" ("user_id", "week_start")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rating_week_results_group_week" ON "rating_week_results" ("group_id", "week_start")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rating_week_results"`);
  }
}

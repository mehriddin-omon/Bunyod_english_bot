import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LUG'AT BOSQICHLARI (2026-09).
 *
 * Rejim tanlash (flashcard / variantli / yozib / audio / aralash) o'rniga
 * dars lug'ati 4 ta ketma-ket bosqichda yodlanadi. Bu migratsiya:
 *   1. `vocabulary_stage_progress` — talaba × dars × bosqich progressi;
 *   2. `vocabulary_sessions` ga `lesson_id`, `stage`, `total_cards` —
 *      submit paytida bosqich foizini server o'zi hisoblashi uchun.
 *
 * Development'da `synchronize` o'zi yaratadi; bu production uchun.
 * Idempotent: IF NOT EXISTS bilan.
 */
export class AddVocabularyStages1789500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_stage_progress" (
        "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "lesson_id"    uuid        NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "stage"        smallint    NOT NULL,
        "attempts"     int         NOT NULL DEFAULT 0,
        "last_percent" int         NOT NULL DEFAULT 0,
        "best_percent" int         NOT NULL DEFAULT 0,
        "passed"       boolean     NOT NULL DEFAULT false,
        "passed_at"    timestamptz,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vocab_stage_progress_user_lesson_stage"
        ON "vocabulary_stage_progress" ("user_id", "lesson_id", "stage")
    `);

    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" ADD COLUMN IF NOT EXISTS "lesson_id" uuid`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" ADD COLUMN IF NOT EXISTS "stage" smallint`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" ADD COLUMN IF NOT EXISTS "total_cards" int NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" DROP COLUMN IF EXISTS "total_cards"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" DROP COLUMN IF EXISTS "stage"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" DROP COLUMN IF EXISTS "lesson_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vocabulary_stage_progress"`);
  }
}

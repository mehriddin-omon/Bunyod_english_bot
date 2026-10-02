import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LUG'AT COINLI SINOVI — `vocabulary_coin_tests` jadvali.
 *
 * Bir qator = bitta urinish (dars × talaba). Kartalar (so'z, variantlar,
 * javob, to'g'ri/xato, vaqt) `cards` jsonb ustunida — sinov 60 tagacha
 * so'zdan iborat, alohida jadval ortiqcha. Coin hisobi
 * (`coins_words/bonus/penalty/earned`) va muddat (`deadline_at`) qatorning
 * o'zida qoladi — natija ekrani va "Coinli sinov" kartasi shundan o'qiydi.
 *
 * Development'da TypeORM `synchronize` jadvalni o'zi yaratadi; bu migratsiya
 * production uchun. Idempotent: IF NOT EXISTS bilan.
 */
export class AddVocabularyCoinTests1789400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_coin_tests" (
        "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "lesson_id"      uuid        NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "attempt_number" int         NOT NULL DEFAULT 1,
        "status"         varchar     NOT NULL DEFAULT 'in_progress',
        "cards"          jsonb       NOT NULL DEFAULT '[]',
        "current_index"  int         NOT NULL DEFAULT 0,
        "last_served_at" timestamptz,
        "deadline_at"    timestamptz,
        "finished_at"    timestamptz,
        "total_words"    int         NOT NULL DEFAULT 0,
        "correct_count"  int         NOT NULL DEFAULT 0,
        "percent"        int         NOT NULL DEFAULT 0,
        "coins_eligible" boolean     NOT NULL DEFAULT true,
        "coins_words"    int         NOT NULL DEFAULT 0,
        "coins_bonus"    int         NOT NULL DEFAULT 0,
        "coins_penalty"  int         NOT NULL DEFAULT 0,
        "coins_earned"   int         NOT NULL DEFAULT 0,
        "time_spent_sec" int         NOT NULL DEFAULT 0,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vocab_coin_tests_user_lesson"
        ON "vocabulary_coin_tests" ("user_id", "lesson_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vocabulary_coin_tests"`);
  }
}

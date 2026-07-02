import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVocabularySession1750600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. vocabulary_sessions — faqat kim va qachon
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_sessions" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "started_at" timestamptz NOT NULL DEFAULT now(),
        "ended_at"   timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vocab_sessions_user_started"
      ON "vocabulary_sessions" ("user_id", "started_at")
    `);

    // 2. vocabulary_practice_logs — ixcham sxema bilan qayta yaratish
    //    id: BIGSERIAL (8 bayt, UUID emas)
    //    mode: SMALLINT (0-3, varchar emas)
    //    answered_at, created_at, updated_at, user_id: olib tashlandi
    await queryRunner.query(`
      CREATE TABLE "vocabulary_practice_logs_new" (
        "id"         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid      REFERENCES "vocabulary_sessions"("id") ON DELETE SET NULL,
        "pair_id"    uuid      NOT NULL REFERENCES "vocabulary_relations"("id") ON DELETE CASCADE,
        "mode"       smallint  NOT NULL DEFAULT 0,
        "correct"    boolean   NOT NULL
      )
    `);

    // Mavjud ma'lumotlarni ko'chirish (session_id = NULL, mode string → smallint)
    await queryRunner.query(`
      INSERT INTO "vocabulary_practice_logs_new" (session_id, pair_id, mode, correct)
      SELECT
        NULL,
        pair_id,
        CASE mode
          WHEN 'flashcard'       THEN 0
          WHEN 'multiple_choice' THEN 1
          WHEN 'typing'          THEN 2
          WHEN 'audio'           THEN 3
          ELSE 0
        END,
        correct
      FROM "vocabulary_practice_logs"
    `);

    await queryRunner.query(`DROP TABLE "vocabulary_practice_logs"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_practice_logs_new" RENAME TO "vocabulary_practice_logs"`);

    await queryRunner.query(`
      CREATE INDEX "IDX_vocab_logs_session"
      ON "vocabulary_practice_logs" ("session_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vocabulary_sessions"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_practice_logs" (
        "id"         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid,
        "pair_id"    uuid    NOT NULL,
        "mode"       varchar NOT NULL DEFAULT 'flashcard',
        "correct"    boolean NOT NULL
      )
    `);
  }
}

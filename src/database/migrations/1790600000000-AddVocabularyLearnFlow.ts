import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LUG'AT — YANGI O'QISH OQIMI (2026-11):
 *  - `user_vocabulary_progress`: SRS pog'onasi (1/3/7/30), ko'rilgan payt,
 *    oxirgi takror, «O'sish nuqtalari» dan chiqarilganlik;
 *  - `vocabulary_saved` — saqlangan so'zlar (serverda);
 *  - `vocabulary_lenta_states` — Testlash lentasi holati (bo'lak bo'yicha);
 *  - `vocabulary_coin_tests.part` — coinli sinov 35 tadan qismlarda.
 * Development'da TypeORM `synchronize` o'zi yaratadi; bu migratsiya production uchun.
 * Idempotent: IF NOT EXISTS bilan.
 */
export class AddVocabularyLearnFlow1790600000000 implements MigrationInterface {
  name = 'AddVocabularyLearnFlow1790600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "user_vocabulary_progress" ADD COLUMN IF NOT EXISTS "srs_step" int NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "user_vocabulary_progress" ADD COLUMN IF NOT EXISTS "seen_at" timestamptz`);
    await q.query(`ALTER TABLE "user_vocabulary_progress" ADD COLUMN IF NOT EXISTS "last_reviewed_at" timestamptz`);
    await q.query(`ALTER TABLE "user_vocabulary_progress" ADD COLUMN IF NOT EXISTS "growth_cleared" boolean NOT NULL DEFAULT false`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_saved" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "pair_id"    uuid        NOT NULL REFERENCES "vocabulary_relations"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vocabulary_saved_user_pair" ON "vocabulary_saved" ("user_id", "pair_id")`,
    );

    await q.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_lenta_states" (
        "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "scope"        varchar(80) NOT NULL,
        "state"        jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "completed_at" timestamptz,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vocabulary_lenta_states_user_scope" ON "vocabulary_lenta_states" ("user_id", "scope")`,
    );

    await q.query(`ALTER TABLE "vocabulary_coin_tests" ADD COLUMN IF NOT EXISTS "part" int`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "vocabulary_coin_tests" DROP COLUMN IF EXISTS "part"`);
    await q.query(`DROP TABLE IF EXISTS "vocabulary_lenta_states"`);
    await q.query(`DROP TABLE IF EXISTS "vocabulary_saved"`);
    await q.query(`ALTER TABLE "user_vocabulary_progress" DROP COLUMN IF EXISTS "growth_cleared"`);
    await q.query(`ALTER TABLE "user_vocabulary_progress" DROP COLUMN IF EXISTS "last_reviewed_at"`);
    await q.query(`ALTER TABLE "user_vocabulary_progress" DROP COLUMN IF EXISTS "seen_at"`);
    await q.query(`ALTER TABLE "user_vocabulary_progress" DROP COLUMN IF EXISTS "srs_step"`);
  }
}

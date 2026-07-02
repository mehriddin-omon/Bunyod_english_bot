import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterVocabularySession1750700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" DROP COLUMN IF EXISTS "started_at"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" DROP COLUMN IF EXISTS "ended_at"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" ADD COLUMN IF NOT EXISTS "completed_count" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" ADD COLUMN IF NOT EXISTS "time_spent_sec" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vocab_sessions_user_started"`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vocab_sessions_user_created" ON "vocabulary_sessions" ("user_id", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vocab_sessions_user_created"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" DROP COLUMN IF EXISTS "completed_count"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" DROP COLUMN IF EXISTS "time_spent_sec"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" ADD COLUMN IF NOT EXISTS "started_at" timestamptz NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "vocabulary_sessions" ADD COLUMN IF NOT EXISTS "ended_at" timestamptz`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vocab_sessions_user_started" ON "vocabulary_sessions" ("user_id", "started_at")`);
  }
}

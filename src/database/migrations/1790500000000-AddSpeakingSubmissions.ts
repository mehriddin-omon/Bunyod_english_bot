import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SPEAKING ishlari (2026-11): o'quvchi ilovada savollarga javob yozadi, ovoz bilan aytadi;
 * o'qituvchi teacher panelda baholaydi (`speaking_submissions`).
 * Development'da TypeORM `synchronize` jadvalni o'zi yaratadi; bu migratsiya production uchun.
 * Idempotent: IF NOT EXISTS bilan.
 */
export class AddSpeakingSubmissions1790500000000 implements MigrationInterface {
  name = 'AddSpeakingSubmissions1790500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "speaking_submissions" (
        "id"                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"           uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "lesson_id"         uuid         NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "task_key"          varchar(60)  NOT NULL,
        "title"             varchar(200),
        "kind"              varchar(20)  NOT NULL DEFAULT 'questions',
        "status"            varchar(20)  NOT NULL DEFAULT 'pending',
        "items"             jsonb        NOT NULL DEFAULT '[]'::jsonb,
        "comment"           text,
        "comment_audio_url" varchar,
        "percent"           int,
        "coins"             int          NOT NULL DEFAULT 0,
        "submitted_at"      timestamptz  NOT NULL,
        "graded_at"         timestamptz,
        "graded_by"         uuid,
        "seen_at"           timestamptz,
        "created_at"        timestamptz  NOT NULL DEFAULT now(),
        "updated_at"        timestamptz  NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_speaking_submissions_user_lesson" ON "speaking_submissions" ("user_id", "lesson_id")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_speaking_submissions_status" ON "speaking_submissions" ("status", "submitted_at")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "speaking_submissions"`);
  }
}

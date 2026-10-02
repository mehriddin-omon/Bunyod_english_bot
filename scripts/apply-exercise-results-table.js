/* eslint-disable @typescript-eslint/no-require-imports */
// exercise_results jadvalini yaratadi (statik mashqlar natijalari — yangi oqim).
// Dev muhitda TypeORM synchronize o'zi yaratadi; bu skript PROD baza uchun.
// Ishga tushirish (backend papkasida):  node scripts/apply-exercise-results-table.js
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DB_URL });
  await client.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "exercise_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "exercise_key" varchar(120) NOT NULL,
        "attempt_number" int NOT NULL,
        "percent" int NOT NULL,
        "answered_at" timestamptz NOT NULL,
        "client_attempt_id" uuid NOT NULL
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_exercise_results_user_client_attempt"
        ON "exercise_results" ("user_id", "client_attempt_id")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ix_exercise_results_lesson_key"
        ON "exercise_results" ("lesson_id", "exercise_key")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ix_exercise_results_user_lesson"
        ON "exercise_results" ("user_id", "lesson_id")
    `);

    await client.query('COMMIT');
    console.log("OK: exercise_results jadvali va indekslari tayyor.");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('XATO:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();

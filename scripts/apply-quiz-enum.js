/* eslint-disable @typescript-eslint/no-require-imports */
// quiz_exercises.exercise_type ustunini varchar -> enum ga o'tkazadi.
// Ishga tushirish (backend papkasida):  node scripts/apply-quiz-enum.js
require('dotenv').config();
const { Client } = require('pg');

const VALUES = ['matching', 'fill_in_blank', 'multiple_choice', 'true_false', 'word_bank', 'translation'];

(async () => {
  const client = new Client({ connectionString: process.env.DB_URL });
  await client.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "quiz_exercise_type_enum" AS ENUM(${VALUES.map((v) => `'${v}'`).join(', ')});
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await client.query(`
      UPDATE "quiz_exercises" SET "exercise_type" = 'fill_in_blank'
      WHERE "exercise_type" IS NULL
         OR "exercise_type"::text NOT IN (${VALUES.map((v) => `'${v}'`).join(', ')})
    `);

    await client.query(`
      ALTER TABLE "quiz_exercises"
        ALTER COLUMN "exercise_type" TYPE "quiz_exercise_type_enum"
        USING "exercise_type"::text::"quiz_exercise_type_enum"
    `);

    await client.query(`ALTER TABLE "quiz_exercises" ALTER COLUMN "exercise_type" SET NOT NULL`);

    await client.query('COMMIT');

    const r = await client.query(
      `SELECT udt_name FROM information_schema.columns
       WHERE table_name = 'quiz_exercises' AND column_name = 'exercise_type'`,
    );
    console.log('OK — exercise_type ustuni endi:', r.rows[0] && r.rows[0].udt_name);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Xato:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();

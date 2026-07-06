import * as dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';

const VALUES = ['matching', 'fill_in_blank', 'multiple_choice', 'true_false', 'word_bank', 'translation'];

/**
 * quiz_exercises.exercise_type ustunini varchar -> quiz_exercise_type_enum ga
 * o'tkazadi. Idempotent: allaqachon enum bo'lsa hech narsa qilmaydi.
 * TypeORM synchronize'dan OLDIN chaqirilishi kerak.
 */
export async function ensureQuizEnum(): Promise<void> {
  const client = new Client({ connectionString: process.env.DB_URL });
  try {
    await client.connect();

    const { rows } = await client.query(
      `SELECT udt_name FROM information_schema.columns
       WHERE table_name = 'quiz_exercises' AND column_name = 'exercise_type'`,
    );
    // Jadval/ustun yo'q (yangi baza) yoki allaqachon enum — tegmaymiz
    if (!rows.length || rows[0].udt_name === 'quiz_exercise_type_enum') return;

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
    // eslint-disable-next-line no-console
    console.log('[ensureQuizEnum] exercise_type ustuni enum ga o‘tkazildi');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    // eslint-disable-next-line no-console
    console.error('[ensureQuizEnum] xato:', (e as Error).message);
  } finally {
    await client.end().catch(() => {});
  }
}

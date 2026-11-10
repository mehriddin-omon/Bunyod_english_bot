import * as dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';

/** «Test qoliblari» (2026-11) uchun yangi mashq turlari */
export const TEMPLATE_EXERCISE_TYPES = ['map_labelling', 'sentence_order', 'error_correction'];

/**
 * quiz_exercise_type_enum ga yangi qiymatlarni qo'shadi va exercises.settings /
 * exercise_items.meta ustunlarini, hamda reading/listening/quiz_contents.instructions
 * (qism topshirig'i) ustunlarini yaratadi. Idempotent. TypeORM synchronize'dan
 * OLDIN chaqiriladi — aks holda synchronize enum turini qayta yaratishga urinadi.
 * Production'da xuddi shuni 1790700000000-AddExerciseTemplates migratsiyasi qiladi.
 */
export async function ensureExerciseTemplates(): Promise<void> {
  const client = new Client({ connectionString: process.env.DB_URL });
  try {
    await client.connect();
    const { rows } = await client.query(`SELECT 1 FROM pg_type WHERE typname = 'quiz_exercise_type_enum'`);
    if (rows.length) {
      for (const v of TEMPLATE_EXERCISE_TYPES) {
        await client.query(`ALTER TYPE "quiz_exercise_type_enum" ADD VALUE IF NOT EXISTS '${v}'`);
      }
    }
    const t = await client.query(`SELECT to_regclass('public.exercises') AS e, to_regclass('public.exercise_items') AS i`);
    if (t.rows[0]?.e) await client.query(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "settings" jsonb`);
    if (t.rows[0]?.i) await client.query(`ALTER TABLE "exercise_items" ADD COLUMN IF NOT EXISTS "meta" jsonb`);
    // Qism topshirig'i (test konstruktori)
    for (const table of ['reading_contents', 'listening_contents', 'quiz_contents']) {
      const r = await client.query(`SELECT to_regclass('public.${table}') AS t`);
      if (r.rows[0]?.t) await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "instructions" text`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ensureExerciseTemplates] xato:', (e as Error).message);
  } finally {
    await client.end().catch(() => {});
  }
}

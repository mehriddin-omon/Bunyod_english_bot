import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «Test qoliblari» (2026-11): 9 ta mashq qolipi.
 * - quiz_exercise_type_enum ga: map_labelling, sentence_order, error_correction
 * - exercises.settings (jsonb) — qolip sozlamalari ({ v: 1, ... })
 * - exercise_items.meta (jsonb) — bo'sh joy javoblari, muqobillar, yorliq, guruh...
 * - reading/listening/quiz_contents.instructions (text) — qism topshirig'i
 * Development'da `ensureExerciseTemplates` (app.service.ts) o'zi qiladi; bu production uchun.
 */
export class AddExerciseTemplates1790700000000 implements MigrationInterface {
  // Postgres 12+ da ALTER TYPE ... ADD VALUE tranzaksiya ichida ishlaydi (qiymat shu
  // tranzaksiyada ishlatilmaydi) — shuning uchun alohida transaction rejimi shart emas.
  public async up(q: QueryRunner): Promise<void> {
    for (const v of ['map_labelling', 'sentence_order', 'error_correction']) {
      await q.query(`ALTER TYPE "quiz_exercise_type_enum" ADD VALUE IF NOT EXISTS '${v}'`);
    }
    await q.query(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "settings" jsonb`);
    await q.query(`ALTER TABLE "exercise_items" ADD COLUMN IF NOT EXISTS "meta" jsonb`);
    for (const t of ['reading_contents', 'listening_contents', 'quiz_contents']) {
      await q.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "instructions" text`);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    // Enum qiymatlarini olib tashlab bo'lmaydi (Postgres) — faqat ustunlar
    for (const t of ['reading_contents', 'listening_contents', 'quiz_contents']) {
      await q.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "instructions"`);
    }
    await q.query(`ALTER TABLE "exercise_items" DROP COLUMN IF EXISTS "meta"`);
    await q.query(`ALTER TABLE "exercises" DROP COLUMN IF EXISTS "settings"`);
  }
}

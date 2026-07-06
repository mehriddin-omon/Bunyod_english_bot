import * as dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * quiz.md — mashqlarni yagona tizimga birlashtirish bootstrap'i.
 *
 * 1) quiz_exercises/quiz_items -> exercises/exercise_items (RENAME, agar hali qilinmagan bo'lsa).
 * 2) exercises: owner_block_type/owner_block_id/lesson_id ustunlari qo'shiladi,
 *    mavjud quiz mashqlari uchun quiz_id dan backfill qilinadi, so'ng quiz_id DROP qilinadi.
 * 3) exercise_items: image_url/explanation qo'shiladi, options text -> jsonb ga o'tkaziladi.
 * 4) reading_questions/reading_options -> exercises + exercise_items (id SAQLANGAN holda),
 *    tur bo'yicha guruhlab (owner_block_type='reading'), so'ng eski 2 jadval DROP qilinadi.
 * 5) listening_questions/listening_options -> xuddi shunday (owner_block_type='listening'),
 *    savol darajasidagi image_url ko'chadi, option image_url/match_key options jsonb ga kiradi,
 *    match_targets esa item id bo'yicha xaritalangan holda exercise.instructions ga JSON qilib yoziladi.
 *
 * Idempotent: allaqachon bajarilgan bo'lsa (exercises.owner_block_type ustuni bor) hech narsa qilmaydi.
 * TypeORM synchronize'dan OLDIN chaqirilishi kerak (app.service.ts).
 */
export async function ensureExercisesUnified(): Promise<void> {
  const client = new Client({ connectionString: process.env.DB_URL });
  try {
    await client.connect();

    const already = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'exercises' AND column_name = 'owner_block_type'`,
    );
    if (already.rows.length) return;

    await client.query('BEGIN');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "student_answer_block_type_enum" AS ENUM('quiz', 'reading', 'listening', 'grammar');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "quiz_exercise_type_enum" AS ENUM(
          'matching', 'fill_in_blank', 'multiple_choice', 'true_false', 'word_bank', 'translation'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    const regs = await client.query(`
      SELECT to_regclass('public.exercises') AS ex,
             to_regclass('public.exercise_items') AS exi,
             to_regclass('public.quiz_exercises') AS qex,
             to_regclass('public.quiz_items') AS qit
    `);
    const { ex, exi, qex, qit } = regs.rows[0];

    if (!ex && qex) await client.query(`ALTER TABLE "quiz_exercises" RENAME TO "exercises"`);
    if (!exi && qit) await client.query(`ALTER TABLE "quiz_items" RENAME TO "exercise_items"`);

    const check2 = await client.query(`SELECT to_regclass('public.exercises') AS ex`);
    if (!check2.rows[0].ex) {
      // Yangi baza — quiz_exercises hech qachon bo'lmagan. Synchronize exercises/exercise_items
      // jadvallarini to'g'ridan-to'g'ri yangi sxema bilan yaratadi, bootstrap shart emas.
      await client.query('ROLLBACK');
      return;
    }

    // ── exercises: owner ustunlari + backfill (quiz) ──────────────────────────
    await client.query(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "lesson_id" uuid`);
    await client.query(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "owner_block_id" uuid`);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "exercises" ADD COLUMN "owner_block_type" "student_answer_block_type_enum";
      EXCEPTION WHEN duplicate_column THEN null;
      END $$
    `);

    const hasQuizId = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'exercises' AND column_name = 'quiz_id'`,
    );
    if (hasQuizId.rows.length) {
      await client.query(`
        UPDATE "exercises" e SET
          "owner_block_type" = 'quiz',
          "owner_block_id" = e."quiz_id",
          "lesson_id" = q."lesson_id"
        FROM "quiz_contents" q
        WHERE q."id" = e."quiz_id" AND e."owner_block_type" IS NULL
      `);
    }

    await client.query(`ALTER TABLE "exercises" ALTER COLUMN "owner_block_type" SET NOT NULL`);
    await client.query(`ALTER TABLE "exercises" ALTER COLUMN "owner_block_id" SET NOT NULL`);
    await client.query(`ALTER TABLE "exercises" ALTER COLUMN "lesson_id" SET NOT NULL`);
    if (hasQuizId.rows.length) {
      await client.query(`ALTER TABLE "exercises" DROP COLUMN "quiz_id"`);
    }
    await client.query(
      `CREATE INDEX IF NOT EXISTS "IDX_exercises_owner" ON "exercises" ("owner_block_type", "owner_block_id")`,
    );
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_exercises_lesson" ON "exercises" ("lesson_id")`);

    // ── exercise_items: image_url/explanation + options jsonb ─────────────────
    await client.query(`ALTER TABLE "exercise_items" ADD COLUMN IF NOT EXISTS "image_url" varchar`);
    await client.query(`ALTER TABLE "exercise_items" ADD COLUMN IF NOT EXISTS "explanation" text`);
    const optionsType = await client.query(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'exercise_items' AND column_name = 'options'`,
    );
    if (optionsType.rows[0]?.data_type && optionsType.rows[0].data_type !== 'jsonb') {
      await client.query(`
        ALTER TABLE "exercise_items"
          ALTER COLUMN "options" TYPE jsonb
          USING (CASE WHEN "options" IS NULL OR "options" = '' THEN NULL ELSE "options"::jsonb END)
      `);
    }

    // ── reading_questions/reading_options -> exercises/exercise_items ─────────
    const hasReading = await client.query(`SELECT to_regclass('public.reading_questions') AS t`);
    if (hasReading.rows[0].t) {
      const readingLessons = await client.query(`SELECT "id", "lesson_id" FROM "reading_contents"`);
      const lessonByReading = new Map<string, string>(
        readingLessons.rows.map((r: any) => [r.id, r.lesson_id]),
      );

      const questions = await client.query(`
        SELECT "id", "reading_id", "question_text", "question_type", "correct_explanation", "order_index"
        FROM "reading_questions"
        ORDER BY "reading_id", "order_index"
      `);
      const options = await client.query(`
        SELECT "id", "question_id", "option_text", "is_correct", "order_index"
        FROM "reading_options"
        ORDER BY "question_id", "order_index"
      `);
      const optionsByQuestion = new Map<string, any[]>();
      for (const o of options.rows) {
        if (!optionsByQuestion.has(o.question_id)) optionsByQuestion.set(o.question_id, []);
        optionsByQuestion.get(o.question_id)!.push(o);
      }

      type Group = { readingId: string; lessonId: string | undefined; questionType: string; orderIndex: number; questions: any[] };
      const groups = new Map<string, Group>();
      const groupCounter = new Map<string, number>();
      for (const q of questions.rows) {
        const key = `${q.reading_id}::${q.question_type}`;
        if (!groups.has(key)) {
          const idx = groupCounter.get(q.reading_id) ?? 0;
          groupCounter.set(q.reading_id, idx + 1);
          groups.set(key, {
            readingId: q.reading_id,
            lessonId: lessonByReading.get(q.reading_id),
            questionType: q.question_type,
            orderIndex: idx,
            questions: [],
          });
        }
        groups.get(key)!.questions.push(q);
      }

      for (const g of groups.values()) {
        if (!g.lessonId) continue; // orfan reading_content bo'lsa o'tkazib yuboriladi
        const exerciseId = randomUUID();
        await client.query(
          `INSERT INTO "exercises"
             ("id", "created_at", "updated_at", "lesson_id", "owner_block_type", "owner_block_id",
              "exercise_type", "title", "instructions", "order_index")
           VALUES ($1, now(), now(), $2, 'reading', $3, $4, 'Savollar', NULL, $5)`,
          [exerciseId, g.lessonId, g.readingId, g.questionType, g.orderIndex],
        );
        for (let i = 0; i < g.questions.length; i++) {
          const q = g.questions[i];
          const opts = optionsByQuestion.get(q.id) ?? [];
          const correctOpt = opts.find((o) => o.is_correct);
          const optionsJson = opts.length
            ? JSON.stringify(opts.map((o) => ({ text: o.option_text, isCorrect: o.is_correct })))
            : null;
          await client.query(
            `INSERT INTO "exercise_items"
               ("id", "created_at", "updated_at", "exercise_id", "item_text", "correct_answer",
                "options", "image_url", "explanation", "order_index")
             VALUES ($1, now(), now(), $2, $3, $4, $5, NULL, $6, $7)`,
            [q.id, exerciseId, q.question_text, correctOpt?.option_text ?? '', optionsJson, q.correct_explanation, i],
          );
        }
      }

      await client.query(`DROP TABLE "reading_options"`);
      await client.query(`DROP TABLE "reading_questions"`);
    }

    // ── listening_questions/listening_options -> exercises/exercise_items ─────
    const hasListening = await client.query(`SELECT to_regclass('public.listening_questions') AS t`);
    if (hasListening.rows[0].t) {
      const listeningLessons = await client.query(`SELECT "id", "lesson_id" FROM "listening_contents"`);
      const lessonByListening = new Map<string, string>(
        listeningLessons.rows.map((r: any) => [r.id, r.lesson_id]),
      );

      const questions = await client.query(`
        SELECT "id", "listening_id", "question_text", "question_type", "correct_explanation",
               "image_url", "match_targets", "order_index"
        FROM "listening_questions"
        ORDER BY "listening_id", "order_index"
      `);
      const options = await client.query(`
        SELECT "id", "question_id", "option_text", "is_correct", "image_url", "match_key", "order_index"
        FROM "listening_options"
        ORDER BY "question_id", "order_index"
      `);
      const optionsByQuestion = new Map<string, any[]>();
      for (const o of options.rows) {
        if (!optionsByQuestion.has(o.question_id)) optionsByQuestion.set(o.question_id, []);
        optionsByQuestion.get(o.question_id)!.push(o);
      }

      type Group = { listeningId: string; lessonId: string | undefined; questionType: string; orderIndex: number; questions: any[] };
      const groups = new Map<string, Group>();
      const groupCounter = new Map<string, number>();
      for (const q of questions.rows) {
        const key = `${q.listening_id}::${q.question_type}`;
        if (!groups.has(key)) {
          const idx = groupCounter.get(q.listening_id) ?? 0;
          groupCounter.set(q.listening_id, idx + 1);
          groups.set(key, {
            listeningId: q.listening_id,
            lessonId: lessonByListening.get(q.listening_id),
            questionType: q.question_type,
            orderIndex: idx,
            questions: [],
          });
        }
        groups.get(key)!.questions.push(q);
      }

      for (const g of groups.values()) {
        if (!g.lessonId) continue;
        const exerciseId = randomUUID();
        // match_targets — item id bo'yicha xaritalangan holda instructions ga JSON qilib yoziladi
        // (renderer ExerciseItem.id orqali o'z matchTargets'ini shu yerdan o'qiydi).
        const matchTargetsByItem: Record<string, string[]> = {};
        for (const q of g.questions) {
          if (q.match_targets) matchTargetsByItem[q.id] = q.match_targets;
        }
        const instructions = Object.keys(matchTargetsByItem).length
          ? JSON.stringify({ matchTargetsByItem })
          : null;

        await client.query(
          `INSERT INTO "exercises"
             ("id", "created_at", "updated_at", "lesson_id", "owner_block_type", "owner_block_id",
              "exercise_type", "title", "instructions", "order_index")
           VALUES ($1, now(), now(), $2, 'listening', $3, $4, 'Savollar', $5, $6)`,
          [exerciseId, g.lessonId, g.listeningId, g.questionType, instructions, g.orderIndex],
        );
        for (let i = 0; i < g.questions.length; i++) {
          const q = g.questions[i];
          const opts = optionsByQuestion.get(q.id) ?? [];
          const correctOpt = opts.find((o) => o.is_correct);
          const optionsJson = opts.length
            ? JSON.stringify(
                opts.map((o) => ({
                  text: o.option_text,
                  isCorrect: o.is_correct,
                  imageUrl: o.image_url ?? null,
                  matchKey: o.match_key ?? null,
                })),
              )
            : null;
          await client.query(
            `INSERT INTO "exercise_items"
               ("id", "created_at", "updated_at", "exercise_id", "item_text", "correct_answer",
                "options", "image_url", "explanation", "order_index")
             VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $7, $8)`,
            [
              q.id,
              exerciseId,
              q.question_text,
              correctOpt?.option_text ?? '',
              optionsJson,
              q.image_url ?? null,
              q.correct_explanation,
              i,
            ],
          );
        }
      }

      await client.query(`DROP TABLE "listening_options"`);
      await client.query(`DROP TABLE "listening_questions"`);
    }

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('[ensureExercisesUnified] quiz/reading/listening mashqlari yagona exercises tizimiga birlashtirildi');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    // eslint-disable-next-line no-console
    console.error('[ensureExercisesUnified] xato:', (e as Error).message);
  } finally {
    await client.end().catch(() => {});
  }
}

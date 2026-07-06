import * as dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';

/**
 * Eski quiz_student_answers jadvalidagi yozuvlarni yagona student_answers
 * jadvaliga ko'chiradi va eski jadvalni o'chiradi. Idempotent.
 * TypeORM synchronize student_answers ni yaratganidan KEYIN chaqirilishi kerak.
 */
export async function ensureStudentAnswersMigrated(): Promise<void> {
  const client = new Client({ connectionString: process.env.DB_URL });
  try {
    await client.connect();

    const { rows } = await client.query(`
      SELECT
        to_regclass('public.quiz_student_answers') AS old_table,
        to_regclass('public.student_answers')      AS new_table
    `);
    if (!rows[0]?.old_table || !rows[0]?.new_table) return;

    await client.query('BEGIN');

    await client.query(`
      INSERT INTO "student_answers"
        ("id", "created_at", "updated_at", "user_id", "lesson_id", "block_type",
         "block_id", "question_id", "given_answer", "is_correct", "answered_at")
      SELECT gen_random_uuid(), now(), now(), a."user_id", q."lesson_id",
             'quiz'::"student_answer_block_type_enum", a."quiz_id", a."item_id",
             a."given_answer", a."is_correct", a."answered_at"
      FROM "quiz_student_answers" a
      JOIN "quiz_contents" q ON q."id" = a."quiz_id"
      ON CONFLICT DO NOTHING
    `);

    await client.query(`DROP TABLE "quiz_student_answers"`);

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('[ensureStudentAnswers] quiz javoblari student_answers ga ko‘chirildi, eski jadval o‘chirildi');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    // eslint-disable-next-line no-console
    console.error('[ensureStudentAnswers] xato:', (e as Error).message);
  } finally {
    await client.end().catch(() => {});
  }
}

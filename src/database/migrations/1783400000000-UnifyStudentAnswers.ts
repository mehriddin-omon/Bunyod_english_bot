import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Yagona student_answers jadvali: quiz/reading/listening/grammar javoblari
 * bitta joyda saqlanadi. Eski quiz_student_answers ko'chirilib o'chiriladi.
 */
export class UnifyStudentAnswers1783400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "student_answer_block_type_enum" AS ENUM('quiz', 'reading', 'listening', 'grammar');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_answers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "block_type" "student_answer_block_type_enum" NOT NULL,
        "block_id" uuid NOT NULL,
        "question_id" uuid NOT NULL,
        "given_answer" text NOT NULL,
        "is_correct" boolean NOT NULL DEFAULT false,
        "answered_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_student_answers_user_block_question"
        ON "student_answers" ("user_id", "block_type", "question_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.quiz_student_answers') IS NOT NULL THEN
          INSERT INTO "student_answers"
            ("id", "created_at", "updated_at", "user_id", "lesson_id", "block_type",
             "block_id", "question_id", "given_answer", "is_correct", "answered_at")
          SELECT gen_random_uuid(), now(), now(), a."user_id", q."lesson_id",
                 'quiz'::"student_answer_block_type_enum", a."quiz_id", a."item_id",
                 a."given_answer", a."is_correct", a."answered_at"
          FROM "quiz_student_answers" a
          JOIN "quiz_contents" q ON q."id" = a."quiz_id"
          ON CONFLICT DO NOTHING;

          DROP TABLE "quiz_student_answers";
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_student_answers_user_block_question"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_answers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "student_answer_block_type_enum"`);
  }
}

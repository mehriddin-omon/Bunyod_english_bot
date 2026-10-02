import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 400-500 bir vaqtdagi foydalanuvchi kutilgani uchun performance indekslari.
 * Postgres FK ustunlarini avtomatik indekslamaydi — `lesson_id` bo'yicha
 * filtrlash (getLessonBlocks va boshqa teacher/student so'rovlari) va
 * `exercise_id` bo'yicha join (exercise_items) ko'p ishlatiladigan yo'llar.
 *
 * Idempotent: IF NOT EXISTS bilan, qayta ishga tushirish xavfsiz.
 */
export class AddContentPerfIndexes1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grammar_contents_lesson_id" ON "grammar_contents" ("lesson_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reading_contents_lesson_id" ON "reading_contents" ("lesson_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_listening_contents_lesson_id" ON "listening_contents" ("lesson_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_quiz_contents_lesson_id" ON "quiz_contents" ("lesson_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_exercise_items_exercise_id" ON "exercise_items" ("exercise_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_listening_transcripts_listening_id" ON "listening_transcripts" ("listening_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grammar_contents_lesson_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reading_contents_lesson_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listening_contents_lesson_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quiz_contents_lesson_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_exercise_items_exercise_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_listening_transcripts_listening_id"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuizExerciseTypeEnum1783300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "quiz_exercise_type_enum" AS ENUM(
          'matching', 'fill_in_blank', 'multiple_choice', 'true_false', 'word_bank', 'translation'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
    // Bo'sh yoki noma'lum qiymatlarni xavfsiz qiymatga keltirib olamiz
    await queryRunner.query(`
      UPDATE "quiz_exercises"
      SET "exercise_type" = 'fill_in_blank'
      WHERE "exercise_type" IS NULL
         OR "exercise_type"::text NOT IN ('matching', 'fill_in_blank', 'multiple_choice', 'true_false', 'word_bank', 'translation')
    `);
    await queryRunner.query(`
      ALTER TABLE "quiz_exercises"
        ALTER COLUMN "exercise_type" TYPE "quiz_exercise_type_enum"
        USING "exercise_type"::text::"quiz_exercise_type_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "quiz_exercises"
        ALTER COLUMN "exercise_type" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quiz_exercises"
        ALTER COLUMN "exercise_type" TYPE varchar
        USING "exercise_type"::text
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "quiz_exercise_type_enum"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVocabBlockTables1750500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_vocab_blocks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "order_index" integer NOT NULL DEFAULT 0,
        "exercise_types" text NOT NULL DEFAULT 'multiple_choice,write,audio',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_vocab_words" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "block_id" uuid NOT NULL REFERENCES "lesson_vocab_blocks"("id") ON DELETE CASCADE,
        "word" character varying NOT NULL,
        "pronunciation" character varying,
        "part_of_speech" character varying,
        "translation" character varying NOT NULL,
        "topic" character varying,
        "examples" jsonb NOT NULL DEFAULT '[]',
        "order_index" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_vocab_words"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_vocab_blocks"`);
  }
}

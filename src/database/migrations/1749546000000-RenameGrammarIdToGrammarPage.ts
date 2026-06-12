import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameGrammarIdToGrammarPage1749546000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lesson_blocks" DROP COLUMN IF EXISTS "grammar_id"`);
    await queryRunner.query(`ALTER TABLE "lesson_blocks" ADD COLUMN IF NOT EXISTS "grammar_page" varchar NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lesson_blocks" DROP COLUMN IF EXISTS "grammar_page"`);
    await queryRunner.query(`ALTER TABLE "lesson_blocks" ADD COLUMN IF NOT EXISTS "grammar_id" uuid NULL`);
  }
}

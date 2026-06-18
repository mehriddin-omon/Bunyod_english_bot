import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImagesToListening1750300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listening_contents" ADD COLUMN IF NOT EXISTS "image_url" character varying`);
    await queryRunner.query(`ALTER TABLE "listening_questions" ADD COLUMN IF NOT EXISTS "image_url" character varying`);
    await queryRunner.query(`ALTER TABLE "listening_questions" ADD COLUMN IF NOT EXISTS "match_targets" jsonb`);
    await queryRunner.query(`ALTER TABLE "listening_options" ADD COLUMN IF NOT EXISTS "image_url" character varying`);
    await queryRunner.query(`ALTER TABLE "listening_options" ADD COLUMN IF NOT EXISTS "match_key" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listening_options" DROP COLUMN IF EXISTS "match_key"`);
    await queryRunner.query(`ALTER TABLE "listening_options" DROP COLUMN IF EXISTS "image_url"`);
    await queryRunner.query(`ALTER TABLE "listening_questions" DROP COLUMN IF EXISTS "match_targets"`);
    await queryRunner.query(`ALTER TABLE "listening_questions" DROP COLUMN IF EXISTS "image_url"`);
    await queryRunner.query(`ALTER TABLE "listening_contents" DROP COLUMN IF EXISTS "image_url"`);
  }
}

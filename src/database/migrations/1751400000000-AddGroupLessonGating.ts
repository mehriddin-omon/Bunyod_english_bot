import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupLessonGating1751400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups"
        ADD COLUMN IF NOT EXISTS "auto_advance_enabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "manual_lesson_ceiling" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "estimated_minutes" integer NOT NULL DEFAULT 15
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_member_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "is_free" boolean NOT NULL DEFAULT false,
        "manual_unlock_ceiling" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("group_id", "user_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "group_member_settings"`);
    await queryRunner.query(`
      ALTER TABLE "lessons" DROP COLUMN IF EXISTS "estimated_minutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "groups"
        DROP COLUMN IF EXISTS "manual_lesson_ceiling",
        DROP COLUMN IF EXISTS "auto_advance_enabled"
    `);
  }
}

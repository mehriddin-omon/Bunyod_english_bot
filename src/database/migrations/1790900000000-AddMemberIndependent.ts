import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «Mustaqil» kirish rejimi (2026-11): `group_member_settings.is_independent` —
 * talabaga barcha darslar ochiq (ketma-ket qulf va guruh chegarasisiz).
 */
export class AddMemberIndependent1790900000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "group_member_settings"
        ADD COLUMN IF NOT EXISTS "is_independent" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "group_member_settings" DROP COLUMN IF EXISTS "is_independent"`);
  }
}

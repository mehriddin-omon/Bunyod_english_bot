import { MigrationInterface, QueryRunner } from 'typeorm';
import { VOCAB_SETS_SQL } from '../vocab-sets.sql';

/**
 * LUG'AT TO'PLAMLARI — lug'at almashtirilganda eski so'zlar va o'quvchi progressi saqlanadi
 * (batafsil: `database/vocab-sets.sql.ts`). Mavjud so'zlar 1-to'plam bo'lib qoladi, hech narsa o'zgarmaydi.
 */
export class AddVocabSets1790300000000 implements MigrationInterface {
  name = 'AddVocabSets1790300000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const sql of VOCAB_SETS_SQL) await q.query(sql);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS vocab_visible(uuid, uuid, integer)`);
    await q.query(`DROP TABLE IF EXISTS user_lesson_vocab_set`);
    await q.query(`DROP INDEX IF EXISTS idx_vocabularys_lesson_set`);
    await q.query(`ALTER TABLE lessons DROP COLUMN IF EXISTS vocab_set_no`);
    await q.query(`ALTER TABLE vocabularys DROP COLUMN IF EXISTS set_no`);
  }
}

/* eslint-disable @typescript-eslint/no-require-imports */
// Coin (XP) tizimi uchun ustun va indekslarni qo'shadi:
//   xp_transactions.reference_key  + qisman unique (user_id, source, reference_key)
//   exercise_results.correct_count / total_count / section_total
//
// Dev muhitda TypeORM synchronize o'zi qo'shadi; bu skript PROD baza uchun.
// DIQQAT: qisman unique indeksni synchronize YARATMAYDI — prodda shu skript
// (yoki migratsiya) majburiy, aks holda coin takror berilib ketishi mumkin.
//
// Ishga tushirish (backend papkasida):  node scripts/apply-xp-coins.js
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DB_URL });
  await client.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE "xp_transactions"
        ADD COLUMN IF NOT EXISTS "reference_key" varchar(160)
    `);

    // Qisman indeks: eski yozuvlarda reference_key NULL — ular bir-biriga
    // to'sqinlik qilmasligi kerak, NULL lar unique tekshiruvidan chetda qoladi.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_xp_transactions_user_source_ref_key"
        ON "xp_transactions" ("user_id", "source", "reference_key")
      WHERE "reference_key" IS NOT NULL
    `);

    await client.query(`
      ALTER TABLE "exercise_results"
        ADD COLUMN IF NOT EXISTS "correct_count" int,
        ADD COLUMN IF NOT EXISTS "total_count" int,
        ADD COLUMN IF NOT EXISTS "section_total" int
    `);

    await client.query('COMMIT');
    console.log('OK: coin (XP) ustunlari va indekslari tayyor.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('XATO:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();

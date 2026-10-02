/* eslint-disable @typescript-eslint/no-require-imports */
//
// DARS YAKUNI COINLARINI BUTUNLAY OLIB TASHLAYDI (bir martalik tozalash).
//
// Qoida o'zgardi: coin faqat MASHQ ishlanganda va SO'Z yodlanganda beriladi.
// Darsni "yakunlash" tugmasini bosishning o'zi endi mukofot emas. Kodda bu
// allaqachon olib tashlangan — bu skript esa BAZADA qolgan eski
// `lesson_complete` yozuvlarini tozalaydi va coinni qaytaradi.
//
// Nima qiladi:
//   1. Har foydalanuvchi bo'yicha `lesson_complete` XP yig'indisini hisoblaydi
//   2. Shu miqdorni xp_total / xp_weekly dan ayiradi, level ni qayta hisoblaydi
//   3. `lesson_complete` yozuvlarini o'chiradi
//
// Ishga tushirish (backend papkasida):
//   node scripts/remove-lesson-complete-xp.js            # ko'rish (o'zgartirmaydi)
//   node scripts/remove-lesson-complete-xp.js --apply    # haqiqatan bajarish
//
require('dotenv').config();
const { Client } = require('pg');

const apply = process.argv.includes('--apply');

(async () => {
  const client = new Client({ connectionString: process.env.DB_URL });
  await client.connect();
  try {
    const preview = await client.query(
      `SELECT u.email,
              SUM(x.amount)::int AS coins,
              COUNT(*)::int      AS rows,
              g.xp_total
         FROM xp_transactions x
         JOIN users u              ON u.id = x.user_id
         LEFT JOIN user_gamification g ON g.user_id = x.user_id
        WHERE x.source = 'lesson_complete'
        GROUP BY u.email, g.xp_total
        ORDER BY coins DESC`,
    );

    if (!preview.rowCount) {
      console.log("Tozalanadigan `lesson_complete` yozuvi yo'q — baza allaqachon toza.");
      return;
    }

    console.log('Olib tashlanadigan dars-yakuni coinlari:\n');
    for (const r of preview.rows) {
      console.log(
        `  ${r.email.padEnd(28)} ${String(r.coins).padStart(5)} coin ` +
          `(${r.rows} yozuv)   xp_total: ${r.xp_total} → ${Math.max(0, r.xp_total - r.coins)}`,
      );
    }

    if (!apply) {
      console.log('\nBu faqat KO\'RISH edi. Haqiqatan bajarish uchun: --apply');
      return;
    }

    await client.query('BEGIN');

    await client.query(
      `WITH refunded AS (
         SELECT user_id, SUM(amount)::int AS amount
           FROM xp_transactions
          WHERE source = 'lesson_complete'
          GROUP BY user_id
       )
       UPDATE user_gamification g
          SET xp_total  = GREATEST(0, g.xp_total  - r.amount),
              xp_weekly = GREATEST(0, g.xp_weekly - r.amount),
              level     = FLOOR(GREATEST(0, g.xp_total - r.amount) / 100) + 1
         FROM refunded r
        WHERE g.user_id = r.user_id`,
    );

    const deleted = await client.query(
      `DELETE FROM xp_transactions WHERE source = 'lesson_complete'`,
    );

    await client.query('COMMIT');
    console.log(`\nOK — ${deleted.rowCount} ta yozuv o'chirildi, coin qaytarildi.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('XATO:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();

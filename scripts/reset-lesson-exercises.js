/* eslint-disable @typescript-eslint/no-require-imports */
//
// BITTA MAVZU BO'YICHA MASHQ NATIJALARINI VA COINNI TOZALAYDI — qayta testlash uchun.
//
// Nima o'chiriladi:
//   1. exercise_results  — shu mavzu mashqlarining hamma urinishlari
//   2. xp_transactions   — source='exercise_complete', shu mavzu kalitlari
//   3. user_gamification — o'chirilgan coin xp_total/xp_weekly dan qaytariladi,
//                          level qayta hisoblanadi
//   (ixtiyoriy) 4. lesson_progress — `--lesson <uuid>` bilan
//                    (dars yakuni coin bermaydi, shuning uchun XP qaytarish yo'q)
//
// Ishga tushirish (backend papkasida):
//   node scripts/reset-lesson-exercises.js lesson1
//   node scripts/reset-lesson-exercises.js lesson1 --user ali@example.com
//   node scripts/reset-lesson-exercises.js lesson1 --lesson 3f2a…-uuid
//
// DIQQAT: qurilmadagi kesh ALOHIDA tozalanadi — ilovada mashq ostidagi
// «Tozalash» tugmasini BOSIB TURING (dev rejimida 1-mavzuning hamma mashq
// keshini urinishlar va coin bilan birga o'chiradi), so'ng darsni qayta oching.
//
require('dotenv').config();
const { Client } = require('pg');

const args = process.argv.slice(2);
const lessonPrefix = args.find((a) => /^lesson\d+$/.test(a));
const userEmail = argValue('--user');
const lessonId = argValue('--lesson');

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

if (!lessonPrefix) {
  console.error('Foydalanish: node scripts/reset-lesson-exercises.js lesson1 [--user email] [--lesson uuid]');
  process.exit(1);
}

const keyPattern = `${lessonPrefix}:%`;

(async () => {
  const client = new Client({ connectionString: process.env.DB_URL });
  await client.connect();
  try {
    let userId = null;
    if (userEmail) {
      const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [userEmail]);
      if (!rows.length) {
        console.error(`Foydalanuvchi topilmadi: ${userEmail}`);
        process.exit(1);
      }
      userId = rows[0].id;
    }

    await client.query('BEGIN');

    // 1) Coinni qaytarish. Bitta UPDATE: yig'indi CTE da hisoblanadi, level esa
    //    YANGI xp_total dan qayta chiqariladi (UPDATE ichida g.xp_total hali eski).
    const refunded = await client.query(
      `WITH refunded AS (
         SELECT user_id, SUM(amount)::int AS amount
           FROM xp_transactions
          WHERE source = 'exercise_complete'
            AND reference_key LIKE $1
            AND ($2::uuid IS NULL OR user_id = $2)
          GROUP BY user_id
       )
       UPDATE user_gamification g
          SET xp_total  = GREATEST(0, g.xp_total  - r.amount),
              xp_weekly = GREATEST(0, g.xp_weekly - r.amount),
              level     = FLOOR(GREATEST(0, g.xp_total - r.amount) / 100) + 1
         FROM refunded r
        WHERE g.user_id = r.user_id
       RETURNING g.user_id, r.amount`,
      [keyPattern, userId],
    );

    const xpDeleted = await client.query(
      `DELETE FROM xp_transactions
        WHERE source = 'exercise_complete'
          AND reference_key LIKE $1
          AND ($2::uuid IS NULL OR user_id = $2)`,
      [keyPattern, userId],
    );

    const resultsDeleted = await client.query(
      `DELETE FROM exercise_results
        WHERE exercise_key LIKE $1
          AND ($2::uuid IS NULL OR user_id = $2)`,
      [keyPattern, userId],
    );

    let lessonInfo = '';
    if (lessonId) {
      // Darsni boshidan yakunlab ko'rish uchun progress ham tozalanadi.
      // Dars yakuni COIN BERMAYDI (qoida o'zgargan), shuning uchun bu yerda
      // qaytariladigan XP yo'q — bazadagi eski `lesson_complete` yozuvlarini
      // butunlay olib tashlash uchun scripts/remove-lesson-complete-xp.js.
      const lp = await client.query(
        `DELETE FROM lesson_progress
          WHERE lesson_id = $1
            AND ($2::uuid IS NULL OR user_id = $2)`,
        [lessonId, userId],
      );
      lessonInfo = `\n  dars progressi:   ${lp.rowCount} ta yozuv`;
    }

    await client.query('COMMIT');

    const totalRefund = refunded.rows.reduce((s, r) => s + Number(r.amount), 0);
    console.log(
      `OK — "${lessonPrefix}" tozalandi` +
        (userEmail ? ` (faqat ${userEmail})` : ' (hamma foydalanuvchi)') +
        `\n  mashq natijalari: ${resultsDeleted.rowCount} ta yozuv` +
        `\n  coin yozuvlari:   ${xpDeleted.rowCount} ta` +
        `\n  qaytarilgan coin: ${totalRefund} (${refunded.rowCount} foydalanuvchida)` +
        lessonInfo +
        `\n\nEndi ilovada mashq ostidagi «Tozalash» tugmasini BOSIB TURING` +
        `\n(dev rejimida kesh butunlay tozalanadi), so'ng darsni qayta oching.`,
    );
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('XATO:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();

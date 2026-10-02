/* eslint-disable @typescript-eslint/no-require-imports */
// MUHIM: eski dinamik jadvallarni O'CHIRISHDAN OLDIN ishga tushiring!
//
// Teacher kiritgan barcha mashq kontentini (exercises + exercise_items,
// quiz/reading/listening/grammar bloklariga bog'langan holda) JSON faylga
// to'kadi. Bu JSON keyin mobil ilovadagi STATIK mashq fayllarining manbasi
// bo'ladi — usiz kontentni qo'lda qayta terishga to'g'ri keladi.
//
// Ishga tushirish (backend papkasida):
//   node scripts/export-exercises.js
// Natija: scripts/exercises-dump.json (darslar bo'yicha guruhlangan)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DB_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        u.order_index                    AS unit_order,
        u.title                          AS unit_title,
        l.id                             AS lesson_id,
        l.order_index                    AS lesson_order,
        l.title                          AS lesson_title,
        e.id                             AS exercise_id,
        e.owner_block_type               AS block_type,
        e.owner_block_id                 AS block_id,
        e.exercise_type                  AS exercise_type,
        e.title                          AS exercise_title,
        e.instructions                   AS instructions,
        e.order_index                    AS exercise_order,
        i.id                             AS item_id,
        i.item_text                      AS item_text,
        i.correct_answer                 AS correct_answer,
        i.options                        AS options,
        i.image_url                      AS image_url,
        i.explanation                    AS explanation,
        i.order_index                    AS item_order
      FROM exercises e
      JOIN lessons l          ON l.id = e.lesson_id
      LEFT JOIN units u       ON u.id = l.unit_id
      LEFT JOIN exercise_items i ON i.exercise_id = e.id
      ORDER BY u.order_index, l.order_index, e.order_index, i.order_index
    `);

    // Darslar bo'yicha guruhlash
    const lessons = new Map();
    for (const r of rows) {
      if (!lessons.has(r.lesson_id)) {
        lessons.set(r.lesson_id, {
          lessonId: r.lesson_id,
          unitOrder: r.unit_order,
          unitTitle: r.unit_title,
          lessonOrder: r.lesson_order,
          lessonTitle: r.lesson_title,
          exercises: new Map(),
        });
      }
      const lesson = lessons.get(r.lesson_id);
      if (!lesson.exercises.has(r.exercise_id)) {
        lesson.exercises.set(r.exercise_id, {
          exerciseId: r.exercise_id,
          blockType: r.block_type,
          blockId: r.block_id,
          exerciseType: r.exercise_type,
          title: r.exercise_title,
          instructions: r.instructions,
          orderIndex: r.exercise_order,
          items: [],
        });
      }
      if (r.item_id) {
        lesson.exercises.get(r.exercise_id).items.push({
          itemId: r.item_id,
          itemText: r.item_text,
          correctAnswer: r.correct_answer,
          options: r.options,
          imageUrl: r.image_url,
          explanation: r.explanation,
          orderIndex: r.item_order,
        });
      }
    }

    const out = [...lessons.values()].map((l) => ({
      ...l,
      exercises: [...l.exercises.values()],
    }));

    const outPath = path.join(__dirname, 'exercises-dump.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    const totalEx = out.reduce((s, l) => s + l.exercises.length, 0);
    const totalItems = out.reduce(
      (s, l) => s + l.exercises.reduce((s2, e) => s2 + e.items.length, 0),
      0,
    );
    console.log(`OK: ${out.length} dars, ${totalEx} mashq, ${totalItems} savol -> ${outPath}`);
  } catch (e) {
    console.error('XATO:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();

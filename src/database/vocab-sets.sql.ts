/**
 * LUG'AT TO'PLAMLARI (2026-10) — o'qituvchi darsning lug'atini almashtirsa, eski so'zlar
 * O'CHIRILMAYDI: ular eski to'plam (`set_no`) bo'lib qoladi, dars esa yangi to'plamga o'tadi.
 *
 *  - `vocabularys.set_no`        — so'z qaysi to'plamga tegishli (1 dan)
 *  - `lessons.vocab_set_no`      — darsning FAOL to'plami (yangi o'quvchilar shuni ko'radi)
 *  - `user_lesson_vocab_set`     — almashtirish paytida lug'atda faolligi bor o'quvchi ESKI
 *                                  to'plamga mixlanadi (progress, coin, takrorlash saqlanadi)
 *  - `vocab_visible(user, lesson, set)` — so'z shu o'quvchiga ko'rinadimi (mixlangan to'plam,
 *                                  bo'lmasa faol to'plam). `user = NULL` — faol to'plam (teacher).
 *                                  Lesson'siz so'z (lesson_id NULL) doim ko'rinadi.
 *
 * Idempotent: migratsiya (1790300000000) ham, ilova ishga tushganda ham (ensure-vocab-sets.ts)
 * shu ro'yxatni ishlatadi.
 */
export const VOCAB_SETS_SQL: string[] = [
  `ALTER TABLE vocabularys ADD COLUMN IF NOT EXISTS set_no integer NOT NULL DEFAULT 1`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS vocab_set_no integer NOT NULL DEFAULT 1`,
  `CREATE INDEX IF NOT EXISTS idx_vocabularys_lesson_set ON vocabularys (lesson_id, set_no)`,
  `CREATE TABLE IF NOT EXISTS user_lesson_vocab_set (
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
     set_no integer NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, lesson_id)
   )`,
  `CREATE OR REPLACE FUNCTION vocab_visible(p_user uuid, p_lesson uuid, p_set integer)
   RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT CASE WHEN p_lesson IS NULL THEN true
       ELSE p_set = COALESCE(
         (SELECT s.set_no FROM user_lesson_vocab_set s WHERE s.user_id = p_user AND s.lesson_id = p_lesson),
         (SELECT l.vocab_set_no FROM lessons l WHERE l.id = p_lesson)
       )
     END
   $$`,
];

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «OXIRGI FAOLLIK» = ilovada oxirgi onlayn bo'lgan vaqt (2026-10).
 *
 * `users.last_seen_at` — har avtorizatsiyali so'rovda (daqiqasiga 1 marta) va chat socket
 * ulanganda/uzilganda yoziladi (`src/common/services/last-seen.ts`). Avval teacher paneli
 * faqat dars progressiga qarardi — lug'at, chat yoki boshqa ekranda o'tirgan o'quvchi
 * «69 kun oldin» bo'lib ko'rinardi.
 *
 * Eski foydalanuvchilar uchun bor manbalardan eng so'nggisi bilan to'ldiriladi.
 * Idempotent: IF NOT EXISTS / faqat bo'sh qiymatlar to'ldiriladi.
 */
export class AddUserLastSeen1790200000000 implements MigrationInterface {
  name = 'AddUserLastSeen1790200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL`);
    await q.query(`
      UPDATE users u
         SET last_seen_at = t.seen
        FROM (
          SELECT u2.id,
                 GREATEST(
                   (SELECT max(pt.last_seen_at) FROM push_tokens pt WHERE pt.user_id = u2.id),
                   (SELECT max(lp.updated_at) FROM lesson_progress lp WHERE lp.user_id = u2.id),
                   (SELECT max(er.answered_at) FROM exercise_results er WHERE er.user_id = u2.id),
                   (SELECT max(sa.answered_at) FROM student_answers sa WHERE sa.user_id = u2.id),
                   (SELECT max(vs.updated_at) FROM vocabulary_sessions vs WHERE vs.user_id = u2.id),
                   (SELECT g.last_activity_date::timestamptz FROM user_gamification g WHERE g.user_id = u2.id)
                 ) AS seen
            FROM users u2
        ) t
       WHERE t.id = u.id AND u.last_seen_at IS NULL AND t.seen IS NOT NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS last_seen_at`);
  }
}

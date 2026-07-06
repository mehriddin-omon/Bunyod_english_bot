import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureExercisesUnified } from '../ensure-exercises-unified';

/**
 * quiz.md — quiz/reading/listening mashqlarini yagona `exercises` + `exercise_items`
 * tizimiga birlashtirish (owner_block_type/owner_block_id orqali).
 *
 * Amaliy ish `ensureExercisesUnified()` da (src/database/ensure-exercises-unified.ts):
 * u idempotent va prod (`npm run migration:run`) va dev (bootstrap, app.service.ts)
 * uchun BITTA joyda saqlanadi — ikkalasi ham bir xil natijaga olib keladi.
 */
export class UnifyExercises1784000000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    await ensureExercisesUnified();
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Ma'lumot ko'chirilib, eski jadvallar DROP qilingan — xavfsiz avtomatik
    // rollback mumkin emas (ma'lumot yo'qolishi bilan xatarli). Zarur bo'lsa
    // backup'dan tiklang.
    throw new Error(
      'UnifyExercises1784000000000: down migration qo\'llab-quvvatlanmaydi (ma\'lumot ko\'chirilgan, eski jadvallar DROP qilingan). Backup dan tiklang.',
    );
  }
}

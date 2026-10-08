import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LUG'AT BOSQICHLARI TARTIBI (2026-10) — qiyinlik bo'yicha qayta tartiblandi.
 *
 *   Eski:  1 karta        → 2 variantli test → 3 eshitib topish → 4 yozib yodlash
 *   Yangi: 1 variantli test → 2 eshitib topish → 3 karta        → 4 yozib yodlash
 *
 * Progress bosqich RAQAMI bilan saqlanadi, shuning uchun talaba aslida
 * o'tgan rejim saqlanib qolishi uchun raqamlar qayta moslanadi:
 *   eski 1 → 3,  eski 2 → 1,  eski 3 → 2,  4 o'zgarmaydi.
 *
 * `vocabulary_stage_progress` da (user_id, lesson_id, stage) UNIQUE — bitta
 * UPDATE'da almashtirish to'qnashuv beradi, shuning uchun avval vaqtincha
 * +10 ga suriladi, keyin yangi raqamga o'tkaziladi.
 */
export class ReorderVocabularyStages1789700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.remap(queryRunner, { 1: 3, 2: 1, 3: 2 });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.remap(queryRunner, { 3: 1, 1: 2, 2: 3 });
  }

  private async remap(queryRunner: QueryRunner, map: Record<number, number>) {
    const from = Object.keys(map).map(Number);
    const caseSql = (col: string, offset: number) =>
      `CASE ${col} ${from.map((f) => `WHEN ${f + offset} THEN ${map[f]}`).join(' ')} ELSE ${col} END`;

    // 1) vaqtincha surish
    await queryRunner.query(
      `UPDATE "vocabulary_stage_progress" SET "stage" = "stage" + 10 WHERE "stage" IN (${from.join(',')})`,
    );
    // 2) yangi raqamga
    await queryRunner.query(
      `UPDATE "vocabulary_stage_progress" SET "stage" = ${caseSql('"stage"', 10)} WHERE "stage" >= 10`,
    );

    // Sessiyalarda UNIQUE yo'q — to'g'ridan-to'g'ri
    await queryRunner.query(
      `UPDATE "vocabulary_sessions" SET "stage" = ${caseSql('"stage"', 0)} WHERE "stage" IN (${from.join(',')})`,
    );
  }
}

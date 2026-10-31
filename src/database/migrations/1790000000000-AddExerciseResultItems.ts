import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MASHQ JAVOBLARI TAFSILOTI (2026-10).
 *
 * `exercise_results` ga ikki ustun:
 *  - `title` — mashq nomi (ilova registridagi `titleUz`). Kontent ilovada statik,
 *    backend nomini boshqa yo'l bilan bilolmaydi — ilova har natija bilan yuboradi.
 *  - `items` — savollar bo'yicha natija: [{ q, given, expected, ok }].
 *    Teacher panel «qaysi savolda xato qildi»ni shundan ko'radi.
 *
 * Eski yozuvlarning `title` i quyidagi ro'yxatdan to'ldiriladi (ilovadagi
 * `src/constants/exerciseKeys.ts` ning 2026-10-26 holati). `items` eski
 * yozuvlarda NULL qoladi — ular faqat yangi ilova versiyasidan keladi.
 *
 * Idempotent: IF NOT EXISTS / title IS NULL.
 */
const TITLES: [string, string][] = [
  ['lesson1:grammar:ex1', "Kishilik olmoshlarini moslashtirish"],
  ['lesson1:grammar:ex2', "am / is / are bilan gaplarni to'ldirish"],
  ['lesson1:grammar:ex3', "«to be» ning to'g'ri shaklini tanlash"],
  ['lesson1:grammar:ex4', "Matnni «to be» bilan to'ldirish (Anna)"],
  ['lesson1:grammar:ex5', "Gaplarni SVOMPT tartibida joylashtirish"],
  ['lesson1:grammar:ex6', "Matnni «to be» bilan to'ldirish (Aziz)"],
  ['lesson2:grammar:ex1', "Present Simple — mashq"],
  ['lesson2:grammar:ex2', "Present Simple — fe'l shaklini tanlash (1)"],
  ['lesson2:grammar:ex3', "Gaplarni SVOMPT tartibida joylashtirish"],
  ['lesson2:grammar:ex4', "Present Simple — fe'l shaklini tanlash (2)"],
  ['lesson2:grammar:ex5', "Ro'yxatdan mos fe'lni tanlash"],
  ['lesson2:grammar:ex6', "Tarjima — o'zbekchadan inglizchaga"],
  ['lesson2:grammar:ex8', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ['lesson2:grammar:ex7', "Gaplarni SVOMPT tartibida joylashtirish (yangi)"],
  ['lesson3:grammar:ex1', "Present Continuous — mashq"],
  ['lesson3:grammar:ex2', "Present Simple yoki Continuous"],
  ['lesson3:grammar:ex3', "Xatolarni to'g'rilash"],
  ['lesson3:grammar:ex4', "True yoki False"],
  ['lesson3:grammar:ex5', "Tarjima — o'zbekchadan inglizchaga"],
  ['lesson3:grammar:ex6', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ['lesson4:grammar:ex1', "Past Simple — mashq"],
  ['lesson4:grammar:ex2', "Ro'yxatdagi fe'lni Past Simple da qo'yish"],
  ['lesson4:grammar:ex3', "Past Simple — gaplarni to'ldirish"],
  ['lesson4:grammar:ex4', "Ro'yxatdan mos fe'lni tanlash"],
  ['lesson4:grammar:ex5', "Tarjima — o'zbekchadan inglizchaga"],
  ['lesson4:grammar:ex6', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ['lesson5:grammar:ex1', "Past Continuous — mashq"],
  ['lesson5:grammar:ex2', "Past Simple yoki Continuous (1)"],
  ['lesson5:grammar:ex3', "Past Simple yoki Continuous — matnlar"],
  ['lesson5:grammar:ex4', "Past Simple yoki Continuous (2)"],
  ['lesson5:grammar:ex5', "Tarjima — o'zbekchadan inglizchaga"],
  ['lesson5:grammar:ex6', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ['lesson6:grammar:ex1', "Future — mashq"],
  ['lesson6:grammar:ex2', "«will» yoki «to be going to» — dialoglar"],
  ['lesson6:grammar:ex3', "will / going to — ro'yxatdan fe'l"],
  ['lesson6:grammar:ex4', "will yoki be going to"],
  ['lesson6:grammar:ex5', "Tarjima — o'zbekchadan inglizchaga"],
  ['lesson6:grammar:ex6', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ['lesson7:grammar:ex1', "Predloglar (at / in / on)"],
  ['lesson7:grammar:ex2', "Future Simple yoki Future Continuous"],
  ['lesson7:grammar:ex3', "Vaqt predloglari (at / in / on)"],
  ['lesson7:grammar:ex4', "Joy va vaqt predloglari"],
  ['lesson7:grammar:ex5', "Future Simple, going to, Future Continuous"],
  ['lesson7:grammar:ex6', "Tarjima — o'zbekchadan inglizchaga"],
  ['lesson7:grammar:ex8', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ['lesson7:grammar:ex7', "Test — 1–7-darslar zamonlari"],
  ['lesson8:grammar:ex1', "So'roq gap tartibi"],
  ['lesson8:grammar:ex2', "Bitta gapdan beshta savol"],
  ['lesson8:grammar:ex3', "Ajratilgan bo'lakka savol berish"],
  ['lesson8:grammar:ex4', "Tarjima — o'zbekchadan inglizchaga"],
  ['lesson8:grammar:ex5', "Bitta gapdan beshta savol (so'roq so'zi, ko'makchi, fe'l)"],
  ['lesson8:grammar:ex6', "Ajratilgan bo'lakka savol berish (so'roq so'zi, ko'makchi, fe'l)"],
  ['lesson8:grammar:ex7', "Bitta gapdan beshta savol — yozib"],
  ['lesson8:grammar:ex8', "Ajratilgan bo'lakka savol berish — yozib"],
  ['lesson8:grammar:ex9', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ['lesson9:grammar:ex1', "Artikllar (a / an / the / —)"],
  ['lesson10:grammar:ex1', "10-dars mashqi"],
  ['lesson11:grammar:ex1', "11-dars mashqi"],
  ['lesson12:grammar:ex1', "12-dars mashqi"],
  ['lesson13:grammar:ex1', "13-dars mashqi"],
  ['lesson14:grammar:ex1', "14-dars mashqi"],
  ['lesson15:grammar:ex1', "15-dars mashqi"],
  ['lesson16:grammar:ex1', "16-dars mashqi"],
  ['lesson17:grammar:ex1', "17-dars mashqi"],
  ['lesson18:grammar:ex1', "18-dars mashqi"],
  ['lesson19:grammar:ex1', "19-dars mashqi"],
  ['lesson20:grammar:ex1', "20-dars mashqi"],
];

export class AddExerciseResultItems1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exercise_results" ADD COLUMN IF NOT EXISTS "title" character varying(200)`,
    );
    await queryRunner.query(`ALTER TABLE "exercise_results" ADD COLUMN IF NOT EXISTS "items" jsonb`);

    const values = TITLES.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    await queryRunner.query(
      `UPDATE "exercise_results" r SET "title" = v.title
         FROM (VALUES ${values}) AS v(key, title)
        WHERE r."exercise_key" = v.key AND r."title" IS NULL`,
      TITLES.flat(),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exercise_results" DROP COLUMN IF EXISTS "items"`);
    await queryRunner.query(`ALTER TABLE "exercise_results" DROP COLUMN IF EXISTS "title"`);
  }
}

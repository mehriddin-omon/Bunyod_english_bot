/**
 * Ilovadagi statik grammatika mashqlari — EKRANDAGI tartibda («Exercise 1, 2, …») va nomi bilan.
 *
 * Nega kerak: ilovada kalit raqami (`ex5`) qo'shilish tartibida beriladi, ekrandagi
 * joyga bog'lanmaydi (ilova: `src/constants/exerciseKeys.ts`, 3-qoida). Masalan 1-darsda
 * ekranda 2-mashq — `lesson1:grammar:ex5`. Teacher paneldagi «Mavzular bo'yicha statistika»
 * mashqlarni shu ro'yxat bo'yicha raqamlaydi va tartiblaydi.
 *
 * Nomi — ilova registridagi `titleUz`; faqat natijada nom saqlanmagan bo'lsa ishlatiladi
 * (eski ilova versiyalari `title` yubormagan). Natijadagi nom doim ustun.
 *
 * Manba: ilovadagi `src/components/grammars/lesson{N}.tsx` — `export default` ichidagi
 * mashqlar ketma-ketligi. Ilovada mashq qo'shilsa/olib tashlansa/joyi almashsa — shu yerda ham.
 * Ro'yxatda yo'q kalit (ekrandan olingan yoki hali yozilmagan) raqamsiz, oxirida chiqadi.
 */
export const GRAMMAR_SCREEN_ORDER: Record<string, readonly (readonly [ex: string, title: string])[]> = {
  'lesson1:grammar': [
    ['ex1', 'Kishilik olmoshlarini moslashtirish'],
    ['ex2', "Gaplarni SVOMPT tartibida joylashtirish"],
    ['ex3', "am / is / are bilan gaplarni to'ldirish"],
    ['ex4', "Matnni «to be» bilan to'ldirish (Aziz)"],
  ],
  // Listening — ilova ichidagi kontent (ilova: src/content/listening/lesson1.ts)
  'lesson1:listening': [['ex1', 'Tinglab, hayvonni transportga ulash']],
  // Listening — ilova ichidagi kontent (ilova: src/content/listening/lesson2.ts)
  'lesson2:listening': [
    ['ex1', "Dialogni tinglab, bo'sh joylarni to'ldirish"],
    ['ex2', 'Tinglab, kiyimni hayvonga ulash'],
  ],
  'lesson2:grammar': [
    ['ex1', "Present Simple — fe'l shaklini yozish"],
    ['ex2', 'Gaplarni SVOMPT tartibida joylashtirish (3-variant)'],
    ['ex3', "Present Simple — fe'l shaklini yozish (2)"],
    ['ex4', "Ro'yxatdan mos fe'lni tanlab yozish"],
    ['ex5', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson3:grammar': [
    ['ex1', 'Present Simple yoki Continuous'],
    ['ex2', "Xatolarni to'g'rilash"],
    ['ex3', 'True yoki False'],
    ['ex4', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson4:grammar': [
    ['ex1', "Ro'yxatdagi fe'lni Past Simple da qo'yish"],
    ['ex2', "Past Simple — gaplarni to'ldirish"],
    ['ex3', "Ro'yxatdan mos fe'lni tanlash"],
    ['ex4', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson5:grammar': [
    ['ex1', 'Past Simple yoki Continuous (1)'],
    ['ex2', 'Past Simple yoki Continuous — matnlar'],
    ['ex3', 'Past Simple yoki Continuous (2)'],
    ['ex4', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson6:grammar': [
    ['ex1', '«will» yoki «to be going to» — dialoglar'],
    ['ex2', "will / going to — ro'yxatdan fe'l"],
    ['ex3', 'will yoki be going to'],
    ['ex4', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson7:grammar': [
    ['ex1', 'Future Simple yoki Future Continuous'],
    ['ex2', 'Vaqt predloglari (at / in / on)'],
    ['ex3', "Joy va vaqt predloglari"],
    ['ex4', 'Future Simple, going to, Future Continuous'],
    ['ex5', "Tarjima — o'zbekchadan inglizchaga, yozib"],
    ['ex6', 'Test — 1–7-darslar zamonlari'],
  ],
  'lesson8:grammar': [
    ['ex1', "Bitta gapdan beshta savol — yozib"],
    ['ex2', "Ajratilgan bo'lakka savol berish — yozib"],
    ['ex3', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  // 9–12-darslar 2026-10-30 da yangi PDF bo'yicha qayta yozildi
  'lesson9:grammar': [
    ['ex1', "Artikllar — a / an / the / — bilan to'ldirish"],
    ['ex2', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson10:grammar': [
    ['ex6', "Modal fe'llar — ro'yxatdan yozib to'ldirish"],
    ['ex2', "can / can't / could / couldn't"],
    ['ex3', "mustn't yoki needn't"],
    ['ex4', "Test — modal fe'llar"],
    ['ex5', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson11:grammar': [
    ['ex1', "Passive Voice — gaplarni to'ldirish"],
    ['ex2', "Active → Passive, yozib"],
    ['ex3', 'Test — Active yoki Passive'],
    ['ex4', "Tarjima — o'zbekchadan inglizchaga, yozib"],
  ],
  'lesson12:grammar': [
    ['ex1', 'Imtihon — zamonlar formulalari'],
    ['ex2', 'Imtihon — 40 ta test'],
    ['ex3', "Imtihon — tarjima (Writing), yozib"],
  ],
  // Listening — ilova ichidagi kontent (ilova: src/content/listening/lessonN.ts), 2026-10-30
  'lesson4:listening': [
    ['ex1', 'Tinglab, mos rasmni tanlash'],
    ['ex2', 'World Travel — formani belgilash'],
  ],
  'lesson5:listening': [
    ['ex1', 'Tinglab, mos rasmni tanlash'],
    ['ex2', "Paul o'tgan hafta nima qildi — kunni ishga ulash"],
  ],
  'lesson6:listening': [
    ['ex1', 'Tinglab, mos rasmni tanlash'],
    ['ex2', 'Information — formani belgilash'],
  ],
  'lesson7:listening': [
    ['ex1', 'Tinglab, mos rasmni tanlash'],
    ['ex2', 'Sheffield Sports Club — formani belgilash'],
  ],
  'lesson8:listening': [
    ['ex1', 'Sonlarni eshitib yozish'],
    ['ex2', 'Ikki sondan eshitilganini tanlash'],
    ['ex3', 'Misollarni eshitib yozish'],
  ],
  'lesson9:listening': [
    ['ex1', "Phone Message — formani to'ldirish"],
    ['ex2', "South Seas Travel Agency — formani to'ldirish"],
  ],
  'lesson10:listening': [
    ['ex1', "Notebook — formani to'ldirish"],
    ['ex2', "Notes — formani to'ldirish"],
  ],
  'lesson11:listening': [
    ['ex1', "Toni's had an accident — formani to'ldirish"],
    ['ex2', "Park Farm — formani to'ldirish"],
  ],
  'lesson12:listening': [['ex1', 'Computer Course — formani belgilash']],
  // Reading — ilova ichidagi kontent (ilova: src/content/reading/lessonN.ts), 2026-10-30.
  // Qolgan readinglarga mashq qo'shilganda shu yerga ham.
  'lesson2:reading': [['ex1', 'A Normal Day — matnni gapma-gap tarjima qilish']],
  'lesson3:reading': [['ex1', "Jamila's Day — matnni gapma-gap tarjima qilish"]],
  'lesson4:reading': [['ex1', 'Present — matnni gapma-gap tarjima qilish']],
  'lesson5:reading': [['ex1', 'The Zoo — matnni gapma-gap tarjima qilish']],
  'lesson6:reading': [['ex1', 'Lucy (Reading Comprehension) — matnni gapma-gap tarjima qilish']],
  'lesson7:reading': [['ex1', 'A Weekend in London — matnni gapma-gap tarjima qilish']],
  'lesson8:reading': [['ex1', 'The Honeybee — matnni gapma-gap tarjima qilish']],
  'lesson9:reading': [['ex1', 'Volcanoes — matnni gapma-gap tarjima qilish']],
  'lesson10:reading': [['ex1', 'Rainforests — matnni gapma-gap tarjima qilish']],
  'lesson11:reading': [['ex1', 'The Ocean — matnni gapma-gap tarjima qilish']],
  'lesson12:reading': [['ex1', 'Flamingos — True or False']],
  'lesson13:grammar': [
    ['ex1', '13-dars mashqi'],
  ],
  'lesson14:grammar': [
    ['ex1', '14-dars mashqi'],
  ],
  'lesson15:grammar': [
    ['ex1', '15-dars mashqi'],
  ],
  'lesson16:grammar': [
    ['ex1', '16-dars mashqi'],
  ],
  'lesson17:grammar': [
    ['ex1', '17-dars mashqi'],
  ],
  'lesson18:grammar': [
    ['ex1', '18-dars mashqi'],
  ],
  'lesson19:grammar': [
    ['ex1', '19-dars mashqi'],
  ],
  'lesson20:grammar': [
    ['ex1', '20-dars mashqi'],
  ],
};

/**
 * Ekrandan olib tashlangan (ilovada `retired: true`) mashqlar nomi — ularning eski natijalari
 * teacher panelda ro'yxat oxirida, raqamsiz chiqadi va bo'lim foiziga KIRADI (ko'rsatilgani hisoblanadi).
 */
export const RETIRED_GRAMMAR_TITLES: Record<string, string> = {
  // 2026-10-30: baza tozalanib kalitlar qayta raqamlandi — hozircha muzlatilgan mashq yo'q
};

/**
 * "lesson1:grammar:ex5" → `{ no: 2, title: '…' }` (ekrandagi raqami 1 dan) yoki `null` (ro'yxatda yo'q).
 */
export function screenInfo(exerciseKey: string): { no: number; title: string } | null {
  const [lesson, section, ex] = exerciseKey.split(':');
  const list = GRAMMAR_SCREEN_ORDER[`${lesson}:${section}`];
  const i = list?.findIndex(([k]) => k === ex) ?? -1;
  return list && i >= 0 ? { no: i + 1, title: list[i][1] } : null;
}

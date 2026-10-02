/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MOCK (DEMO) MA'LUMOT SKRIPTI
 *  Ishga tushirish:  npm run seed:mock
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Nima qiladi:
 *   • 200 o'quvchi, 10 subTeacher, 4 teacher, admin va superAdmin yaratadi
 *   • 10 ta guruh, jadval, o'tgan/kelgusi darslar (sessions) va davomat
 *   • Har bir o'quvchi uchun: progress, ballar, XP, liga, streak, reyting,
 *     kunlik faollik, so'z o'rganish, topshiriq javoblari, bildirishnomalar
 *   • Bazadagi HAR BIR jadval va ustun to'ldiriladi (bo'sh ustun qolmaydi)
 *
 *  Darslar:
 *   • Bazada published darslar bo'lsa — o'shalar ishlatiladi (yangi yaratilmaydi)
 *   • Bo'lmasa — "Grammar (4th edition)" dars rejasidagi 1–36 darslar yaratiladi
 *     (mavzular aynan shu fayldan olingan, chetdan mavzu qo'shilmagan)
 *
 *  Qayta ishga tushirish xavfsiz: skript avval o'zi yaratgan mock yozuvlarni
 *  o'chiradi (username ro'yxati va guruh nomlari bo'yicha), sizning haqiqiy
 *  kontentingizga tegmaydi.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// ─── Sozlamalar ──────────────────────────────────────────────────────────────
const CFG = {
  students: 200,
  /**
   * Yordamchi o'qituvchilar. Markazda guruhni faqat BITTA "katta o'qituvchi"
   * boshqaradi (quyidagi `resolveOwner` topadi), qolganlari — subTeacher.
   */
  subTeachers: 12,
  groups: 10,
  /** nechta o'quvchi guruhsiz qoladi (UI'dagi "guruhsiz" holatni tekshirish uchun) */
  studentsWithoutGroup: 14,
  /** kunlik faollik necha kunga orqaga yoziladi */
  trackingDays: 90,
  /** o'tmishdagi dars sessiyalari (hafta) */
  pastWeeks: 9,
  futureWeeks: 3,
  /** bitta o'quvchi uchun eng ko'p necha darsga javob yoziladi */
  answeredLessonsPerStudent: 3,
  password: {
    superAdmin: 'SuperAdmin123',
    admin: 'Admin123',
    teacher: 'Teacher123',
    subTeacher: 'SubTeacher123',
    student: 'Student123',
  },
};

// ─── Deterministik random (har safar bir xil natija) ─────────────────────────
let _seed = 20260817;
function rnd(): number {
  _seed |= 0; _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle([...arr]).slice(0, Math.min(n, arr.length));
}

// ─── Sana yordamchilari ──────────────────────────────────────────────────────
const DAY = 86400000;
const NOW = new Date();
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY);
/** Dushanba = 0 formatidagi hafta boshi */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dow);
  return d;
}
/** JS getDay() (0=Yakshanba) → loyiha formati (0=Dushanba) */
const projDay = (d: Date) => (d.getDay() + 6) % 7;

// ─── Ism-familiya banki (o'zbekcha) ─────────────────────────────────────────
const MALE = ['Abdulaziz','Akbar','Alisher','Amir','Aziz','Bahrom','Behruz','Bekzod','Bobur','Davron','Diyor','Doston','Eldor','Elyor','Farrux','Firdavs','G\'ayrat','Hasan','Husan','Ibrohim','Ilhom','Islom','Jahongir','Jasur','Javohir','Kamron','Laziz','Muhammad','Mustafo','Nodir','Nurbek','Odil','Otabek','Rustam','Sanjar','Sardor','Shohruh','Sherzod','Temur','Ulug\'bek','Umid','Zafar','Zoir','Ziyod','Asror'];
const FEMALE = ['Aziza','Barno','Charos','Dildora','Dilnoza','Durdona','Feruza','Gulbahor','Gulnora','Hilola','Iroda','Kamola','Lobar','Madina','Malika','Mohira','Muslima','Nafisa','Nargiza','Nilufar','Nodira','Ozoda','Rayhona','Robiya','Sabina','Sarvinoz','Sevara','Shahnoza','Sitora','Umida','Yulduz','Zarina','Zebo','Zilola','Zuhra','Aziyza','Muattar','Nozima','Sadoqat','Xurshida'];
const SURNAMES = ['Abdullayev','Aliyev','Axmedov','Bekmurodov','Ergashev','Fayziyev','G\'aniyev','Hakimov','Ibrohimov','Islomov','Jalilov','Karimov','Xolmatov','Mahmudov','Mirzayev','Muminov','Nazarov','Normatov','Olimov','Qodirov','Rahimov','Rasulov','Saidov','Salimov','Sultonov','Tursunov','Umarov','Usmonov','Xudoyberdiyev','Yusupov','Zokirov','Shermatov','To\'rayev','Qurbonov','Halilov'];
const ADDRESSES = ['Toshkent sh., Chilonzor t., 12-mavze','Toshkent sh., Yunusobod t., 4-kvartal','Toshkent sh., Mirzo Ulug\'bek t., Buyuk Ipak Yo\'li','Toshkent sh., Sergeli t., 7-mavze','Toshkent sh., Yakkasaroy t., Shota Rustaveli','Samarqand sh., Registon ko\'chasi','Buxoro sh., Mustaqillik ko\'chasi','Andijon sh., Navoiy shoh ko\'chasi','Farg\'ona sh., Al-Farg\'oniy ko\'chasi','Namangan sh., Uychi ko\'chasi','Qarshi sh., Nasaf ko\'chasi','Nukus sh., Do\'stlik ko\'chasi','Guliston sh., Sirdaryo ko\'chasi','Jizzax sh., Sharof Rashidov ko\'chasi','Urganch sh., Al-Xorazmiy ko\'chasi'];
const GOALS = ['IELTS 7.0 olish','Chet elda o\'qish','Ish uchun ingliz tili','Erkin gaplashishni o\'rganish','Universitetga tayyorgarlik','CEFR B2 sertifikati','Suhbatga tayyorgarlik','Grammatikani mustahkamlash','Til to\'sig\'ini yengish','Xorijiy hamkorlar bilan muloqot'];
const SPECIALIZATIONS = ['General English','IELTS Preparation','Business English','Grammar & Writing','Speaking & Listening','Kids English'];
const BIOS = [
  'Bunyod o\'quv markazida 5 yildan beri dars beradi. Grammatika va yozuv bo\'yicha mutaxassis.',
  'IELTS 8.0 sertifikati egasi. Talabalarni xalqaro imtihonlarga tayyorlaydi.',
  'Muloqot metodikasi tarafdori — darslarda amaliy suhbatga urg\'u beradi.',
  'Filologiya magistri. Bolalar va o\'smirlar guruhlari bilan ishlaydi.',
  'Xorijda 3 yil tajriba. Business English yo\'nalishida dars beradi.',
];

// ─── Grammar (4th edition) dars rejasi — mavzular aynan fayldan ──────────────
// Manba: "Grammar lesson plan (4rd edition).docx" (Lesson 1–36)
const GRAMMAR_PLAN: { n: number; topic: string; family: string }[] = [
  { n: 1,  topic: 'Pronoun / SVOMPT / "TO BE"', family: 'tobe' },
  { n: 2,  topic: 'Present Simple', family: 'presentSimple' },
  { n: 3,  topic: 'Present Continuous', family: 'presentCont' },
  { n: 4,  topic: 'Past Simple', family: 'pastSimple' },
  { n: 5,  topic: 'Past Continuous', family: 'pastCont' },
  { n: 6,  topic: 'Future Simple / to be going to', family: 'future' },
  { n: 7,  topic: 'Future Continuous / Prepositions (at, in, on)', family: 'prepositions' },
  { n: 8,  topic: 'Yes/No questions / Special questions', family: 'questions' },
  { n: 9,  topic: 'Definite & Indefinite articles', family: 'articles' },
  { n: 10, topic: 'Modal I (can, could, may, must, mustn\'t, needn\'t, should, ought to, shall)', family: 'modals' },
  { n: 11, topic: 'Passive Voice I (simple tenses)', family: 'passive' },
  { n: 12, topic: 'Exam: Structure, Grammar, Vocabulary, Listening, Reading, Writing', family: 'exam' },
  { n: 13, topic: 'Present Perfect', family: 'presentPerfect' },
  { n: 14, topic: 'Present Perfect Continuous', family: 'presentPerfect' },
  { n: 15, topic: 'Past Perfect', family: 'pastPerfect' },
  { n: 16, topic: 'Future Perfect', family: 'future' },
  { n: 17, topic: 'Infinitive & Gerund I', family: 'gerund' },
  { n: 18, topic: 'Modal verbs II (to be able to, have to, might)', family: 'modals' },
  { n: 19, topic: 'Modal verbs III (would, had better, to be to, modal + have + V3)', family: 'modals' },
  { n: 20, topic: 'Passive voice II', family: 'passive' },
  { n: 21, topic: 'Have something done / Personal & Impersonal construction', family: 'passive' },
  { n: 22, topic: 'Adjective', family: 'adjective' },
  { n: 23, topic: 'Adverb', family: 'adverb' },
  { n: 24, topic: 'Exam: Structure, Grammar, Vocabulary, Listening, Reading, Writing, Speaking', family: 'exam' },
  { n: 25, topic: 'Infinitive II', family: 'gerund' },
  { n: 26, topic: 'Gerund II', family: 'gerund' },
  { n: 27, topic: 'Infinitive & Gerund III', family: 'gerund' },
  { n: 28, topic: 'Conditionals (0, 1, 2, 3)', family: 'conditionals' },
  { n: 29, topic: 'Conditionals II / Wishes', family: 'conditionals' },
  { n: 30, topic: 'Relative clause', family: 'relative' },
  { n: 31, topic: 'Relative clause II', family: 'relative' },
  { n: 32, topic: 'Reported Speech', family: 'reported' },
  { n: 33, topic: 'Reported Questions / Reported Commands', family: 'reported' },
  { n: 34, topic: 'Both / Neither, All / None, Either', family: 'quantifiers' },
  { n: 35, topic: 'Tag questions / So, Neither', family: 'tags' },
  { n: 36, topic: 'Exam: Grammar, Vocabulary, Listening, Reading, Writing, Speaking', family: 'exam' },
];

type McqDef = { q: string; options: string[]; correct: string };
type FillDef = { q: string; answer: string };
type TfDef = { q: string; answer: 'true' | 'false' };
type MatchDef = { left: string; right: string };
type FamilyKit = { mcq: McqDef[]; fill: FillDef[]; tf: TfDef[]; match: MatchDef[] };

// Har bir grammatik oila uchun mashq banki
const FAMILY_KIT: Record<string, FamilyKit> = {
  tobe: {
    mcq: [
      { q: 'My sister ___ a doctor.', options: ['am', 'is', 'are', 'be'], correct: 'is' },
      { q: '___ they at home now?', options: ['Is', 'Am', 'Are', 'Do'], correct: 'Are' },
      { q: 'I ___ not ready yet.', options: ['am', 'is', 'are', 'do'], correct: 'am' },
    ],
    fill: [
      { q: 'We ___ students of this centre.', answer: 'are' },
      { q: 'He ___ from Samarkand.', answer: 'is' },
    ],
    tf: [
      { q: '"They is teachers." — bu gap to\'g\'ri.', answer: 'false' },
      { q: 'SVOMPT tartibida "place" "time" dan oldin keladi.', answer: 'true' },
    ],
    match: [{ left: 'I', right: 'am' }, { left: 'She', right: 'is' }, { left: 'They', right: 'are' }, { left: 'It', right: 'is' }],
  },
  presentSimple: {
    mcq: [
      { q: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'went'], correct: 'goes' },
      { q: 'They ___ like coffee.', options: ['doesn\'t', 'don\'t', 'isn\'t', 'aren\'t'], correct: 'don\'t' },
      { q: '___ he work on Saturdays?', options: ['Do', 'Does', 'Is', 'Are'], correct: 'Does' },
    ],
    fill: [
      { q: 'My father ___ (drive) to work every morning.', answer: 'drives' },
      { q: 'We usually ___ (have) dinner at seven.', answer: 'have' },
    ],
    tf: [
      { q: 'Present Simple odatiy, takrorlanuvchi harakatlar uchun ishlatiladi.', answer: 'true' },
      { q: '"He don\'t know" — to\'g\'ri shakl.', answer: 'false' },
    ],
    match: [{ left: 'always', right: 'doim' }, { left: 'usually', right: 'odatda' }, { left: 'rarely', right: 'kamdan-kam' }, { left: 'never', right: 'hech qachon' }],
  },
  presentCont: {
    mcq: [
      { q: 'Look! The baby ___ .', options: ['sleeps', 'is sleeping', 'slept', 'sleep'], correct: 'is sleeping' },
      { q: 'They ___ football at the moment.', options: ['play', 'plays', 'are playing', 'played'], correct: 'are playing' },
      { q: 'I ___ for my friend right now.', options: ['wait', 'waits', 'am waiting', 'waited'], correct: 'am waiting' },
    ],
    fill: [
      { q: 'She ___ (read) a book now.', answer: 'is reading' },
      { q: 'We ___ (not/watch) TV at the moment.', answer: 'are not watching' },
    ],
    tf: [
      { q: '"know", "like", "want" fe\'llari odatda Continuous shaklda ishlatilmaydi.', answer: 'true' },
      { q: 'Present Continuous faqat kelasi zamon uchun ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'now', right: 'hozir' }, { left: 'at the moment', right: 'ayni paytda' }, { left: 'currently', right: 'hozirda' }, { left: 'still', right: 'hamon' }],
  },
  pastSimple: {
    mcq: [
      { q: 'I ___ a film yesterday.', options: ['watch', 'watched', 'watching', 'watches'], correct: 'watched' },
      { q: 'He ___ to London last year.', options: ['go', 'goes', 'went', 'gone'], correct: 'went' },
      { q: 'They ___ not come to the lesson.', options: ['do', 'did', 'does', 'are'], correct: 'did' },
    ],
    fill: [
      { q: 'She ___ (buy) a new phone last week.', answer: 'bought' },
      { q: 'We ___ (see) him two days ago.', answer: 'saw' },
    ],
    tf: [
      { q: '"go" fe\'lining 2-shakli — "went".', answer: 'true' },
      { q: 'Past Simple da "did" dan keyin fe\'l 2-shaklda keladi.', answer: 'false' },
    ],
    match: [{ left: 'go', right: 'went' }, { left: 'eat', right: 'ate' }, { left: 'see', right: 'saw' }, { left: 'have', right: 'had' }],
  },
  pastCont: {
    mcq: [
      { q: 'She ___ when I called her.', options: ['cooks', 'cooked', 'was cooking', 'is cooking'], correct: 'was cooking' },
      { q: 'They ___ football at 5 pm yesterday.', options: ['were playing', 'was playing', 'play', 'played'], correct: 'were playing' },
      { q: 'While I ___ , the phone rang.', options: ['sleep', 'slept', 'was sleeping', 'am sleeping'], correct: 'was sleeping' },
    ],
    fill: [
      { q: 'I ___ (wait) for the bus when it started to rain.', answer: 'was waiting' },
      { q: 'They ___ (not/listen) to the teacher.', answer: 'were not listening' },
    ],
    tf: [
      { q: '"while" ko\'pincha Past Continuous bilan ishlatiladi.', answer: 'true' },
      { q: 'Past Continuous da "was" ko\'plik uchun ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'I / He / She', right: 'was' }, { left: 'We / They', right: 'were' }, { left: 'while', right: '-yotgan payt' }, { left: 'when', right: 'qachonki' }],
  },
  future: {
    mcq: [
      { q: 'I think it ___ rain tomorrow.', options: ['will', 'is', 'was', 'does'], correct: 'will' },
      { q: 'Look at the clouds! It ___ rain.', options: ['will', 'is going to', 'goes to', 'was'], correct: 'is going to' },
      { q: 'By 2030 they ___ finished the project.', options: ['will', 'will have', 'have', 'had'], correct: 'will have' },
    ],
    fill: [
      { q: 'We ___ (visit) our grandparents next Sunday.', answer: 'will visit' },
      { q: 'She ___ (start) a new job next month. (reja)', answer: 'is going to start' },
    ],
    tf: [
      { q: '"to be going to" oldindan rejalashtirilgan harakat uchun ishlatiladi.', answer: 'true' },
      { q: 'Future Simple "will" dan keyin fe\'l -ing bilan keladi.', answer: 'false' },
    ],
    match: [{ left: 'will', right: 'qaror hozir qabul qilindi' }, { left: 'be going to', right: 'oldindan reja' }, { left: 'will have V3', right: 'Future Perfect' }, { left: 'will be V-ing', right: 'Future Continuous' }],
  },
  prepositions: {
    mcq: [
      { q: 'The lesson starts ___ 9 o\'clock.', options: ['in', 'on', 'at', 'to'], correct: 'at' },
      { q: 'My birthday is ___ May.', options: ['in', 'on', 'at', 'by'], correct: 'in' },
      { q: 'We meet ___ Monday.', options: ['in', 'on', 'at', 'of'], correct: 'on' },
    ],
    fill: [
      { q: 'The shop opens ___ 8 am.', answer: 'at' },
      { q: 'He was born ___ 1998.', answer: 'in' },
    ],
    tf: [
      { q: 'Hafta kunlari bilan "on" ishlatiladi.', answer: 'true' },
      { q: 'Yillar bilan "on" ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'at', right: 'aniq vaqt' }, { left: 'in', right: 'oy, yil, fasl' }, { left: 'on', right: 'kun, sana' }, { left: 'by', right: '...gacha' }],
  },
  questions: {
    mcq: [
      { q: '___ do you live?', options: ['What', 'Where', 'Who', 'When'], correct: 'Where' },
      { q: '___ you like tea?', options: ['Do', 'Does', 'Is', 'Are'], correct: 'Do' },
      { q: '___ many students are there?', options: ['How', 'What', 'Which', 'Why'], correct: 'How' },
    ],
    fill: [
      { q: '___ is your favourite subject?', answer: 'What' },
      { q: '___ did she leave early?', answer: 'Why' },
    ],
    tf: [
      { q: 'Yes/No savollar yordamchi fe\'l bilan boshlanadi.', answer: 'true' },
      { q: 'Special question "do/does" bilan boshlanadi.', answer: 'false' },
    ],
    match: [{ left: 'What', right: 'nima' }, { left: 'Where', right: 'qayerda' }, { left: 'When', right: 'qachon' }, { left: 'Why', right: 'nega' }],
  },
  articles: {
    mcq: [
      { q: 'I saw ___ elephant at the zoo.', options: ['a', 'an', 'the', '-'], correct: 'an' },
      { q: '___ sun is very bright today.', options: ['A', 'An', 'The', '-'], correct: 'The' },
      { q: 'She is ___ engineer.', options: ['a', 'an', 'the', '-'], correct: 'an' },
    ],
    fill: [
      { q: 'He bought ___ new car yesterday.', answer: 'a' },
      { q: '___ Earth goes around the Sun.', answer: 'The' },
    ],
    tf: [
      { q: 'Unli tovush bilan boshlanuvchi so\'zlar oldidan "an" qo\'yiladi.', answer: 'true' },
      { q: 'Ko\'plikdagi noaniq otlar oldidan "a" qo\'yiladi.', answer: 'false' },
    ],
    match: [{ left: 'a', right: 'undosh tovush oldidan' }, { left: 'an', right: 'unli tovush oldidan' }, { left: 'the', right: 'aniq narsa' }, { left: 'zero article', right: 'umumiy ko\'plik' }],
  },
  modals: {
    mcq: [
      { q: 'You ___ smoke here. It is forbidden.', options: ['must', 'mustn\'t', 'needn\'t', 'can'], correct: 'mustn\'t' },
      { q: 'She ___ swim when she was five.', options: ['can', 'could', 'must', 'should'], correct: 'could' },
      { q: 'You ___ see a doctor — you look pale.', options: ['should', 'mustn\'t', 'needn\'t', 'may not'], correct: 'should' },
    ],
    fill: [
      { q: 'I ___ (be able to) finish the task tomorrow.', answer: 'will be able to' },
      { q: 'We ___ (have to) wear a uniform at school.', answer: 'have to' },
    ],
    tf: [
      { q: 'Modal fe\'llardan keyin "to" qo\'yilmaydi (ought to bundan mustasno).', answer: 'true' },
      { q: '"needn\'t" — "majbursan" degan ma\'noni beradi.', answer: 'false' },
    ],
    match: [{ left: 'can', right: 'qobiliyat' }, { left: 'must', right: 'majburiyat' }, { left: 'should', right: 'maslahat' }, { left: 'might', right: 'ehtimol' }],
  },
  passive: {
    mcq: [
      { q: 'The letter ___ by Ali.', options: ['wrote', 'was written', 'is writing', 'has wrote'], correct: 'was written' },
      { q: 'English ___ all over the world.', options: ['speaks', 'is spoken', 'spoke', 'speaking'], correct: 'is spoken' },
      { q: 'I had my car ___ yesterday.', options: ['repair', 'repaired', 'repairing', 'to repair'], correct: 'repaired' },
    ],
    fill: [
      { q: 'The house ___ (build) in 1990.', answer: 'was built' },
      { q: 'The work ___ (finish) tomorrow.', answer: 'will be finished' },
    ],
    tf: [
      { q: 'Passive Voice = be + V3 (past participle).', answer: 'true' },
      { q: 'Passive gaplarda ish bajaruvchisi doim ko\'rsatiladi.', answer: 'false' },
    ],
    match: [{ left: 'is done', right: 'Present Simple Passive' }, { left: 'was done', right: 'Past Simple Passive' }, { left: 'will be done', right: 'Future Simple Passive' }, { left: 'have it done', right: 'birovga qildirmoq' }],
  },
  presentPerfect: {
    mcq: [
      { q: 'I ___ never been to Paris.', options: ['have', 'has', 'am', 'did'], correct: 'have' },
      { q: 'She ___ working here since 2019.', options: ['has been', 'have been', 'is', 'was'], correct: 'has been' },
      { q: 'They ___ just finished the exercise.', options: ['have', 'has', 'had', 'are'], correct: 'have' },
    ],
    fill: [
      { q: 'We ___ (live) here for ten years.', answer: 'have lived' },
      { q: 'He ___ (not/see) that film yet.', answer: 'has not seen' },
    ],
    tf: [
      { q: '"since" aniq boshlanish nuqtasi bilan ishlatiladi.', answer: 'true' },
      { q: 'Present Perfect "yesterday" bilan ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'for', right: 'davomiylik' }, { left: 'since', right: 'boshlanish nuqtasi' }, { left: 'already', right: 'allaqachon' }, { left: 'yet', right: 'hali' }],
  },
  pastPerfect: {
    mcq: [
      { q: 'When I arrived, the train ___ .', options: ['left', 'had left', 'has left', 'leaves'], correct: 'had left' },
      { q: 'She told me she ___ the book before.', options: ['read', 'had read', 'has read', 'reads'], correct: 'had read' },
      { q: 'They ___ finished dinner by 8 pm.', options: ['have', 'had', 'has', 'was'], correct: 'had' },
    ],
    fill: [
      { q: 'After he ___ (do) his homework, he went out.', answer: 'had done' },
      { q: 'I ___ (never/see) such a beautiful place before.', answer: 'had never seen' },
    ],
    tf: [
      { q: 'Past Perfect o\'tmishdagi ikki harakatdan avvalgisini bildiradi.', answer: 'true' },
      { q: 'Past Perfect "has + V3" shaklida yasaladi.', answer: 'false' },
    ],
    match: [{ left: 'had done', right: 'Past Perfect' }, { left: 'after', right: 'keyin' }, { left: 'before', right: 'oldin' }, { left: 'by the time', right: '...ga qadar' }],
  },
  gerund: {
    mcq: [
      { q: 'I enjoy ___ books.', options: ['read', 'to read', 'reading', 'reads'], correct: 'reading' },
      { q: 'She decided ___ abroad.', options: ['go', 'to go', 'going', 'goes'], correct: 'to go' },
      { q: 'He is good at ___ chess.', options: ['play', 'to play', 'playing', 'played'], correct: 'playing' },
    ],
    fill: [
      { q: 'They want ___ (learn) English.', answer: 'to learn' },
      { q: 'Avoid ___ (make) the same mistake.', answer: 'making' },
    ],
    tf: [
      { q: 'Predloglardan keyin gerund (V-ing) keladi.', answer: 'true' },
      { q: '"enjoy" dan keyin infinitive ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'enjoy', right: 'V-ing' }, { left: 'decide', right: 'to V' }, { left: 'avoid', right: 'V-ing' }, { left: 'promise', right: 'to V' }],
  },
  adjective: {
    mcq: [
      { q: 'This book is ___ than that one.', options: ['interesting', 'more interesting', 'most interesting', 'interestinger'], correct: 'more interesting' },
      { q: 'She is the ___ student in the class.', options: ['good', 'better', 'best', 'well'], correct: 'best' },
      { q: 'Today is ___ than yesterday.', options: ['hot', 'hotter', 'hottest', 'more hot'], correct: 'hotter' },
    ],
    fill: [
      { q: 'My bag is ___ (heavy) than yours.', answer: 'heavier' },
      { q: 'It was the ___ (bad) day of my life.', answer: 'worst' },
    ],
    tf: [
      { q: 'Qisqa sifatlarga -er/-est qo\'shiladi.', answer: 'true' },
      { q: '"good" sifatining qiyosiy darajasi — "gooder".', answer: 'false' },
    ],
    match: [{ left: 'big', right: 'bigger' }, { left: 'good', right: 'better' }, { left: 'bad', right: 'worse' }, { left: 'happy', right: 'happier' }],
  },
  adverb: {
    mcq: [
      { q: 'He drives ___ .', options: ['careful', 'carefully', 'more careful', 'care'], correct: 'carefully' },
      { q: 'She sings very ___ .', options: ['good', 'well', 'best', 'goodly'], correct: 'well' },
      { q: 'They arrived ___ .', options: ['late', 'lately', 'later than', 'latest'], correct: 'late' },
    ],
    fill: [
      { q: 'Please speak ___ (slow).', answer: 'slowly' },
      { q: 'He finished the test ___ (quick).', answer: 'quickly' },
    ],
    tf: [
      { q: 'Ko\'p ravishlar sifatga -ly qo\'shish orqali yasaladi.', answer: 'true' },
      { q: '"hard" ravishi "hardly" bilan bir xil ma\'noni beradi.', answer: 'false' },
    ],
    match: [{ left: 'careful', right: 'carefully' }, { left: 'quick', right: 'quickly' }, { left: 'good', right: 'well' }, { left: 'fast', right: 'fast' }],
  },
  conditionals: {
    mcq: [
      { q: 'If it rains, we ___ at home.', options: ['stay', 'will stay', 'stayed', 'would stay'], correct: 'will stay' },
      { q: 'If I ___ rich, I would travel the world.', options: ['am', 'was', 'were', 'will be'], correct: 'were' },
      { q: 'If she had studied, she ___ passed.', options: ['would', 'would have', 'will have', 'had'], correct: 'would have' },
    ],
    fill: [
      { q: 'If you heat water to 100°C, it ___ (boil).', answer: 'boils' },
      { q: 'I wish I ___ (can) speak French.', answer: 'could' },
    ],
    tf: [
      { q: 'Type 2 conditional real bo\'lmagan hozirgi holat uchun ishlatiladi.', answer: 'true' },
      { q: '"If" gapida "will" ishlatiladi (Type 1).', answer: 'false' },
    ],
    match: [{ left: 'Type 0', right: 'doimiy haqiqat' }, { left: 'Type 1', right: 'real kelajak' }, { left: 'Type 2', right: 'noreal hozir' }, { left: 'Type 3', right: 'noreal o\'tmish' }],
  },
  relative: {
    mcq: [
      { q: 'The man ___ lives next door is a doctor.', options: ['which', 'who', 'whose', 'where'], correct: 'who' },
      { q: 'This is the book ___ I bought yesterday.', options: ['who', 'which', 'whose', 'when'], correct: 'which' },
      { q: 'That is the girl ___ father is a pilot.', options: ['who', 'which', 'whose', 'whom'], correct: 'whose' },
    ],
    fill: [
      { q: 'The city ___ I was born is very old.', answer: 'where' },
      { q: 'I remember the day ___ we met.', answer: 'when' },
    ],
    tf: [
      { q: '"who" odamlar uchun ishlatiladi.', answer: 'true' },
      { q: '"which" odamlar uchun ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'who', right: 'odam' }, { left: 'which', right: 'narsa' }, { left: 'whose', right: 'egalik' }, { left: 'where', right: 'joy' }],
  },
  reported: {
    mcq: [
      { q: 'He said he ___ tired.', options: ['is', 'was', 'has been', 'will be'], correct: 'was' },
      { q: 'She asked me where I ___ .', options: ['live', 'lived', 'am living', 'will live'], correct: 'lived' },
      { q: 'He told me ___ the door.', options: ['close', 'to close', 'closing', 'closed'], correct: 'to close' },
    ],
    fill: [
      { q: 'Direct: "I am busy." → He said he ___ busy.', answer: 'was' },
      { q: 'Direct: "Don\'t go!" → She told me ___ to go.', answer: 'not' },
    ],
    tf: [
      { q: 'Reported speech da zamon bir pog\'ona orqaga suriladi.', answer: 'true' },
      { q: 'Reported questions da so\'roq tartibi saqlanadi.', answer: 'false' },
    ],
    match: [{ left: 'say', right: 'aytmoq (obyektsiz)' }, { left: 'tell', right: 'aytmoq (obyekt bilan)' }, { left: 'ask', right: 'so\'ramoq' }, { left: 'order', right: 'buyurmoq' }],
  },
  quantifiers: {
    mcq: [
      { q: '___ of my parents are teachers.', options: ['Both', 'Either', 'Neither', 'All'], correct: 'Both' },
      { q: '___ of the two answers is correct — they are wrong.', options: ['Both', 'Neither', 'All', 'Either'], correct: 'Neither' },
      { q: 'You can take ___ book — they are the same.', options: ['both', 'either', 'neither', 'none'], correct: 'either' },
    ],
    fill: [
      { q: '___ of the students passed the exam. (hech biri)', answer: 'None' },
      { q: '___ of my friends live in Tashkent. (hammasi)', answer: 'All' },
    ],
    tf: [
      { q: '"Both" ikki narsa uchun ishlatiladi.', answer: 'true' },
      { q: '"None" faqat ikki narsa uchun ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'both', right: 'ikkalasi ham' }, { left: 'neither', right: 'ikkalasi ham emas' }, { left: 'all', right: 'hammasi' }, { left: 'none', right: 'hech biri' }],
  },
  tags: {
    mcq: [
      { q: 'You are a student, ___ ?', options: ['are you', 'aren\'t you', 'do you', 'don\'t you'], correct: 'aren\'t you' },
      { q: 'She doesn\'t like tea, ___ ?', options: ['does she', 'doesn\'t she', 'is she', 'did she'], correct: 'does she' },
      { q: '"I am tired." — "___ ."', options: ['So am I', 'So I am', 'Neither am I', 'So do I'], correct: 'So am I' },
    ],
    fill: [
      { q: 'They will come, ___ they?', answer: 'won\'t' },
      { q: 'He can\'t swim, ___ he?', answer: 'can' },
    ],
    tf: [
      { q: 'Musbat gapdan keyin inkor tag question keladi.', answer: 'true' },
      { q: '"So do I" inkor gapga javob sifatida ishlatiladi.', answer: 'false' },
    ],
    match: [{ left: 'So am I', right: 'men ham (musbat)' }, { left: 'Neither do I', right: 'men ham emas' }, { left: 'isn\'t it?', right: 'shundaymi?' }, { left: 'don\'t you?', right: 'shunday emasmi?' }],
  },
  exam: {
    mcq: [
      { q: 'She ___ here since 2020.', options: ['works', 'has worked', 'worked', 'is working'], correct: 'has worked' },
      { q: 'The room ___ every day.', options: ['cleans', 'is cleaned', 'cleaned', 'has clean'], correct: 'is cleaned' },
      { q: 'If I ___ you, I would accept the offer.', options: ['am', 'was', 'were', 'will be'], correct: 'were' },
    ],
    fill: [
      { q: 'He asked me where I ___ (live).', answer: 'lived' },
      { q: 'By next June we ___ (finish) the course.', answer: 'will have finished' },
    ],
    tf: [
      { q: 'Imtihon barcha ko\'nikmalarni (Grammar, Vocabulary, Listening, Reading, Writing) qamrab oladi.', answer: 'true' },
      { q: 'Imtihonda faqat grammatika tekshiriladi.', answer: 'false' },
    ],
    match: [{ left: 'Grammar', right: 'grammatika' }, { left: 'Vocabulary', right: 'lug\'at' }, { left: 'Listening', right: 'tinglab tushunish' }, { left: 'Reading', right: 'o\'qib tushunish' }],
  },
};

// Word bank / translation mashqlari uchun umumiy manba
const WORD_BANK_ITEMS = [
  { scrambled: ['to', 'school', 'goes', 'She', 'every day'], answer: 'She goes to school every day' },
  { scrambled: ['is', 'my', 'This', 'brother'], answer: 'This is my brother' },
  { scrambled: ['finished', 'have', 'I', 'the', 'homework'], answer: 'I have finished the homework' },
  { scrambled: ['was', 'The', 'built', 'house', 'in 1990'], answer: 'The house was built in 1990' },
  { scrambled: ['will', 'We', 'tomorrow', 'meet'], answer: 'We will meet tomorrow' },
];
const TRANSLATION_ITEMS = [
  { uz: 'Men har kuni ingliz tilini o\'rganaman.', en: 'I learn English every day.' },
  { uz: 'U kecha kitob o\'qidi.', en: 'She read a book yesterday.' },
  { uz: 'Biz ertaga uchrashamiz.', en: 'We will meet tomorrow.' },
  { uz: 'Bu uy 1990-yilda qurilgan.', en: 'This house was built in 1990.' },
  { uz: 'Agar vaqtim bo\'lsa, senga yordam beraman.', en: 'If I have time, I will help you.' },
];

// ─── Reading matnlari ────────────────────────────────────────────────────────
const READINGS = [
  {
    title: 'A Day at the Language Centre', author: 'Bunyod Education',
    paragraphs: [
      'Every morning the language centre opens at eight o\'clock. Students arrive early because they want to practise before the lesson starts.',
      'The first lesson is usually grammar. The teacher writes examples on the board and the students repeat them aloud.',
      'After a short break there is a listening task. Students listen to a dialogue twice and then answer the questions.',
      'At the end of the day everybody speaks about what they have learned. This helps them remember new words.',
    ],
    questions: [
      { q: 'When does the centre open?', options: ['At seven', 'At eight', 'At nine', 'At ten'], correct: 'At eight' },
      { q: 'What is the first lesson usually about?', options: ['Reading', 'Grammar', 'Writing', 'Speaking'], correct: 'Grammar' },
      { q: 'How many times do students listen to the dialogue?', options: ['Once', 'Twice', 'Three times', 'Four times'], correct: 'Twice' },
    ],
  },
  {
    title: 'Learning a Language as an Adult', author: 'Sarah Collins',
    paragraphs: [
      'Many people believe that only children can learn a foreign language well. Research shows that this is not completely true.',
      'Adults learn grammar rules faster because they already understand how their own language works.',
      'However, adults are often afraid of making mistakes. This fear can slow their progress more than age does.',
      'The best advice is simple: speak every day, even if your sentences are short and imperfect.',
    ],
    questions: [
      { q: 'What do adults learn faster?', options: ['Pronunciation', 'Grammar rules', 'Listening', 'Handwriting'], correct: 'Grammar rules' },
      { q: 'What slows adult learners down?', options: ['Their age', 'Fear of mistakes', 'Lack of books', 'Bad teachers'], correct: 'Fear of mistakes' },
      { q: 'What is the advice in the last paragraph?', options: ['Read more', 'Speak every day', 'Study alone', 'Travel abroad'], correct: 'Speak every day' },
    ],
  },
  {
    title: 'The Old Library', author: 'Robert Nash',
    paragraphs: [
      'The old library stood at the end of a quiet street. Nobody had entered it for almost ten years.',
      'When the town decided to open it again, volunteers came every weekend to clean the shelves.',
      'They found books that had been printed more than a century ago, and letters hidden between the pages.',
      'Today the library is full of children again, and the letters are displayed in a small museum upstairs.',
    ],
    questions: [
      { q: 'How long was the library closed?', options: ['Five years', 'Almost ten years', 'Twenty years', 'A century'], correct: 'Almost ten years' },
      { q: 'Who cleaned the library?', options: ['The police', 'Volunteers', 'Students only', 'Builders'], correct: 'Volunteers' },
      { q: 'Where are the letters now?', options: ['In the shelves', 'In a museum upstairs', 'In the town hall', 'They were lost'], correct: 'In a museum upstairs' },
    ],
  },
  {
    title: 'Food Around the World', author: 'James Wilson',
    paragraphs: [
      'People all over the world eat different food, but some dishes are enjoyed almost everywhere.',
      'In Italy, pizza and pasta are national favourites, while in Japan people love sushi and ramen.',
      'In Uzbekistan the most famous dish is plov, which is made with rice, meat, carrots and onions.',
      'Trying new food is one of the best parts of travelling to another country.',
    ],
    questions: [
      { q: 'What is the most famous dish in Uzbekistan?', options: ['Sushi', 'Pizza', 'Plov', 'Ramen'], correct: 'Plov' },
      { q: 'What is plov made with?', options: ['Fish and bread', 'Rice, meat, carrots and onions', 'Only vegetables', 'Pasta and cheese'], correct: 'Rice, meat, carrots and onions' },
      { q: 'According to the text, what is one of the best parts of travelling?', options: ['Taking photos', 'Trying new food', 'Meeting friends', 'Buying clothes'], correct: 'Trying new food' },
    ],
  },
  {
    title: 'Why We Forget New Words', author: 'Dr. Amina Yusupova',
    paragraphs: [
      'You learn twenty new words today and tomorrow you remember only five. This is normal, and scientists call it the forgetting curve.',
      'Our brain keeps information that it uses and removes information that it does not need.',
      'The solution is repetition at growing intervals: review a word after one day, then after three days, then after a week.',
      'Students who repeat words in this way remember up to eighty per cent of them after a month.',
    ],
    questions: [
      { q: 'What do scientists call the process of forgetting?', options: ['Memory loss', 'The forgetting curve', 'Word decay', 'Brain reset'], correct: 'The forgetting curve' },
      { q: 'What does the brain remove?', options: ['Information it uses', 'Information it does not need', 'All new words', 'Grammar rules'], correct: 'Information it does not need' },
      { q: 'How much can students remember after a month?', options: ['Up to 50%', 'Up to 60%', 'Up to 80%', 'Up to 100%'], correct: 'Up to 80%' },
    ],
  },
  {
    title: 'A Job Interview', author: 'Career Guide',
    paragraphs: [
      'Anvar was nervous before his first job interview. He had prepared answers for many questions.',
      'The interviewer asked him about his education, his experience and his English level.',
      'Anvar explained that he had been studying English for two years and could hold a conversation with clients.',
      'A week later he received an email: he had got the job, and his English had been the deciding factor.',
    ],
    questions: [
      { q: 'How did Anvar feel before the interview?', options: ['Happy', 'Nervous', 'Angry', 'Bored'], correct: 'Nervous' },
      { q: 'How long had he been studying English?', options: ['Six months', 'One year', 'Two years', 'Five years'], correct: 'Two years' },
      { q: 'What was the deciding factor?', options: ['His experience', 'His English', 'His age', 'His diploma'], correct: 'His English' },
    ],
  },
];

// ─── Listening dialoglari ────────────────────────────────────────────────────
const LISTENINGS = [
  {
    title: 'At the Supermarket',
    speakers: [{ label: 'A', name: 'Customer' }, { label: 'B', name: 'Shop assistant' }],
    transcript: [
      { speaker: 'Customer', t: 4, text: 'Excuse me, where can I find the milk?' },
      { speaker: 'Shop assistant', t: 9, text: 'The milk is in aisle four, next to the yogurt.' },
      { speaker: 'Customer', t: 16, text: 'Thank you. And do you have any fresh bread?' },
      { speaker: 'Shop assistant', t: 22, text: 'Yes, the bakery section is at the back. It closes at six.' },
      { speaker: 'Customer', t: 32, text: 'Great. How much is this orange juice?' },
      { speaker: 'Shop assistant', t: 38, text: 'That one is two pounds fifty.' },
    ],
    questions: [
      { q: 'Where is the milk?', options: ['Aisle two', 'Aisle three', 'Aisle four', 'Aisle five'], correct: 'Aisle four' },
      { q: 'When does the bakery close?', options: ['At five', 'At six', 'At seven', 'At eight'], correct: 'At six' },
      { q: 'How much is the orange juice?', options: ['£1.50', '£2.00', '£2.50', '£3.00'], correct: '£2.50' },
    ],
  },
  {
    title: 'Making Weekend Plans',
    speakers: [{ label: 'A', name: 'Kate' }, { label: 'B', name: 'David' }],
    transcript: [
      { speaker: 'Kate', t: 5, text: 'David, are you free this Saturday?' },
      { speaker: 'David', t: 11, text: 'I think so. What are you planning?' },
      { speaker: 'Kate', t: 17, text: 'A few of us are going to the new Italian restaurant. Would you like to come?' },
      { speaker: 'David', t: 26, text: 'That sounds great. What time?' },
      { speaker: 'Kate', t: 32, text: 'We are meeting at seven o\'clock.' },
      { speaker: 'David', t: 38, text: 'Perfect, I will be there.' },
    ],
    questions: [
      { q: 'Where are they going?', options: ['To the cinema', 'To an Italian restaurant', 'To the park', 'To a café'], correct: 'To an Italian restaurant' },
      { q: 'What time are they meeting?', options: ['At six', 'At half past six', 'At seven', 'At eight'], correct: 'At seven' },
      { q: 'Will David join them?', options: ['No', 'Maybe', 'Yes', 'He is busy'], correct: 'Yes' },
    ],
  },
  {
    title: 'At the Doctor',
    speakers: [{ label: 'A', name: 'Doctor' }, { label: 'B', name: 'Patient' }],
    transcript: [
      { speaker: 'Patient', t: 3, text: 'Good morning. I do not feel well.' },
      { speaker: 'Doctor', t: 8, text: 'Good morning. What are your symptoms?' },
      { speaker: 'Patient', t: 14, text: 'I have a headache and a sore throat, and I feel tired.' },
      { speaker: 'Doctor', t: 23, text: 'How long have you felt like this?' },
      { speaker: 'Patient', t: 28, text: 'Since yesterday evening.' },
      { speaker: 'Doctor', t: 33, text: 'I will prescribe some medicine. Drink a lot of water and rest.' },
    ],
    questions: [
      { q: 'What is wrong with the patient?', options: ['A broken arm', 'A headache and a sore throat', 'A stomach ache', 'Nothing'], correct: 'A headache and a sore throat' },
      { q: 'How long has the patient felt ill?', options: ['For a week', 'Since yesterday evening', 'For two days', 'Since this morning'], correct: 'Since yesterday evening' },
      { q: 'What does the doctor advise?', options: ['To do sport', 'To rest and drink water', 'To eat more', 'To go to hospital'], correct: 'To rest and drink water' },
    ],
  },
  {
    title: 'Booking a Hotel Room',
    speakers: [{ label: 'A', name: 'Receptionist' }, { label: 'B', name: 'Guest' }],
    transcript: [
      { speaker: 'Guest', t: 2, text: 'Hello, I would like to book a room for two nights.' },
      { speaker: 'Receptionist', t: 8, text: 'Certainly. A single or a double room?' },
      { speaker: 'Guest', t: 13, text: 'A double room, please. Is breakfast included?' },
      { speaker: 'Receptionist', t: 20, text: 'Yes, breakfast is served from seven to ten.' },
      { speaker: 'Guest', t: 27, text: 'How much is it per night?' },
      { speaker: 'Receptionist', t: 31, text: 'Forty dollars per night, so eighty dollars in total.' },
    ],
    questions: [
      { q: 'How many nights does the guest book?', options: ['One', 'Two', 'Three', 'A week'], correct: 'Two' },
      { q: 'When is breakfast served?', options: ['From six to nine', 'From seven to ten', 'From eight to eleven', 'It is not included'], correct: 'From seven to ten' },
      { q: 'What is the total price?', options: ['$40', '$60', '$80', '$100'], correct: '$80' },
    ],
  },
];

// ─── Lug'at (en → uz) ────────────────────────────────────────────────────────
const VOCAB: { en: string; uz: string; pos: string; ipa: string; ex: string; exUz: string }[] = [
  { en: 'achieve', uz: 'erishmoq', pos: 'verb', ipa: '/əˈtʃiːv/', ex: 'You can achieve your goals with hard work.', exUz: 'Mehnat bilan maqsadingizga erishishingiz mumkin.' },
  { en: 'advice', uz: 'maslahat', pos: 'noun', ipa: '/ədˈvaɪs/', ex: 'She gave me good advice.', exUz: 'U menga yaxshi maslahat berdi.' },
  { en: 'afraid', uz: 'qo\'rqqan', pos: 'adjective', ipa: '/əˈfreɪd/', ex: 'I am afraid of making mistakes.', exUz: 'Men xato qilishdan qo\'rqaman.' },
  { en: 'ancient', uz: 'qadimiy', pos: 'adjective', ipa: '/ˈeɪnʃənt/', ex: 'Samarkand is an ancient city.', exUz: 'Samarqand qadimiy shahar.' },
  { en: 'apply', uz: 'ariza bermoq', pos: 'verb', ipa: '/əˈplaɪ/', ex: 'He applied for a new job.', exUz: 'U yangi ishga ariza berdi.' },
  { en: 'attend', uz: 'qatnashmoq', pos: 'verb', ipa: '/əˈtend/', ex: 'She attends every lesson.', exUz: 'U har bir darsda qatnashadi.' },
  { en: 'available', uz: 'mavjud', pos: 'adjective', ipa: '/əˈveɪləbl/', ex: 'The book is available in the library.', exUz: 'Kitob kutubxonada mavjud.' },
  { en: 'borrow', uz: 'qarz olmoq', pos: 'verb', ipa: '/ˈbɒrəʊ/', ex: 'Can I borrow your pen?', exUz: 'Ruchkangizni olsam bo\'ladimi?' },
  { en: 'brave', uz: 'jasur', pos: 'adjective', ipa: '/breɪv/', ex: 'He was brave enough to speak first.', exUz: 'U birinchi bo\'lib gapirishga jur\'at etdi.' },
  { en: 'careful', uz: 'ehtiyotkor', pos: 'adjective', ipa: '/ˈkeəfl/', ex: 'Be careful on the road.', exUz: 'Yo\'lda ehtiyot bo\'ling.' },
  { en: 'celebrate', uz: 'nishonlamoq', pos: 'verb', ipa: '/ˈselɪbreɪt/', ex: 'We celebrate Navruz in spring.', exUz: 'Biz bahorda Navro\'zni nishonlaymiz.' },
  { en: 'challenge', uz: 'qiyinchilik', pos: 'noun', ipa: '/ˈtʃælɪndʒ/', ex: 'Grammar can be a challenge.', exUz: 'Grammatika qiyinchilik tug\'dirishi mumkin.' },
  { en: 'choose', uz: 'tanlamoq', pos: 'verb', ipa: '/tʃuːz/', ex: 'Choose the correct answer.', exUz: 'To\'g\'ri javobni tanlang.' },
  { en: 'compare', uz: 'taqqoslamoq', pos: 'verb', ipa: '/kəmˈpeə/', ex: 'Compare these two sentences.', exUz: 'Bu ikki gapni taqqoslang.' },
  { en: 'confident', uz: 'ishonchli', pos: 'adjective', ipa: '/ˈkɒnfɪdənt/', ex: 'She feels confident about the exam.', exUz: 'U imtihonga ishonch bilan qaraydi.' },
  { en: 'crowded', uz: 'gavjum', pos: 'adjective', ipa: '/ˈkraʊdɪd/', ex: 'The bus was very crowded.', exUz: 'Avtobus juda gavjum edi.' },
  { en: 'decide', uz: 'qaror qilmoq', pos: 'verb', ipa: '/dɪˈsaɪd/', ex: 'They decided to stay at home.', exUz: 'Ular uyda qolishga qaror qilishdi.' },
  { en: 'delicious', uz: 'mazali', pos: 'adjective', ipa: '/dɪˈlɪʃəs/', ex: 'The cake was delicious.', exUz: 'Tort juda mazali edi.' },
  { en: 'describe', uz: 'tasvirlamoq', pos: 'verb', ipa: '/dɪˈskraɪb/', ex: 'Can you describe the picture?', exUz: 'Rasmni tasvirlab bera olasizmi?' },
  { en: 'develop', uz: 'rivojlantirmoq', pos: 'verb', ipa: '/dɪˈveləp/', ex: 'Reading develops your vocabulary.', exUz: 'O\'qish so\'z boyligingizni rivojlantiradi.' },
  { en: 'discuss', uz: 'muhokama qilmoq', pos: 'verb', ipa: '/dɪˈskʌs/', ex: 'We discussed the topic in class.', exUz: 'Biz mavzuni darsda muhokama qildik.' },
  { en: 'effort', uz: 'harakat', pos: 'noun', ipa: '/ˈefət/', ex: 'Learning requires effort.', exUz: 'O\'rganish harakat talab qiladi.' },
  { en: 'enough', uz: 'yetarli', pos: 'adverb', ipa: '/ɪˈnʌf/', ex: 'We have enough time.', exUz: 'Bizda yetarli vaqt bor.' },
  { en: 'exercise', uz: 'mashq', pos: 'noun', ipa: '/ˈeksəsaɪz/', ex: 'Do the exercise on page ten.', exUz: 'O\'ninchi betdagi mashqni bajaring.' },
  { en: 'expensive', uz: 'qimmat', pos: 'adjective', ipa: '/ɪkˈspensɪv/', ex: 'This phone is too expensive.', exUz: 'Bu telefon juda qimmat.' },
  { en: 'explain', uz: 'tushuntirmoq', pos: 'verb', ipa: '/ɪkˈspleɪn/', ex: 'Please explain your answer.', exUz: 'Iltimos, javobingizni tushuntiring.' },
  { en: 'famous', uz: 'mashhur', pos: 'adjective', ipa: '/ˈfeɪməs/', ex: 'He is a famous writer.', exUz: 'U mashhur yozuvchi.' },
  { en: 'fluent', uz: 'ravon', pos: 'adjective', ipa: '/ˈfluːənt/', ex: 'She is fluent in three languages.', exUz: 'U uch tilda ravon gapiradi.' },
  { en: 'forget', uz: 'unutmoq', pos: 'verb', ipa: '/fəˈɡet/', ex: 'Do not forget your homework.', exUz: 'Uy vazifangizni unutmang.' },
  { en: 'friendly', uz: 'do\'stona', pos: 'adjective', ipa: '/ˈfrendli/', ex: 'The teacher is very friendly.', exUz: 'O\'qituvchi juda do\'stona.' },
  { en: 'healthy', uz: 'sog\'lom', pos: 'adjective', ipa: '/ˈhelθi/', ex: 'Vegetables are healthy.', exUz: 'Sabzavotlar sog\'lom.' },
  { en: 'cheap', uz: 'arzon', pos: 'adjective', ipa: '/tʃiːp/', ex: 'This shop is cheap.', exUz: 'Bu do\'kon arzon.' },
  { en: 'careless', uz: 'beparvo', pos: 'adjective', ipa: '/ˈkeələs/', ex: 'A careless mistake cost him the exam.', exUz: 'Beparvolik xatosi unga imtihonga tushdi.' },
  { en: 'improve', uz: 'yaxshilamoq', pos: 'verb', ipa: '/ɪmˈpruːv/', ex: 'I want to improve my speaking.', exUz: 'Men gapirishimni yaxshilamoqchiman.' },
  { en: 'include', uz: 'kiritmoq', pos: 'verb', ipa: '/ɪnˈkluːd/', ex: 'The price includes breakfast.', exUz: 'Narx nonushtani o\'z ichiga oladi.' },
  { en: 'journey', uz: 'sayohat', pos: 'noun', ipa: '/ˈdʒɜːni/', ex: 'The journey took three hours.', exUz: 'Sayohat uch soat davom etdi.' },
  { en: 'knowledge', uz: 'bilim', pos: 'noun', ipa: '/ˈnɒlɪdʒ/', ex: 'Knowledge is power.', exUz: 'Bilim — kuch.' },
  { en: 'lazy', uz: 'dangasa', pos: 'adjective', ipa: '/ˈleɪzi/', ex: 'Do not be lazy on Sundays.', exUz: 'Yakshanba kunlari dangasa bo\'lmang.' },
  { en: 'memory', uz: 'xotira', pos: 'noun', ipa: '/ˈmeməri/', ex: 'She has an excellent memory.', exUz: 'Uning xotirasi juda yaxshi.' },
  { en: 'mistake', uz: 'xato', pos: 'noun', ipa: '/mɪˈsteɪk/', ex: 'Everybody makes mistakes.', exUz: 'Hamma xato qiladi.' },
  { en: 'neighbour', uz: 'qo\'shni', pos: 'noun', ipa: '/ˈneɪbə/', ex: 'My neighbour is a doctor.', exUz: 'Qo\'shnim shifokor.' },
  { en: 'opinion', uz: 'fikr', pos: 'noun', ipa: '/əˈpɪnjən/', ex: 'In my opinion, English is useful.', exUz: 'Mening fikrimcha, ingliz tili foydali.' },
  { en: 'opportunity', uz: 'imkoniyat', pos: 'noun', ipa: '/ˌɒpəˈtjuːnəti/', ex: 'This is a great opportunity.', exUz: 'Bu ajoyib imkoniyat.' },
  { en: 'patient', uz: 'sabrli', pos: 'adjective', ipa: '/ˈpeɪʃnt/', ex: 'A good teacher is patient.', exUz: 'Yaxshi o\'qituvchi sabrli bo\'ladi.' },
  { en: 'practise', uz: 'mashq qilmoq', pos: 'verb', ipa: '/ˈpræktɪs/', ex: 'Practise English every day.', exUz: 'Har kuni ingliz tilida mashq qiling.' },
  { en: 'prepare', uz: 'tayyorlamoq', pos: 'verb', ipa: '/prɪˈpeə/', ex: 'Prepare for the test tonight.', exUz: 'Bugun kechqurun testga tayyorlaning.' },
  { en: 'progress', uz: 'taraqqiyot', pos: 'noun', ipa: '/ˈprəʊɡres/', ex: 'I can see my progress every week.', exUz: 'Men har hafta taraqqiyotimni ko\'raman.' },
  { en: 'quiet', uz: 'jimjit', pos: 'adjective', ipa: '/ˈkwaɪət/', ex: 'The library is very quiet.', exUz: 'Kutubxona juda jimjit.' },
  { en: 'reason', uz: 'sabab', pos: 'noun', ipa: '/ˈriːzn/', ex: 'Give a reason for your answer.', exUz: 'Javobingizga sabab keltiring.' },
  { en: 'recommend', uz: 'tavsiya etmoq', pos: 'verb', ipa: '/ˌrekəˈmend/', ex: 'I recommend this book.', exUz: 'Men bu kitobni tavsiya qilaman.' },
  { en: 'remember', uz: 'eslamoq', pos: 'verb', ipa: '/rɪˈmembə/', ex: 'Do you remember her name?', exUz: 'Uning ismini eslaysizmi?' },
  { en: 'repeat', uz: 'takrorlamoq', pos: 'verb', ipa: '/rɪˈpiːt/', ex: 'Repeat the new words tomorrow.', exUz: 'Yangi so\'zlarni ertaga takrorlang.' },
  { en: 'require', uz: 'talab qilmoq', pos: 'verb', ipa: '/rɪˈkwaɪə/', ex: 'This task requires careful reading.', exUz: 'Bu vazifa diqqat bilan o\'qishni talab qiladi.' },
  { en: 'success', uz: 'muvaffaqiyat', pos: 'noun', ipa: '/səkˈses/', ex: 'Success comes with practice.', exUz: 'Muvaffaqiyat mashq bilan keladi.' },
  { en: 'suggest', uz: 'taklif qilmoq', pos: 'verb', ipa: '/səˈdʒest/', ex: 'I suggest starting with grammar.', exUz: 'Men grammatikadan boshlashni taklif qilaman.' },
  { en: 'support', uz: 'qo\'llab-quvvatlamoq', pos: 'verb', ipa: '/səˈpɔːt/', ex: 'Support your opinion with examples.', exUz: 'Fikringizni misollar bilan asoslang.' },
  { en: 'terrible', uz: 'dahshatli', pos: 'adjective', ipa: '/ˈterəbl/', ex: 'The weather was terrible.', exUz: 'Ob-havo dahshatli edi.' },
  { en: 'travel', uz: 'sayohat qilmoq', pos: 'verb', ipa: '/ˈtrævl/', ex: 'They travel every summer.', exUz: 'Ular har yozda sayohat qilishadi.' },
  { en: 'understand', uz: 'tushunmoq', pos: 'verb', ipa: '/ˌʌndəˈstænd/', ex: 'I understand the rule now.', exUz: 'Endi qoidani tushundim.' },
  { en: 'useful', uz: 'foydali', pos: 'adjective', ipa: '/ˈjuːsfl/', ex: 'This dictionary is very useful.', exUz: 'Bu lug\'at juda foydali.' },
  { en: 'vocabulary', uz: 'so\'z boyligi', pos: 'noun', ipa: '/vəˈkæbjələri/', ex: 'Building vocabulary takes time.', exUz: 'So\'z boyligini oshirish vaqt talab qiladi.' },
  { en: 'wealthy', uz: 'boy', pos: 'adjective', ipa: '/ˈwelθi/', ex: 'He became wealthy after ten years.', exUz: 'U o\'n yildan keyin boyib ketdi.' },
  { en: 'wonder', uz: 'qiziqmoq', pos: 'verb', ipa: '/ˈwʌndə/', ex: 'I wonder where she is.', exUz: 'Qiziq, u qayerda ekan.' },
];

// sinonim / antonim juftliklari (ikkalasi ham yuqoridagi ro'yxatdan)
const SYNONYMS: [string, string][] = [
  ['improve', 'develop'], ['choose', 'decide'], ['explain', 'describe'],
  ['suggest', 'recommend'], ['practise', 'exercise'],
];
const ANTONYMS: [string, string][] = [
  ['expensive', 'cheap'], ['brave', 'afraid'], ['careful', 'careless'],
  ['quiet', 'crowded'], ['remember', 'forget'],
];

// ═════════════════════════════════════════════════════════════════════════════
//  DB ULANISH VA YORDAMCHI FUNKSIYALAR
// ═════════════════════════════════════════════════════════════════════════════
const ds = new DataSource({
  type: 'postgres',
  url: process.env.DB_URL,
  synchronize: false,
  logging: false,
});

let inserted = 0;
const stats: Record<string, number> = {};

/**
 * "Soya" (shadow) FK ustunlari.
 *
 * Entity'larda `@Column({name:'user_id'}) userId` va `@ManyToOne(() => User) user`
 * birga yozilgan, lekin `@JoinColumn` qo'yilmagan. Shu sababli TypeORM
 * `synchronize` paytida qo'shimcha `userId` ustunini ham yaratadi va
 * `relations: ['user']` / `leftJoin('s.assignment')` kabi so'rovlar AYNAN
 * shu ustundan foydalanadi. U bo'sh bo'lsa — bog'liq obyekt `null` qaytadi
 * (masalan "Tekshirilmagan ishlar" ro'yxatida o'quvchi ismi ko'rinmaydi).
 *
 * Shuning uchun mock ma'lumot ikkala ustunni ham to'ldiradi. Ustun bazada
 * mavjud bo'lmasa (schema boshqacha bo'lsa) — jimgina o'tkazib yuboriladi.
 */
const SHADOW_FK: Record<string, Record<string, string>> = {
  activity_log: { userId: 'user_id' },
  assignment_submissions: { assignmentId: 'assignment_id', studentId: 'student_id', graderId: 'graded_by' },
  assignments: { teacherId: 'teacher_id', groupId: 'group_id', lessonId: 'lesson_id' },
  attendance: { sessionId: 'session_id', userId: 'user_id' },
  daily_tracking: { userId: 'user_id' },
  groups: { teacherId: 'teacher_id' },
  lesson_progress: { userId: 'user_id', lessonId: 'lesson_id' },
  messages: { senderId: 'sender_id', receiverId: 'receiver_id' },
  notifications: { userId: 'user_id' },
  schedule_sessions: { scheduleId: 'schedule_id', groupId: 'group_id', teacherId: 'teacher_id' },
  schedules: { groupId: 'group_id', teacherId: 'teacher_id' },
  user_achievements: { userId: 'user_id', achievementId: 'achievement_id' },
  user_gamification: { userId: 'user_id' },
  user_skills: { userId: 'user_id' },
  xp_transactions: { userId: 'user_id' },
};

/** Bazada haqiqatda mavjud ustunlar (table → ustunlar to'plami) */
const dbColumns = new Map<string, Set<string>>();
async function loadDbColumns(): Promise<void> {
  const rows: { table_name: string; column_name: string }[] = await ds.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  for (const r of rows) {
    if (!dbColumns.has(r.table_name)) dbColumns.set(r.table_name, new Set());
    dbColumns.get(r.table_name)!.add(r.column_name);
  }
}

/** Ustun ro'yxatiga mavjud soya-FK ustunlarini qo'shadi */
function expandShadow(table: string, columns: string[], rows: any[][]): { columns: string[]; rows: any[][] } {
  const map = SHADOW_FK[table];
  const present = dbColumns.get(table);
  if (!map || !present) return { columns, rows };

  const extra: { name: string; sourceIdx: number }[] = [];
  for (const [shadow, source] of Object.entries(map)) {
    if (!present.has(shadow) || columns.includes(shadow)) continue;
    const idx = columns.indexOf(source);
    if (idx === -1) continue;
    extra.push({ name: shadow, sourceIdx: idx });
  }
  if (!extra.length) return { columns, rows };

  return {
    columns: [...columns, ...extra.map((e) => e.name)],
    rows: rows.map((r) => [...r, ...extra.map((e) => r[e.sourceIdx])]),
  };
}

/** Ko'p qatorli INSERT — bo'laklarga bo'lib yuboradi */
async function insertMany(table: string, columnsIn: string[], rowsIn: any[][], chunk = 400): Promise<void> {
  if (!rowsIn.length) return;
  const { columns, rows } = expandShadow(table, columnsIn, rowsIn);
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const values: any[] = [];
    const placeholders = part
      .map((row) => `(${row.map((v) => { values.push(v); return `$${values.length}`; }).join(',')})`)
      .join(',');
    await ds.query(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES ${placeholders}`,
      values,
    );
  }
  stats[table] = (stats[table] ?? 0) + rows.length;
  inserted += rows.length;
}

const uuid = () => randomUUID();
function log(msg: string) { console.log(msg); }

// ═════════════════════════════════════════════════════════════════════════════
//  MOCK YOZUVLAR RO'YXATI (tozalash uchun)
// ═════════════════════════════════════════════════════════════════════════════
const GROUP_NAMES = [
  'Beginner A1 — ertalabki', 'Elementary A2 — ertalabki', 'Elementary A2 — kechki',
  'Pre-Intermediate B1 — ertalabki', 'Pre-Intermediate B1 — kechki', 'Intermediate B1+ — kechki',
  'Upper-Intermediate B2 — kechki', 'IELTS 6.5 — intensiv', 'Kids English — shanba',
  'Business English — korporativ',
];

/** Skriptning eski versiyalari yaratgan loginlar — tozalashda ular ham o'chadi */
const LEGACY_USERNAMES = ['teacher01', 'teacher02', 'teacher03', 'teacher04'];

function mockUsernames(): string[] {
  const list = ['superadmin', 'admin', ...LEGACY_USERNAMES];
  for (let i = 1; i <= CFG.subTeachers; i++) list.push(`subteacher${String(i).padStart(2, '0')}`);
  for (let i = 1; i <= CFG.students; i++) list.push(`student${String(i).padStart(3, '0')}`);
  return list;
}

async function cleanup(): Promise<void> {
  const names = mockUsernames();
  const ids: { id: string }[] = await ds.query(
    `SELECT id FROM users WHERE username = ANY($1)`, [names],
  );
  const userIds = ids.map((r) => r.id);

  // Mock guruhlar — nomi bo'yicha. Ular endi "katta o'qituvchi"ga tegishli
  // bo'lgani uchun foydalanuvchini o'chirish orqali tozalanmaydi.
  const groupRows: { id: string }[] = await ds.query(
    `SELECT id FROM groups WHERE name = ANY($1)`, [GROUP_NAMES],
  );
  const groupIds = groupRows.map((r) => r.id);

  if (groupIds.length) {
    // assignments.group_id ON DELETE SET NULL — guruh o'chsa topshiriq "egasiz"
    // qolib ketadi, shuning uchun avval topshiriqlarni o'chiramiz
    await ds.query(`DELETE FROM assignments WHERE group_id = ANY($1)`, [groupIds]);
    // xodimlarga yozilgan mock bildirishnomalar (mock guruhga havola qiladi)
    await ds.query(
      `DELETE FROM notifications WHERE reference_type = 'group' AND reference_id = ANY($1)`,
      [groupIds],
    );
  }

  // vocabulary_practice_logs → session ON DELETE SET NULL, shuning uchun avval o'chiriladi
  if (userIds.length) {
    await ds.query(
      `DELETE FROM vocabulary_practice_logs
       WHERE session_id IN (SELECT id FROM vocabulary_sessions WHERE user_id = ANY($1))`,
      [userIds],
    );
    // guruhlar: created_by ustuni FK emas — qo'lda o'chiriladi
    await ds.query(`DELETE FROM groups WHERE created_by = ANY($1) OR teacher_id = ANY($1)`, [userIds]);
  }
  await ds.query(`DELETE FROM groups WHERE name = ANY($1)`, [GROUP_NAMES]);
  await ds.query(`DELETE FROM users WHERE username = ANY($1)`, [names]);

  log(`🧹 Eski mock ma'lumot tozalandi (${userIds.length} foydalanuvchi, ${groupIds.length} guruh)`);
}

// ═════════════════════════════════════════════════════════════════════════════
//  1. YUTUQLAR (achievements)
// ═════════════════════════════════════════════════════════════════════════════
const ACHIEVEMENTS = [
  { code: 'first_lesson', title: 'Birinchi dars', description: 'Birinchi darsni yakunladi', icon: '🎯', xp: 20, type: 'lessons', value: 1 },
  { code: 'streak_3', title: '3 kunlik ketma-ketlik', description: '3 kun ketma-ket shug\'ullandi', icon: '🔥', xp: 30, type: 'streak', value: 3 },
  { code: 'streak_7', title: '7 kunlik ketma-ketlik', description: '7 kun ketma-ket shug\'ullandi', icon: '⚡', xp: 70, type: 'streak', value: 7 },
  { code: 'streak_30', title: '30 kunlik ketma-ketlik', description: '30 kun ketma-ket shug\'ullandi', icon: '🏆', xp: 300, type: 'streak', value: 30 },
  { code: 'words_50', title: '50 ta so\'z', description: '50 ta so\'zni o\'zlashtirdi', icon: '📚', xp: 50, type: 'vocabulary', value: 50 },
  { code: 'words_100', title: '100 ta so\'z', description: '100 ta so\'zni o\'zlashtirdi', icon: '📖', xp: 100, type: 'vocabulary', value: 100 },
  { code: 'words_500', title: '500 ta so\'z', description: '500 ta so\'zni o\'zlashtirdi', icon: '🎓', xp: 500, type: 'vocabulary', value: 500 },
  { code: 'perfect_score', title: 'Mukammal ball', description: 'Darsdan 100 ball oldi', icon: '⭐', xp: 100, type: 'score', value: 100 },
  { code: 'fast_learner', title: 'Tez o\'rganuvchi', description: '10 ta darsni yakunladi', icon: '🚀', xp: 80, type: 'lessons', value: 10 },
  { code: 'attendance_20', title: 'Sadoqatli', description: '20 ta darsga qatnashdi', icon: '📅', xp: 120, type: 'attendance', value: 20 },
];

async function seedAchievements(): Promise<{ id: string; code: string }[]> {
  for (const a of ACHIEVEMENTS) {
    const found = await ds.query(`SELECT id FROM achievements WHERE code = $1`, [a.code]);
    if (found.length) continue;
    await insertMany('achievements',
      ['id', 'code', 'title', 'description', 'icon', 'xp_reward', 'condition_type', 'condition_value'],
      [[uuid(), a.code, a.title, a.description, a.icon, a.xp, a.type, a.value]]);
  }
  return ds.query(`SELECT id, code FROM achievements`);
}

// ═════════════════════════════════════════════════════════════════════════════
//  2. BO'LIMLAR (units) + DARSLAR + DARS KONTENTI
// ═════════════════════════════════════════════════════════════════════════════
type LessonRow = { id: string; lessonName: string; orderIndex: number; unitId: string | null };
/** Savol (exercise_item) — javob generatsiyasi uchun kerakli minimal ma'lumot */
type QItem = {
  id: string; exerciseType: string; blockType: string; blockId: string;
  lessonId: string; correctAnswer: string; options: any;
};

const UNIT_DEFS = [
  { number: 1, title: 'Elementary blok (Lesson 1–12)', description: 'Grammar (4th edition) rejasining 1–12 darslari: asosiy zamonlar, artikllar, modal fe\'llar va passiv nisbat.', cefr: 'A2' },
  { number: 2, title: 'Pre-Intermediate blok (Lesson 13–24)', description: 'Grammar (4th edition) rejasining 13–24 darslari: perfect zamonlar, gerund/infinitiv, sifat va ravish.', cefr: 'B1' },
  { number: 3, title: 'Intermediate blok (Lesson 25–36)', description: 'Grammar (4th edition) rejasining 25–36 darslari: shart gaplar, nisbiy gaplar, ko\'chirma gap.', cefr: 'B2' },
];

function mcqOptions(opts: string[], correct: string) {
  return opts.map((text) => ({ text, isCorrect: text === correct, imageUrl: null, matchKey: null }));
}

/** Bazada published dars yetarli bo'lsa — shularni ishlatamiz, aks holda yaratamiz */
let lessonsCreatedByScript = false;

async function ensureLessons(): Promise<LessonRow[]> {
  const existing: LessonRow[] = await ds.query(
    `SELECT l.id, l.lesson_name AS "lessonName", l.order_index AS "orderIndex", l.unit_id AS "unitId"
       FROM lessons l
  LEFT JOIN units u ON u.id = l.unit_id
      WHERE l.status = 'published'
   ORDER BY COALESCE(u.number, 999) ASC, l.order_index ASC`,
  );
  if (existing.length >= 12) {
    log(`📚 Darslar: bazada ${existing.length} ta published dars bor — yangi dars yaratilmaydi`);
    // Bo'limlar published emas bo'lsa gating ishlamaydi — to'g'rilaymiz
    await ds.query(`UPDATE units SET status = 'published' WHERE status <> 'published'`);
    return existing;
  }

  log('📚 Darslar: bazada dars yo\'q — "Grammar (4th edition)" rejasi bo\'yicha yaratilmoqda…');

  // Units
  const unitIds: string[] = [];
  for (const u of UNIT_DEFS) {
    const found = await ds.query(`SELECT id FROM units WHERE number = $1`, [u.number]);
    if (found.length) {
      await ds.query(`UPDATE units SET status = 'published' WHERE id = $1`, [found[0].id]);
      unitIds.push(found[0].id);
      continue;
    }
    const id = uuid();
    await insertMany('units', ['id', 'number', 'title', 'description', 'status'],
      [[id, u.number, u.title, u.description, 'published']]);
    unitIds.push(id);
  }

  const lessons: LessonRow[] = [];
  const lessonRows: any[][] = [];
  for (const p of GRAMMAR_PLAN) {
    const unitIdx = Math.floor((p.n - 1) / 12);
    const id = uuid();
    const orderIndex = ((p.n - 1) % 12) + 1;
    lessonRows.push([
      id, `Lesson ${p.n}. ${p.topic}`, UNIT_DEFS[unitIdx].cefr, null, unitIds[unitIdx],
      orderIndex, 'published', p.family === 'exam' ? 45 : 20,
    ]);
    lessons.push({ id, lessonName: `Lesson ${p.n}. ${p.topic}`, orderIndex, unitId: unitIds[unitIdx] });
  }
  await insertMany('lessons',
    ['id', 'lesson_name', 'cefr_level', 'group_id', 'unit_id', 'order_index', 'status', 'estimated_minutes'],
    lessonRows);

  await buildLessonContent(lessons);
  lessonsCreatedByScript = true;
  return lessons;
}

/** Har bir dars uchun grammar/quiz/reading/listening bloklari + mashqlar */
async function buildLessonContent(lessons: LessonRow[]): Promise<void> {
  const grammarRows: any[][] = [];
  const quizRows: any[][] = [];
  const readingRows: any[][] = [];
  const listeningRows: any[][] = [];
  const transcriptRows: any[][] = [];
  const exRows: any[][] = [];
  const itemRows: any[][] = [];

  lessons.forEach((lesson, idx) => {
    const plan = GRAMMAR_PLAN[idx] ?? GRAMMAR_PLAN[idx % GRAMMAR_PLAN.length];
    const kit = FAMILY_KIT[plan.family] ?? FAMILY_KIT.exam;
    const slug = `lesson-${plan.n}`;

    // ── grammar bloki
    const grammarId = uuid();
    grammarRows.push([grammarId, lesson.id, slug]);
    const gEx = uuid();
    exRows.push([gEx, lesson.id, 'grammar', grammarId, 'fill_in_blank',
      'Qoidani mustahkamlash', `${plan.topic} — bo'sh joyni to'ldiring.`, 0]);
    kit.fill.forEach((f, i) => {
      itemRows.push([uuid(), gEx, f.q, f.answer, null, null,
        `To'g'ri javob: ${f.answer}`, i]);
    });

    // ── quiz bloki
    const quizId = uuid();
    quizRows.push([quizId, lesson.id, 'Amaliy mashqlar', 1]);

    const mcqEx = uuid();
    exRows.push([mcqEx, lesson.id, 'quiz', quizId, 'multiple_choice',
      'Test savollari', "To'g'ri variantni tanlang.", 0]);
    kit.mcq.forEach((m, i) => {
      itemRows.push([uuid(), mcqEx, m.q, m.correct, JSON.stringify(mcqOptions(m.options, m.correct)),
        null, `${plan.topic} qoidasiga ko'ra to'g'ri javob — "${m.correct}".`, i]);
    });

    const fillEx = uuid();
    exRows.push([fillEx, lesson.id, 'quiz', quizId, 'fill_in_blank',
      "Bo'sh joyni to'ldiring", "Fe'lni to'g'ri shaklda yozing.", 1]);
    kit.fill.forEach((f, i) => {
      itemRows.push([uuid(), fillEx, f.q, f.answer, null, null, null, i]);
    });

    const tfEx = uuid();
    exRows.push([tfEx, lesson.id, 'quiz', quizId, 'true_false',
      "To'g'ri / Noto'g'ri", 'Quyidagi fikrlar to\'g\'rimi?', 2]);
    kit.tf.forEach((t, i) => {
      itemRows.push([uuid(), tfEx, t.q, t.answer, null, null,
        t.answer === 'true' ? "Bu fikr to'g'ri." : "Bu fikr noto'g'ri.", i]);
    });

    const matchEx = uuid();
    exRows.push([matchEx, lesson.id, 'quiz', quizId, 'matching',
      'Moslashtiring', 'Chap ustundagi so\'zni o\'ngdagi mosiga ulang.', 3]);
    const matchMap: Record<string, string> = {};
    kit.match.forEach((m) => { matchMap[m.left] = m.right; });
    itemRows.push([uuid(), matchEx, 'Juftlarni moslashtiring', JSON.stringify(matchMap),
      JSON.stringify(kit.match.map((m) => ({ text: m.left, isCorrect: false, imageUrl: null, matchKey: m.right }))),
      null, null, 0]);

    const wbEx = uuid();
    exRows.push([wbEx, lesson.id, 'quiz', quizId, 'word_bank',
      "So'zlardan gap tuzing", "So'zlarni to'g'ri tartibda joylashtiring.", 4]);
    sample(WORD_BANK_ITEMS, 2).forEach((w, i) => {
      itemRows.push([uuid(), wbEx, w.scrambled.join(' / '), w.answer,
        JSON.stringify(shuffle(w.scrambled)), null, null, i]);
    });

    const trEx = uuid();
    exRows.push([trEx, lesson.id, 'quiz', quizId, 'translation',
      'Tarjima qiling', "O'zbekcha gapni ingliz tiliga tarjima qiling.", 5]);
    sample(TRANSLATION_ITEMS, 2).forEach((t, i) => {
      itemRows.push([uuid(), trEx, t.uz, t.en, null, null, null, i]);
    });

    // ── reading bloki (har 3-darsda)
    if (plan.n % 3 === 0) {
      const r = READINGS[(plan.n / 3 - 1) % READINGS.length];
      const readingId = uuid();
      const text = r.paragraphs.join('\n\n');
      readingRows.push([
        readingId, lesson.id, r.title, r.author, text,
        idx < 12 ? 'A2' : idx < 24 ? 'B1' : 'B2',
        JSON.stringify([{ word: 'because', type: 'linker' }, { word: 'however', type: 'linker' }]),
        text.split(/\s+/).length, Math.max(1, Math.round(text.split(/\s+/).length / 120)), 2,
      ]);
      const rEx = uuid();
      exRows.push([rEx, lesson.id, 'reading', readingId, 'multiple_choice',
        'Matn bo\'yicha savollar', 'Matnni o\'qing va savollarga javob bering.', 0]);
      r.questions.forEach((q, i) => {
        itemRows.push([uuid(), rEx, q.q, q.correct, JSON.stringify(mcqOptions(q.options, q.correct)),
          null, `Javob matnning ${i + 1}-qismida.`, i]);
      });
    }

    // ── listening bloki (har 4-darsda)
    if (plan.n % 4 === 0) {
      const l = LISTENINGS[(plan.n / 4 - 1) % LISTENINGS.length];
      const listeningId = uuid();
      listeningRows.push([
        listeningId, lesson.id, l.title, `lesson-${plan.n}.mp3`,
        45 + plan.n, `Lesson ${plan.n}`, JSON.stringify(l.speakers),
        `/uploads/listening/lesson-${plan.n}.jpg`, 3,
      ]);
      l.transcript.forEach((t, i) => {
        transcriptRows.push([uuid(), listeningId, t.speaker, t.t, t.text, i]);
      });
      const lEx = uuid();
      exRows.push([lEx, lesson.id, 'listening', listeningId, 'multiple_choice',
        'Tinglash savollari', 'Audioni tinglang va savollarga javob bering.', 0]);
      l.questions.forEach((q, i) => {
        itemRows.push([uuid(), lEx, q.q, q.correct, JSON.stringify(mcqOptions(q.options, q.correct)),
          i === 0 ? `/uploads/listening/lesson-${plan.n}-q1.jpg` : null,
          'Javob dialogda aytilgan.', i]);
      });
    }
  });

  await insertMany('grammar_contents', ['id', 'lesson_id', 'page_name'], grammarRows);
  await insertMany('quiz_contents', ['id', 'lesson_id', 'title', 'order_index'], quizRows);
  await insertMany('reading_contents',
    ['id', 'lesson_id', 'title', 'author', 'text_content', 'cefr_level', 'highlights', 'word_count', 'reading_time_minutes', 'order_index'],
    readingRows);
  await insertMany('listening_contents',
    ['id', 'lesson_id', 'title', 'file_id', 'duration_seconds', 'track_code', 'speakers', 'image_url', 'order_index'],
    listeningRows);
  await insertMany('listening_transcripts',
    ['id', 'listening_id', 'speaker_name', 'timestamp_sec', 'text_content', 'order_index'], transcriptRows);
  await insertMany('exercises',
    ['id', 'lesson_id', 'owner_block_type', 'owner_block_id', 'exercise_type', 'title', 'instructions', 'order_index'],
    exRows);
  await insertMany('exercise_items',
    ['id', 'exercise_id', 'item_text', 'correct_answer', 'options', 'image_url', 'explanation', 'order_index'],
    itemRows);

  log(`   → ${lessons.length} dars, ${exRows.length} mashq, ${itemRows.length} savol yaratildi`);
}

/** Javob generatsiyasi uchun barcha savollarni bloklari bilan o'qish */
async function loadQuestions(lessonIds: string[]): Promise<Map<string, QItem[]>> {
  if (!lessonIds.length) return new Map();
  const rows: QItem[] = await ds.query(
    `SELECT i.id, e.exercise_type::text AS "exerciseType", e.owner_block_type::text AS "blockType",
            e.owner_block_id AS "blockId", e.lesson_id AS "lessonId",
            i.correct_answer AS "correctAnswer", i.options
       FROM exercise_items i
       JOIN exercises e ON e.id = i.exercise_id
      WHERE e.lesson_id = ANY($1)
   ORDER BY e.order_index, i.order_index`,
    [lessonIds],
  );
  const map = new Map<string, QItem[]>();
  for (const r of rows) {
    if (!map.has(r.lessonId)) map.set(r.lessonId, []);
    map.get(r.lessonId)!.push(r);
  }
  return map;
}

// ═════════════════════════════════════════════════════════════════════════════
//  3. FOYDALANUVCHILAR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Markazdagi "katta o'qituvchi" — guruhlarning egasi.
 *
 * Uning id'si KODGA YOZILMAYDI. Tartib:
 *   1. `MOCK_OWNER_ID` muhit o'zgaruvchisi yoki `--owner=<uuid>` argumenti;
 *   2. bazadagi eng eski (mock bo'lmagan) teacher / superAdmin / admin;
 *   3. hech biri topilmasa — `mainteacher` logini bilan yangisi yaratiladi.
 *
 * Barcha mock guruhlar, jadval, sessiya va topshiriqlar shu foydalanuvchiga
 * biriktiriladi — chunki markazda guruhni faqat u ochadi, qolganlari subTeacher.
 */
async function resolveOwner(): Promise<SeedUser> {
  const fromArg = process.argv.find((a) => a.startsWith('--owner='))?.split('=')[1];
  const wanted = (process.env.MOCK_OWNER_ID || fromArg || '').trim();

  const toSeedUser = (r: any): SeedUser => ({
    id: r.id,
    username: r.username,
    firstName: r.firstName ?? '',
    lastName: r.lastName ?? '',
    role: r.role,
    createdAt: r.createdAt ? new Date(r.createdAt) : daysAgo(400),
    isActive: r.isActive !== false,
    gender: 'm',
  });

  const SELECT = `SELECT id, username, first_name AS "firstName", last_name AS "lastName",
                         role, created_at AS "createdAt", is_active AS "isActive" FROM users`;

  if (wanted) {
    const rows = await ds.query(`${SELECT} WHERE id = $1`, [wanted]);
    if (!rows.length) throw new Error(`MOCK_OWNER_ID topilmadi: ${wanted}`);
    log(`👑 Katta o'qituvchi (berilgan id): ${rows[0].firstName} ${rows[0].lastName} (@${rows[0].username})`);
    return toSeedUser(rows[0]);
  }

  const existing = await ds.query(
    `${SELECT}
      WHERE role IN ('teacher', 'superAdmin', 'admin')
        AND username <> ALL($1)
   ORDER BY CASE role WHEN 'teacher' THEN 0 WHEN 'superAdmin' THEN 1 ELSE 2 END,
            created_at ASC
      LIMIT 1`,
    [mockUsernames()],
  );

  if (existing.length) {
    log(`👑 Katta o'qituvchi (bazadan topildi): ${existing[0].firstName} ${existing[0].lastName} (@${existing[0].username}, ${existing[0].role})`);
    return toSeedUser(existing[0]);
  }

  // Bazada mos foydalanuvchi yo'q — yaratamiz
  const id = uuid();
  const createdAt = daysAgo(400);
  await insertMany('users',
    ['id', 'username', 'password', 'first_name', 'last_name', 'phone_number', 'email',
      'avatar_url', 'role', 'is_active', 'created_at', 'updated_at'],
    [[id, 'mainteacher', await bcrypt.hash(CFG.password.teacher, 10), 'Bosh', "O'qituvchi",
      '+998901000000', 'mainteacher@bunyod.uz',
      'https://api.dicebear.com/9.x/avataaars/svg?seed=mainteacher', 'teacher', true,
      iso(createdAt), iso(createdAt)]]);
  log("👑 Katta o'qituvchi topilmadi — `mainteacher` yaratildi");
  return { id, username: 'mainteacher', firstName: 'Bosh', lastName: "O'qituvchi", role: 'teacher', createdAt, isActive: true, gender: 'm' };
}
type SeedUser = {
  id: string; username: string; firstName: string; lastName: string;
  role: string; createdAt: Date; isActive: boolean; gender: 'm' | 'f';
};

async function seedUsers(owner: SeedUser): Promise<{
  superAdmin: SeedUser; admin: SeedUser;
  subTeachers: SeedUser[]; students: SeedUser[];
}> {
  const hash = async (p: string) => bcrypt.hash(p, 10);
  const pwd = {
    superAdmin: await hash(CFG.password.superAdmin),
    admin: await hash(CFG.password.admin),
    teacher: await hash(CFG.password.teacher),
    subTeacher: await hash(CFG.password.subTeacher),
    student: await hash(CFG.password.student),
  };

  const usedPhones = new Set<string>();
  function phone(): string {
    let p: string;
    do { p = `+9989${int(0, 9)}${String(int(1000000, 9999999))}`; } while (usedPhones.has(p));
    usedPhones.add(p);
    return p;
  }
  const avatar = (seed: string, gender: 'm' | 'f') =>
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${gender === 'm' ? 'b6e3f4,c0aede' : 'ffd5dc,ffdfbf'}`;

  const rows: any[][] = [];
  const COLS = ['id', 'username', 'password', 'first_name', 'last_name', 'phone_number', 'email',
    'telegram_id', 'telegram_username', 'avatar_url', 'role', 'created_by', 'is_active',
    'refresh_token', 'created_at', 'updated_at'];

  let tgCounter = 500000000;
  function push(u: SeedUser, password: string, createdBy: string | null, opts: { email?: string | null; tg?: boolean; avatar?: boolean } = {}) {
    const email = opts.email === undefined
      ? `${u.username}@bunyod.uz`
      : opts.email;
    const tg = opts.tg === false ? null : String(tgCounter++);
    rows.push([
      u.id, u.username, password, u.firstName, u.lastName, phone(), email,
      tg, tg ? `${u.username}_tg` : null,
      opts.avatar === false ? null : avatar(`${u.firstName}${u.lastName}${u.username}`, u.gender),
      u.role, createdBy, u.isActive, null, iso(u.createdAt), iso(u.createdAt),
    ]);
  }

  // superAdmin + admin
  const superAdmin: SeedUser = { id: uuid(), username: 'superadmin', firstName: 'Bunyod', lastName: 'Shamsiddinov', role: 'superAdmin', createdAt: daysAgo(400), isActive: true, gender: 'm' };
  const admin: SeedUser = { id: uuid(), username: 'admin', firstName: 'Nodira', lastName: 'Karimova', role: 'admin', createdAt: daysAgo(390), isActive: true, gender: 'f' };
  push(superAdmin, pwd.superAdmin, null);
  push(admin, pwd.admin, superAdmin.id);

  // subTeachers — markazda guruh egasi bitta, qolganlari yordamchi
  const subTeachers: SeedUser[] = [];
  for (let i = 1; i <= CFG.subTeachers; i++) {
    const gender: 'm' | 'f' = i % 3 === 0 ? 'm' : 'f';
    const u: SeedUser = {
      id: uuid(), username: `subteacher${String(i).padStart(2, '0')}`,
      firstName: gender === 'm' ? MALE[(i * 7) % MALE.length] : FEMALE[(i * 7) % FEMALE.length],
      lastName: SURNAMES[(i * 11) % SURNAMES.length],
      role: 'subTeacher', createdAt: daysAgo(300 - i * 7), isActive: i !== CFG.subTeachers, gender,
    };
    push(u, pwd.subTeacher, owner.id, { tg: i % 4 !== 0 });
    subTeachers.push(u);
  }

  // students — kim qo'shgani turlicha: katta o'qituvchi yoki yordamchilar
  const creators = [owner, ...subTeachers];
  const students: SeedUser[] = [];
  for (let i = 1; i <= CFG.students; i++) {
    const gender: 'm' | 'f' = chance(0.5) ? 'm' : 'f';
    // oxirgi 8 ta o'quvchi — shu hafta qo'shilgan (statistikani tekshirish uchun)
    const age = i > CFG.students - 8 ? int(0, 6) : int(10, 260);
    const u: SeedUser = {
      id: uuid(), username: `student${String(i).padStart(3, '0')}`,
      firstName: gender === 'm' ? pick(MALE) : pick(FEMALE),
      lastName: pick(SURNAMES),
      role: 'student', createdAt: daysAgo(age),
      isActive: !chance(0.07), gender,
    };
    push(u, pwd.student, pick(creators).id, {
      email: chance(0.75) ? `${u.username}@gmail.com` : null,
      tg: chance(0.8),
      avatar: chance(0.85),
    });
    students.push(u);
  }

  await insertMany('users', COLS, rows);
  log(`👥 Foydalanuvchilar: ${rows.length} ta (${CFG.students} o'quvchi, ${CFG.subTeachers} subTeacher, admin, superAdmin)`);

  // ── profillar
  const studentProfiles: any[][] = [];
  for (const s of students) {
    const hasProfile = chance(0.92);
    if (!hasProfile) continue;
    const birth = new Date(1994 + int(0, 16), int(0, 11), int(1, 28));
    studentProfiles.push([
      uuid(), s.id, ymd(birth),
      chance(0.9) ? pick(ADDRESSES) : null,
      pick(['A1', 'A1', 'A2', 'A2', 'A2', 'B1', 'B1', 'B1', 'B2', 'B2', 'C1']),
      chance(0.85) ? pick(GOALS) : null,
    ]);
  }
  await insertMany('student_profiles', ['id', 'user_id', 'birth_date', 'address', 'cefr_level', 'learning_goal'], studentProfiles);

  const teacherProfiles: any[][] = [];
  for (const t of subTeachers) {
    teacherProfiles.push([uuid(), t.id, pick(BIOS), pick(SPECIALIZATIONS), int(1, 4)]);
  }
  // Katta o'qituvchida profil bo'lmasa — yaratamiz (bor bo'lsa tegilmaydi)
  const ownerProfile = await ds.query(`SELECT id FROM teacher_profiles WHERE user_id = $1`, [owner.id]);
  if (!ownerProfile.length) {
    teacherProfiles.push([uuid(), owner.id, BIOS[0], SPECIALIZATIONS[0], int(8, 20)]);
  }
  await insertMany('teacher_profiles', ['id', 'user_id', 'bio', 'specialization', 'experience_years'], teacherProfiles);

  return { superAdmin, admin, subTeachers, students };
}

// ═════════════════════════════════════════════════════════════════════════════
//  4. GURUHLAR, JADVAL, DARS SESSIYALARI, DAVOMAT
// ═════════════════════════════════════════════════════════════════════════════
type SeedGroup = {
  id: string; name: string; teacherId: string; members: SeedUser[];
  pastSessions: { id: string; date: Date }[];
};

const GROUP_COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'teal', 'red', 'indigo', 'amber', 'cyan'];
const GROUP_DAYS: number[][] = [
  [0, 2, 4], [1, 3, 5], [0, 2, 4], [1, 3], [0, 3], [1, 4], [0, 2, 4], [1, 3, 5], [5], [0, 2],
];
const GROUP_TIMES = ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00', '18:30', '19:00', '10:00', '16:00'];

async function seedGroups(
  owner: SeedUser, students: SeedUser[], lessons: LessonRow[],
): Promise<SeedGroup[]> {
  const assignable = students.slice(0, students.length - CFG.studentsWithoutGroup);
  const groups: SeedGroup[] = [];

  const groupRows: any[][] = [];
  const memberRows: any[][] = [];
  const settingRows: any[][] = [];
  const scheduleRows: any[][] = [];
  const sessionRows: any[][] = [];
  const attendanceRows: any[][] = [];

  // o'quvchilarni guruhlarga bo'lish (o'lchamlar har xil)
  const sizes = [26, 24, 22, 21, 19, 18, 17, 15, 13, 11];
  let cursor = 0;

  for (let i = 0; i < CFG.groups; i++) {
    const id = uuid();
    // Markazda guruhni faqat katta o'qituvchi ochadi va olib boradi
    const teacher = owner;
    const members = assignable.slice(cursor, cursor + sizes[i]);
    cursor += sizes[i];

    const status = i === CFG.groups - 1 ? 'archived' : i === CFG.groups - 2 ? 'inactive' : 'active';
    const autoAdvance = i % 3 !== 2;
    const createdAt = daysAgo(120 - i * 5);

    groupRows.push([
      id, GROUP_NAMES[i],
      `${GROUP_NAMES[i]} — Grammar (4th edition) dasturi bo'yicha, haftasiga ${GROUP_DAYS[i].length} marta.`,
      GROUP_COLORS[i], teacher.id, owner.id, status, autoAdvance,
      autoAdvance ? null : int(6, 18), iso(createdAt), iso(createdAt),
    ]);
    for (const m of members) memberRows.push([id, m.id]);

    // individual sozlamalar (erkin o'quvchilar / qo'shimcha ochilgan darslar)
    for (const m of members) {
      if (!chance(0.22)) continue;
      const isFree = chance(0.35);
      settingRows.push([uuid(), id, m.id, isFree, isFree ? null : int(1, 8)]);
    }

    // ── jadval
    const scheduleId = uuid();
    const validFrom = daysAgo(CFG.pastWeeks * 7 + 3);
    scheduleRows.push([
      scheduleId, id, teacher.id,
      `${GROUP_NAMES[i]} — Grammar (4th edition)`,
      JSON.stringify(GROUP_DAYS[i]), GROUP_TIMES[i],
      GROUP_DAYS[i].length >= 3 ? 90 : 120, true,
      ymd(validFrom), i >= CFG.groups - 2 ? ymd(daysAhead(30)) : null,
    ]);

    // ── sessiyalar: o'tgan haftalardan kelgusi haftalargacha
    const pastSessions: { id: string; date: Date }[] = [];
    let lessonPtr = 0;
    for (let d = -CFG.pastWeeks * 7; d <= CFG.futureWeeks * 7; d++) {
      const date = new Date(NOW.getTime() + d * DAY);
      if (!GROUP_DAYS[i].includes(projDay(date))) continue;

      const isPast = date < NOW && ymd(date) !== ymd(NOW);
      const isToday = ymd(date) === ymd(NOW);
      const cancelled = isPast && chance(0.06);
      const status = cancelled ? 'cancelled' : isPast ? 'completed' : isToday ? 'ongoing' : 'scheduled';
      const sid = uuid();
      const lesson = lessons[Math.min(lessonPtr, lessons.length - 1)];
      if (!cancelled) lessonPtr++;

      sessionRows.push([
        sid, scheduleId, id, teacher.id, ymd(date), GROUP_TIMES[i],
        GROUP_DAYS[i].length >= 3 ? 90 : 120,
        lesson?.lessonName ?? `Dars ${lessonPtr + 1}`, status,
        cancelled ? "O'qituvchi kasal bo'lgani uchun bekor qilindi"
          : isPast && chance(0.25) ? 'Uy vazifasi tekshirildi, yangi mavzu tushuntirildi' : null,
        iso(date), iso(date),
      ]);

      if (status === 'completed') {
        pastSessions.push({ id: sid, date });
        for (const m of members) {
          const r = rnd();
          const st = r < 0.76 ? 'present' : r < 0.87 ? 'late' : r < 0.95 ? 'absent' : 'excused';
          const joined = st === 'present' || st === 'late'
            ? new Date(date.getTime() + (st === 'late' ? int(10, 25) : int(-10, 2)) * 60000)
            : null;
          attendanceRows.push([uuid(), sid, m.id, st, joined ? iso(joined) : null, iso(date), iso(date)]);
        }
      }
    }

    groups.push({ id, name: GROUP_NAMES[i], teacherId: teacher.id, members, pastSessions });
  }

  await insertMany('groups',
    ['id', 'name', 'description', 'color', 'teacher_id', 'created_by', 'status',
      'auto_advance_enabled', 'manual_lesson_ceiling', 'created_at', 'updated_at'], groupRows);
  await insertMany('group_members', ['group_id', 'user_id'], memberRows);
  await insertMany('group_member_settings',
    ['id', 'group_id', 'user_id', 'is_free', 'manual_unlock_ceiling'], settingRows);
  await insertMany('schedules',
    ['id', 'group_id', 'teacher_id', 'topic', 'days_of_week', 'start_time',
      'duration_minutes', 'is_recurring', 'valid_from', 'valid_until'], scheduleRows);
  await insertMany('schedule_sessions',
    ['id', 'schedule_id', 'group_id', 'teacher_id', 'session_date', 'start_time',
      'duration_minutes', 'topic', 'status', 'notes', 'created_at', 'updated_at'], sessionRows);
  await insertMany('attendance',
    ['id', 'session_id', 'user_id', 'status', 'joined_at', 'created_at', 'updated_at'], attendanceRows);

  log(`🏫 Guruhlar: ${groupRows.length} ta · a'zolar ${memberRows.length} · sessiyalar ${sessionRows.length} · davomat ${attendanceRows.length}`);
  return groups;
}

// ═════════════════════════════════════════════════════════════════════════════
//  5. LUG'AT (vocabulary)
// ═════════════════════════════════════════════════════════════════════════════
async function seedVocabulary(lessons: LessonRow[]): Promise<string[]> {
  const existingPairs: { id: string }[] = await ds.query(`SELECT id FROM vocabulary_relations LIMIT 500`);
  if (existingPairs.length >= 40) {
    log(`📗 Lug'at: bazada ${existingPairs.length} ta juftlik bor — yangi so'z qo'shilmadi`);
    return existingPairs.map((r) => r.id);
  }

  const enRows: any[][] = [];
  const uzRows: any[][] = [];
  const relRows: any[][] = [];
  const exRows: any[][] = [];
  const synRows: any[][] = [];
  const antRows: any[][] = [];

  const enId = new Map<string, string>();
  VOCAB.forEach((v, i) => {
    const eid = uuid();
    const uid = uuid();
    const pid = uuid();
    enId.set(v.en, eid);
    const lesson = lessons[i % lessons.length];
    enRows.push([eid, v.en, 'en', v.ipa || null, v.pos, lesson?.id ?? null,
      `tts/${v.en}.mp3`, `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(v.en)}`, i]);
    uzRows.push([uid, v.uz, 'uz', null, v.pos, lesson?.id ?? null, null, null, i]);
    relRows.push([pid, eid, uid, int(3, 60), int(0, 12), Number((rnd() * 0.9).toFixed(2))]);
    exRows.push([uuid(), pid, v.ex, v.exUz, v.en, 0]);
    // ba'zi juftliklarga ikkinchi misol
    if (chance(0.4)) {
      exRows.push([uuid(), pid, `Try to use "${v.en}" in your own sentence.`,
        `"${v.en}" so'zini o'z gapingizda ishlating.`, v.en, 1]);
    }
  });

  for (const [a, b] of SYNONYMS) {
    const x = enId.get(a); const y = enId.get(b);
    if (x && y) { synRows.push([x, y]); synRows.push([y, x]); }
  }
  for (const [a, b] of ANTONYMS) {
    const x = enId.get(a); const y = enId.get(b);
    if (x && y) { antRows.push([x, y]); antRows.push([y, x]); }
  }

  const vCols = ['id', 'word', 'lang', 'ipa', 'pos', 'lesson_id', 'voice_file_id', 'image_url', 'order_index'];
  await insertMany('vocabularys', vCols, enRows);
  await insertMany('vocabularys', vCols, uzRows);
  await insertMany('vocabulary_relations',
    ['id', 'vocabulary_id', 'translation_id', 'attempts', 'wrong_attempts', 'difficulty'], relRows);
  await insertMany('vocabulary_examples',
    ['id', 'pair_id', 'english_text', 'uzbek_text', 'highlight_word', 'order_index'], exRows);
  await insertMany('vocabulary_synonyms', ['vocabulary_id', 'synonym_id'], synRows);
  await insertMany('vocabulary_antonyms', ['vocabulary_id', 'antonym_id'], antRows);

  log(`📗 Lug'at: ${VOCAB.length} juftlik, ${exRows.length} misol, ${synRows.length / 2} sinonim, ${antRows.length / 2} antonim`);
  return relRows.map((r) => r[0]);
}

// ═════════════════════════════════════════════════════════════════════════════
//  6. O'QUV FAOLIYATI: progress, javoblar, XP, streak, kunlik faollik
// ═════════════════════════════════════════════════════════════════════════════

/** O'quvchi "profili" — statistikaning barchasi shu darajadan kelib chiqadi */
type Persona = {
  /** 0..1 — umumiy tirishqoqlik */
  diligence: number;
  /** o'rtacha ball darajasi */
  skill: number;
  /** nechta darsni tugatgan */
  completed: number;
  active: boolean;
};

function buildPersona(index: number, maxLessons: number): Persona {
  // taqsimot: 12% "yulduz", 25% kuchli, 38% o'rta, 17% sust, 8% umuman boshlamagan
  const r = rnd();
  if (r < 0.08) return { diligence: rnd() * 0.1, skill: 0.3 + rnd() * 0.2, completed: 0, active: false };
  if (r < 0.25) return { diligence: 0.15 + rnd() * 0.2, skill: 0.35 + rnd() * 0.2, completed: int(1, Math.max(2, Math.floor(maxLessons * 0.2))), active: true };
  if (r < 0.63) return { diligence: 0.4 + rnd() * 0.2, skill: 0.55 + rnd() * 0.2, completed: int(Math.floor(maxLessons * 0.2), Math.floor(maxLessons * 0.55)), active: true };
  if (r < 0.88) return { diligence: 0.62 + rnd() * 0.2, skill: 0.7 + rnd() * 0.18, completed: int(Math.floor(maxLessons * 0.45), Math.floor(maxLessons * 0.8)), active: true };
  return { diligence: 0.85 + rnd() * 0.15, skill: 0.85 + rnd() * 0.14, completed: int(Math.floor(maxLessons * 0.7), maxLessons), active: true };
}

const SKILLS = ['grammar', 'reading', 'listening', 'speaking', 'writing', 'vocabulary'];
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** matching javobini o'quvchi nuqtai nazaridan yasash */
function matchingAnswer(options: any, correct: boolean): string {
  const opts: any[] = Array.isArray(options) ? options : [];
  const map: Record<string, string> = {};
  const keys = opts.map((o) => (typeof o === 'string' ? o : o.matchKey ?? ''));
  opts.forEach((o, i) => {
    const text = typeof o === 'string' ? o : o.text ?? '';
    const right = typeof o === 'string' ? o : o.matchKey ?? '';
    map[text] = correct ? right : keys[(i + 1) % keys.length] ?? right;
  });
  return JSON.stringify(map);
}

/** noto'g'ri javob matnini yasash */
function wrongAnswer(q: QItem): string {
  const opts = Array.isArray(q.options) ? q.options : null;
  if (opts && opts.length) {
    const texts = opts.map((o: any) => (typeof o === 'string' ? o : o.text)).filter((t: string) => t && t !== q.correctAnswer);
    if (texts.length) return pick(texts);
  }
  if (q.exerciseType === 'true_false') return q.correctAnswer === 'true' ? 'false' : 'true';
  return `${q.correctAnswer} (?)`;
}

function answerFor(q: QItem, correct: boolean): string {
  if (q.exerciseType === 'matching') return matchingAnswer(q.options, correct);
  if (correct) return q.correctAnswer;
  return wrongAnswer(q);
}

async function seedLearning(
  students: SeedUser[], lessons: LessonRow[], questionsByLesson: Map<string, QItem[]>,
  pairIds: string[], achievements: { id: string; code: string }[],
  groups: SeedGroup[],
): Promise<Map<string, { xpTotal: number; xpWeekly: number }>> {
  const progressRows: any[][] = [];
  const answerRows: any[][] = [];
  const trackingRows: any[][] = [];
  const activityRows: any[][] = [];
  const xpRows: any[][] = [];
  const skillRows: any[][] = [];
  const gamRows: any[][] = [];
  const userAchRows: any[][] = [];
  const vocabProgRows: any[][] = [];
  const vocabSessionRows: any[][] = [];
  const practiceRows: any[][] = [];
  const notificationRows: any[][] = [];

  const achByCode = new Map(achievements.map((a) => [a.code, a.id]));
  const groupOf = new Map<string, SeedGroup>();
  for (const g of groups) for (const m of g.members) groupOf.set(m.id, g);

  const xpByUser = new Map<string, { xpTotal: number; xpWeekly: number }>();

  students.forEach((student, sIdx) => {
    const persona = buildPersona(sIdx, lessons.length);
    const done = Math.min(persona.completed, lessons.length);

    // ── 1) kunlik faollik (daily_tracking) — streak shu yerdan hisoblanadi
    const activeDays: number[] = [];
    for (let d = CFG.trackingDays - 1; d >= 0; d--) {
      // yaqin kunlarda faollik yuqoriroq
      const recency = 1 - d / (CFG.trackingDays * 1.6);
      if (!persona.active) break;
      if (!chance(persona.diligence * recency * 1.15)) continue;
      activeDays.push(d);
    }
    // streak: bugundan orqaga qarab uzluksiz kunlar
    let streakCurrent = 0;
    const activeSet = new Set(activeDays);
    for (let d = 0; d < CFG.trackingDays; d++) {
      if (activeSet.has(d)) streakCurrent++;
      else if (d === 0) continue; // bugun hali shug'ullanmagan bo'lishi mumkin
      else break;
    }
    let streakMax = 0; let run = 0;
    for (let d = CFG.trackingDays - 1; d >= 0; d--) {
      if (activeSet.has(d)) { run++; streakMax = Math.max(streakMax, run); } else run = 0;
    }
    streakMax = Math.max(streakMax, streakCurrent);

    let xpWeekly = 0;
    let vocabReviewedTotal = 0;
    for (const d of activeDays) {
      const date = daysAgo(d);
      const minutes = int(10, 25) + Math.round(persona.diligence * 55);
      const lessonsDone = chance(0.55) ? 1 : chance(0.25) ? 2 : 0;
      const words = int(0, 12) + Math.round(persona.diligence * 20);
      vocabReviewedTotal += words;
      trackingRows.push([
        uuid(), student.id, ymd(date), minutes, lessonsDone, words,
        chance(0.4), pick([20, 30, 30, 45, 60]), iso(date), iso(date),
      ]);
      if (d < 7) xpWeekly += minutes * 2 + lessonsDone * 30;

      // activity_log — kunning 1–2 ta faoliyat yozuvi
      const entries = chance(0.4) ? 2 : 1;
      for (let e = 0; e < entries; e++) {
        const hour = pick([8, 9, 10, 13, 14, 16, 18, 19, 20, 21, 21, 22]);
        const at = new Date(date); at.setHours(hour, int(0, 59), 0, 0);
        activityRows.push([
          uuid(), student.id, iso(at), projDay(date), hour,
          Math.max(1, Math.round(minutes / entries)),
          pick(['lesson', 'vocabulary', 'listening', 'reading', 'test']),
          iso(at), iso(at),
        ]);
      }
    }

    // ── 2) dars progressi
    let xpTotal = 0;
    let bestScore = 0;
    const answeredLessons = new Set<string>();
    for (let i = 0; i < done; i++) {
      const lesson = lessons[i];
      const isLast = i >= done - CFG.answeredLessonsPerStudent;
      const base = persona.skill * 100;
      const jitter = () => Math.max(20, Math.min(100, Math.round(base + (rnd() - 0.5) * 28)));

      let quizScore: number | null = jitter();
      let grammarScore: number | null = jitter();
      let readingScore: number | null = chance(0.7) ? jitter() : null;
      let listeningScore: number | null = chance(0.6) ? jitter() : null;
      const vocabularyScore = chance(0.8) ? jitter() : null;
      const speakingScore = chance(0.45) ? jitter() : null;

      // oxirgi darslarga haqiqiy savol-javoblar yoziladi va ball shundan hisoblanadi
      if (isLast) {
        const qs = questionsByLesson.get(lesson.id) ?? [];
        if (qs.length) {
          answeredLessons.add(lesson.id);
          const perBlock = new Map<string, { ok: number; total: number; type: string }>();
          for (const q of qs) {
            const correct = chance(persona.skill * 0.9 + 0.05);
            const answeredAt = daysAgo(Math.max(0, (done - i) * 2 + int(0, 2)));
            answerRows.push([
              uuid(), student.id, q.lessonId, q.blockType, q.blockId, q.id,
              answerFor(q, correct), correct, iso(answeredAt), iso(answeredAt), iso(answeredAt),
            ]);
            if (q.exerciseType === 'translation') continue; // ballga kirmaydi
            const key = q.blockId;
            if (!perBlock.has(key)) perBlock.set(key, { ok: 0, total: 0, type: q.blockType });
            const b = perBlock.get(key)!;
            b.total++; if (correct) b.ok++;
          }
          for (const b of perBlock.values()) {
            const pct = Math.round((b.ok / b.total) * 100);
            if (b.type === 'quiz') quizScore = pct;
            else if (b.type === 'grammar') grammarScore = pct;
            else if (b.type === 'reading') readingScore = pct;
            else if (b.type === 'listening') listeningScore = pct;
          }
        }
      }

      const parts = [quizScore, readingScore, listeningScore, grammarScore].filter((v): v is number => v != null);
      const score = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
      bestScore = Math.max(bestScore, score ?? 0);

      const completedAt = daysAgo(Math.max(0, Math.round((done - i) * (CFG.trackingDays / Math.max(done, 1)) * 0.8)));
      const timeSpent = int(300, 1500) + Math.round(persona.diligence * 900);
      progressRows.push([
        uuid(), student.id, lesson.id, 'completed', score,
        grammarScore, quizScore, vocabularyScore, listeningScore, readingScore, speakingScore,
        timeSpent, chance(0.25) ? 2 : 1, iso(completedAt), iso(completedAt), iso(completedAt),
      ]);

      const xp = Math.round(10 + (score ?? 50) / 100 * 40);
      xpTotal += xp;
      xpRows.push([uuid(), student.id, xp, 'lesson_complete', lesson.id, iso(completedAt), iso(completedAt)]);
    }

    // joriy (tugallanmagan) dars
    if (persona.active && done < lessons.length) {
      const lesson = lessons[done];
      const partial = Math.round(persona.skill * 100);
      progressRows.push([
        uuid(), student.id, lesson.id, 'in_progress', chance(0.6) ? partial : null,
        chance(0.6) ? partial : null, chance(0.5) ? partial : null, null, null, null, null,
        int(60, 600), 1, null, iso(daysAgo(int(0, 3))), iso(daysAgo(int(0, 3))),
      ]);
      // "not_started" holati ham bo'lsin
      if (done + 1 < lessons.length && chance(0.5)) {
        progressRows.push([
          uuid(), student.id, lessons[done + 1].id, 'not_started', null,
          null, null, null, null, null, null, 0, 1, null, iso(daysAgo(1)), iso(daysAgo(1)),
        ]);
      }
    }

    // ── 3) so'z o'rganish
    const myPairs = sample(pairIds, Math.round(pairIds.length * (0.2 + persona.diligence * 0.75)));
    let mastered = 0;
    for (const pid of myPairs) {
      const r = rnd();
      const status = r < persona.skill * 0.55 ? 'mastered' : r < 0.85 ? 'learning' : 'new';
      if (status === 'mastered') mastered++;
      const attempts = status === 'new' ? 0 : int(1, 14);
      vocabProgRows.push([
        uuid(), student.id, pid, status, attempts,
        status === 'new' ? 0 : Math.min(attempts, int(0, 5)),
        status === 'mastered' ? iso(daysAhead(int(5, 30))) : status === 'learning' ? iso(daysAhead(int(0, 3))) : null,
      ]);
    }
    if (mastered) {
      xpTotal += mastered * 2;
      xpRows.push([uuid(), student.id, mastered * 2, 'vocabulary_mastered', null,
        iso(daysAgo(int(1, 20))), iso(daysAgo(int(1, 20)))]);
    }

    // vocabulary_sessions + practice logs
    const sessionCount = Math.round(persona.diligence * 8);
    for (let s = 0; s < sessionCount; s++) {
      const sid = uuid();
      // tirishqoq o'quvchilarda BUGUNGI sessiya ham bo'lsin
      // ("Bugungi mashg'ulot" paneli bo'sh qolmasligi uchun)
      const at = s === 0 && persona.diligence > 0.5
        ? new Date(NOW.getTime() - int(1, 9) * 3600000)
        : daysAgo(int(0, 45));
      const completedCount = int(5, 20);
      vocabSessionRows.push([sid, student.id, completedCount, int(120, 900), iso(at), iso(at)]);
      for (const pid of sample(myPairs, Math.min(completedCount, myPairs.length))) {
        practiceRows.push([uuid(), sid, pid,
          pick([0, 1, 2, 3]), chance(persona.skill)]);
      }
    }

    // ── 4) streak / challenge XP
    if (streakCurrent >= 3) {
      const bonus = streakCurrent * 5;
      xpTotal += bonus;
      xpRows.push([uuid(), student.id, bonus, 'streak_bonus', null, iso(daysAgo(1)), iso(daysAgo(1))]);
    }
    if (chance(0.3)) {
      xpTotal += 25;
      xpRows.push([uuid(), student.id, 25, 'challenge_bonus', null, iso(daysAgo(int(2, 10))), iso(daysAgo(int(2, 10)))]);
    }

    // ── 5) gamification yozuvi
    const league = xpTotal > 1600 ? 'diamond' : xpTotal > 1100 ? 'platinum'
      : xpTotal > 650 ? 'gold' : xpTotal > 250 ? 'silver' : 'bronze';
    const lastActive = activeDays.length ? ymd(daysAgo(Math.min(...activeDays))) : null;
    gamRows.push([
      uuid(), student.id, Math.floor(xpTotal / 100) + 1, xpTotal, xpWeekly, league,
      streakCurrent, streakMax, lastActive,
      null, 0, null, iso(startOfWeek(NOW)),  // rank_weekly / previous_* keyin yangilanadi
    ]);
    xpByUser.set(student.id, { xpTotal, xpWeekly });

    // ── 6) ko'nikmalar (user_skills)
    for (const skill of SKILLS) {
      const raw = Math.max(5, Math.min(100, Math.round(persona.skill * 100 + (rnd() - 0.5) * 30)));
      const cefr = CEFR_ORDER[Math.min(5, Math.floor(raw / 18))];
      skillRows.push([uuid(), student.id, skill, cefr, raw,
        skill === 'vocabulary' ? mastered : null]);
    }

    // ── 7) yutuqlar
    const earned: string[] = [];
    if (done >= 1) earned.push('first_lesson');
    if (done >= 10) earned.push('fast_learner');
    if (streakMax >= 3) earned.push('streak_3');
    if (streakMax >= 7) earned.push('streak_7');
    if (streakMax >= 30) earned.push('streak_30');
    if (mastered >= 50) earned.push('words_50');
    if (mastered >= 100) earned.push('words_100');
    if (bestScore >= 100) earned.push('perfect_score');
    for (const code of earned) {
      const aid = achByCode.get(code);
      if (!aid) continue;
      const at = daysAgo(int(1, 60));
      userAchRows.push([uuid(), student.id, aid, iso(at), iso(at), iso(at)]);
    }

    // ── 8) bildirishnomalar
    const group = groupOf.get(student.id);
    const nextLesson = lessons[Math.min(done, lessons.length - 1)];
    const lastEarned = earned.length ? achByCode.get(earned[earned.length - 1]) ?? null : null;
    // [tur, sarlavha, matn, reference_id, reference_type]
    const notifDefs: [string, string, string, string | null, string | null][] = [
      ['lesson_unlocked', 'Yangi dars ochildi', `"${nextLesson?.lessonName ?? 'Keyingi dars'}" darsi endi mavjud.`, nextLesson?.id ?? null, 'lesson'],
      ['achievement', 'Yangi yutuq!', earned.length ? `Siz "${ACHIEVEMENTS.find((a) => a.code === earned[earned.length - 1])?.title}" yutug'ini qo'lga kiritdingiz.` : 'Birinchi darsni yakunlang va yutuq oling.', lastEarned, lastEarned ? 'achievement' : null],
      ['reminder', 'Bugun shug\'ullandingizmi?', `Ketma-ketligingiz ${streakCurrent} kun. Uni uzmang!`, null, null],
      ['assignment', 'Yangi topshiriq', group ? `${group.name} guruhiga yangi uy vazifasi berildi.` : 'Sizga yangi uy vazifasi berildi.', group?.id ?? null, group ? 'group' : null],
      ['system', 'Ilova yangilandi', 'Yangi mashq turlari qo\'shildi — sinab ko\'ring.', null, null],
      ['message', 'O\'qituvchidan xabar', 'Darsdan keyin men bilan bog\'laning.', group?.teacherId ?? null, group ? 'user' : null],
    ];
    for (const [type, title, body, refId, refType] of sample(notifDefs, int(2, 5))) {
      const at = daysAgo(int(0, 21));
      notificationRows.push([uuid(), student.id, type, title, body, chance(0.55),
        refId, refType, iso(at), iso(at)]);
    }
  });

  await insertMany('lesson_progress',
    ['id', 'user_id', 'lesson_id', 'status', 'score', 'grammar_score', 'quiz_score',
      'vocabulary_score', 'listening_score', 'reading_score', 'speaking_score',
      'time_spent_sec', 'attempts', 'completed_at', 'created_at', 'updated_at'], progressRows);
  await insertMany('student_answers',
    ['id', 'user_id', 'lesson_id', 'block_type', 'block_id', 'question_id',
      'given_answer', 'is_correct', 'answered_at', 'created_at', 'updated_at'], answerRows);
  await insertMany('daily_tracking',
    ['id', 'user_id', 'date', 'minutes_spent', 'lessons_completed', 'vocabulary_reviewed',
      'listening_done', 'goal_minutes', 'created_at', 'updated_at'], trackingRows);
  await insertMany('activity_log',
    ['id', 'user_id', 'logged_at', 'day_of_week', 'hour_of_day', 'duration_minutes',
      'activity_type', 'created_at', 'updated_at'], activityRows);
  await insertMany('xp_transactions',
    ['id', 'user_id', 'amount', 'source', 'reference_id', 'created_at', 'updated_at'], xpRows);
  await insertMany('user_gamification',
    ['id', 'user_id', 'level', 'xp_total', 'xp_weekly', 'league', 'streak_current',
      'streak_max', 'last_activity_date', 'rank_weekly', 'previous_week_xp',
      'previous_rank_weekly', 'week_snapshot_at'], gamRows);
  await insertMany('user_skills',
    ['id', 'user_id', 'skill', 'cefr_level', 'score', 'words_count'], skillRows);
  await insertMany('user_achievements',
    ['id', 'user_id', 'achievement_id', 'earned_at', 'created_at', 'updated_at'], userAchRows);
  await insertMany('user_vocabulary_progress',
    ['id', 'user_id', 'pair_id', 'status', 'attempts', 'wrong_attempts', 'next_review_at'], vocabProgRows);
  await insertMany('vocabulary_sessions',
    ['id', 'user_id', 'completed_count', 'time_spent_sec', 'created_at', 'updated_at'], vocabSessionRows);
  await insertMany('vocabulary_practice_logs',
    ['id', 'session_id', 'pair_id', 'mode', 'correct'], practiceRows);
  await insertMany('notifications',
    ['id', 'user_id', 'type', 'title', 'body', 'is_read', 'reference_id', 'reference_type',
      'created_at', 'updated_at'], notificationRows);

  log(`📈 O'quv faoliyati: progress ${progressRows.length} · javob ${answerRows.length} · kunlik ${trackingRows.length} · XP ${xpRows.length} · so'z ${vocabProgRows.length}`);
  return xpByUser;
}

// ═════════════════════════════════════════════════════════════════════════════
//  7. TOPSHIRIQLAR VA JAVOBLAR
// ═════════════════════════════════════════════════════════════════════════════
const ASSIGNMENT_TYPES = ['reading', 'listening', 'writing', 'speaking', 'grammar', 'vocabulary', 'test'];
const FEEDBACKS = [
  'Yaxshi ish! Grammatik xatolar deyarli yo\'q.',
  'Mavzu ochilgan, lekin bir nechta imlo xatosi bor.',
  'Zo\'r! Keyingi safar uzunroq gaplar tuzishga harakat qiling.',
  'Vazifa to\'liq bajarilmagan — 3-savolga javob yo\'q.',
  'Talaffuz yaxshilanibdi, davom eting.',
  'Fikringizni misollar bilan asoslashingiz kerak.',
];

async function seedAssignments(groups: SeedGroup[], lessons: LessonRow[]): Promise<void> {
  const aRows: any[][] = [];
  const sRows: any[][] = [];

  for (const g of groups) {
    for (let k = 0; k < 6; k++) {
      const id = uuid();
      const type = ASSIGNMENT_TYPES[k % ASSIGNMENT_TYPES.length];
      const status = k === 0 ? 'draft' : k <= 3 ? 'active' : 'closed';
      const lesson = lessons[(k * 3) % lessons.length];
      const created = daysAgo(60 - k * 8);
      const due = status === 'closed' ? daysAgo(int(3, 20)) : daysAhead(int(1, 12));
      aRows.push([
        id, `${g.name} — ${k + 1}-topshiriq (${type})`,
        `"${lesson.lessonName}" darsi bo'yicha ${type} vazifasi. Javobni belgilangan muddatgacha yuklang.`,
        type, g.teacherId, g.id, lesson.id, iso(due), pick([50, 100, 100, 20]), status,
        iso(created), iso(created),
      ]);

      if (status === 'draft') continue;
      for (const m of g.members) {
        if (!chance(0.75)) continue;
        const r = rnd();
        let subStatus: string;
        if (r < 0.45) subStatus = 'graded';
        else if (r < 0.65) subStatus = 'submitted';
        else if (r < 0.78) subStatus = 'pending';
        else if (r < 0.9) subStatus = 'late';
        else subStatus = 'revision_needed';

        const submittedAt = subStatus === 'pending' ? null : daysAgo(int(1, 25));
        const graded = subStatus === 'graded' || subStatus === 'revision_needed';
        sRows.push([
          uuid(), id, m.id,
          chance(0.4) ? `uploads/homework/${m.username}-${k + 1}.pdf` : null,
          chance(0.7) ? `Assalomu alaykum, vazifani bajardim. ${pick(['Rahmat!', 'Savolim bor edi.', 'Iltimos tekshirib bering.'])}` : null,
          graded ? int(40, 100) : null,
          graded ? pick(FEEDBACKS) : null,
          subStatus,
          submittedAt ? iso(submittedAt) : null,
          graded && submittedAt ? iso(new Date(submittedAt.getTime() + DAY)) : null,
          graded ? g.teacherId : null,
          iso(submittedAt ?? daysAgo(int(1, 25))), iso(daysAgo(int(0, 5))),
        ]);
      }
    }
  }

  await insertMany('assignments',
    ['id', 'title', 'description', 'type', 'teacher_id', 'group_id', 'lesson_id',
      'due_date', 'max_score', 'status', 'created_at', 'updated_at'], aRows);
  await insertMany('assignment_submissions',
    ['id', 'assignment_id', 'student_id', 'file_id', 'text_content', 'score', 'feedback',
      'status', 'submitted_at', 'graded_at', 'graded_by', 'created_at', 'updated_at'], sRows);

  log(`📝 Topshiriqlar: ${aRows.length} ta · javoblar ${sRows.length} ta`);
}

// ═════════════════════════════════════════════════════════════════════════════
//  8. XABARLAR (messages) + xodimlar uchun bildirishnomalar
// ═════════════════════════════════════════════════════════════════════════════
const MSG_FROM_TEACHER = [
  'Assalomu alaykum! Bugungi darsga tayyorlanib keling.',
  'Uy vazifangizni tekshirdim, natija yaxshi.',
  'Ertangi darsda test bo\'ladi, 1–5 darslarni takrorlang.',
  'Bugun darsga kelmadingiz, sababini yozing.',
  'Yangi so\'z paketini ilovaga qo\'shdim.',
];
const MSG_FROM_STUDENT = [
  'Assalomu alaykum, bugun darsga kech qolaman.',
  'Uy vazifasini qayerga yuklashim kerak?',
  'Rahmat, tushundim!',
  'Ustoz, 3-mashqda savolim bor edi.',
  'Kasal bo\'lib qoldim, ertangi darsga kelolmayman.',
];

async function seedMessages(groups: SeedGroup[], owner: SeedUser, admin: SeedUser): Promise<void> {
  const rows: any[][] = [];
  for (const g of groups) {
    for (const m of sample(g.members, Math.min(8, g.members.length))) {
      const at = daysAgo(int(0, 30));
      rows.push([uuid(), g.teacherId, m.id, pick(MSG_FROM_TEACHER),
        chance(0.2) ? JSON.stringify([{ file_id: 'uploads/hw/task.pdf', type: 'pdf', name: 'Vazifa.pdf' }]) : null,
        chance(0.6), iso(at), iso(at)]);
      if (chance(0.6)) {
        const at2 = new Date(at.getTime() + int(10, 300) * 60000);
        rows.push([uuid(), m.id, g.teacherId, pick(MSG_FROM_STUDENT), null, chance(0.5), iso(at2), iso(at2)]);
      }
    }
  }
  // admin → katta o'qituvchi
  for (let k = 0; k < 3; k++) {
    const at = daysAgo(int(1, 14));
    rows.push([uuid(), admin.id, owner.id,
      pick(['Oylik hisobotni juma kuniga qadar yuboring.',
            'Yangi guruh uchun xona ajratildi.',
            "Yordamchi o'qituvchilar jadvalini tasdiqlang."]),
      null, chance(0.5), iso(at), iso(at)]);
  }
  await insertMany('messages',
    ['id', 'sender_id', 'receiver_id', 'body', 'attachments', 'is_read', 'created_at', 'updated_at'], rows);

  log(`💬 Xabarlar: ${rows.length} ta`);
}

async function seedStaffNotifications(owner: SeedUser, subTeachers: SeedUser[], admin: SeedUser, groups: SeedGroup[]): Promise<void> {
  const rows: any[][] = [];
  // DIQQAT: har bir yozuv mock guruhga havola qiladi (reference_type='group') —
  // shunda qayta ishga tushirilganda cleanup ularni topib o'chira oladi.
  // Aks holda katta o'qituvchi o'chirilmagani uchun bildirishnomalar to'planib borardi.
  for (const u of [owner, ...subTeachers, admin]) {
    const defs: [string, string, string][] = [
      ['assignment', 'Tekshirilmagan ishlar', 'Sizda tekshirilmagan uy vazifalari bor.'],
      ['reminder', 'Bugungi darslar', 'Bugun 2 ta dars rejalashtirilgan.'],
      ['system', 'Tizim yangilandi', 'Nazorat bo\'limiga yangi filtrlar qo\'shildi.'],
      ['message', 'Yangi xabar', 'Sizga o\'quvchidan xabar keldi.'],
    ];
    for (const [type, title, body] of sample(defs, int(2, 4))) {
      const at = daysAgo(int(0, 10));
      const g = pick(groups);
      rows.push([uuid(), u.id, type, title, body, chance(0.4), g?.id ?? null, g ? 'group' : null, iso(at), iso(at)]);
    }
  }
  await insertMany('notifications',
    ['id', 'user_id', 'type', 'title', 'body', 'is_read', 'reference_id', 'reference_type',
      'created_at', 'updated_at'], rows);
}

/**
 * `lessons.group_id` — guruhga biriktirilgan maxsus dars ustuni.
 * Hech bir so'rov bu ustun bo'yicha filtrlamaydi, shuning uchun demo uchun
 * bir nechta darsga qiymat qo'yiladi (faqat skriptning O'ZI yaratgan darslarga —
 * sizning haqiqiy darslaringiz o'zgartirilmaydi).
 */
async function linkGroupLessons(groups: SeedGroup[], lessons: LessonRow[]): Promise<void> {
  if (!lessonsCreatedByScript || !groups.length || lessons.length < 3) return;
  const targets = lessons.slice(-3);
  for (let i = 0; i < targets.length; i++) {
    await ds.query(`UPDATE lessons SET group_id = $1 WHERE id = $2`, [groups[i % groups.length].id, targets[i].id]);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  9. REYTING (rank_weekly) — guruh ichida haftalik XP bo'yicha
// ═════════════════════════════════════════════════════════════════════════════
async function computeRanks(): Promise<void> {
  await ds.query(`
    UPDATE user_gamification g
       SET rank_weekly = r.rn,
           previous_rank_weekly = GREATEST(1, r.rn + ((r.rn * 7) % 5) - 2),
           previous_week_xp = GREATEST(0, ROUND(g.xp_weekly * (0.55 + ((r.rn % 6) / 10.0)))::int)
      FROM (
        SELECT gm.user_id,
               ROW_NUMBER() OVER (PARTITION BY gm.group_id ORDER BY ug.xp_weekly DESC, ug.xp_total DESC) AS rn
          FROM group_members gm
          JOIN user_gamification ug ON ug.user_id = gm.user_id
      ) r
     WHERE g.user_id = r.user_id
  `);
  log('🏆 Reyting: guruh ichidagi haftalik o\'rinlar hisoblandi');
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  const t0 = Date.now();
  await ds.initialize();
  log('✅ Bazaga ulanildi\n');

  await loadDbColumns();
  await cleanup();
  const achievements = await seedAchievements();
  const lessons = await ensureLessons();
  const questionsByLesson = await loadQuestions(lessons.map((l) => l.id));
  const owner = await resolveOwner();
  const { admin, subTeachers, students } = await seedUsers(owner);
  const groups = await seedGroups(owner, students, lessons);
  const pairIds = await seedVocabulary(lessons);
  await seedLearning(students, lessons, questionsByLesson, pairIds, achievements, groups);
  await seedAssignments(groups, lessons);
  await seedMessages(groups, owner, admin);
  await seedStaffNotifications(owner, subTeachers, admin, groups);
  await linkGroupLessons(groups, lessons);
  await computeRanks();

  log('\n─────────────────────────────────────────────');
  log('📊 Jadval bo\'yicha qo\'shilgan qatorlar:');
  for (const [table, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    log(`   ${table.padEnd(28)} ${String(count).padStart(6)}`);
  }
  log(`   ${'JAMI'.padEnd(28)} ${String(inserted).padStart(6)}`);
  log('─────────────────────────────────────────────');
  log('\n🔑 Kirish ma\'lumotlari:');
  log(`   superadmin      / ${CFG.password.superAdmin}`);
  log(`   admin           / ${CFG.password.admin}`);
  log(`   subteacher01..${String(CFG.subTeachers).padStart(2, '0')} / ${CFG.password.subTeacher}`);
  log(`   guruhlar egasi   : @${owner.username} (${owner.firstName} ${owner.lastName}) — o'z paroli`);
  log(`   student001..${CFG.students}  / ${CFG.password.student}`);
  log(`\n🎉 Tayyor — ${((Date.now() - t0) / 1000).toFixed(1)} soniyada\n`);

  await ds.destroy();
}

main().catch(async (err) => {
  console.error('❌ Xato:', err);
  try { await ds.destroy(); } catch { /* ignore */ }
  process.exit(1);
});

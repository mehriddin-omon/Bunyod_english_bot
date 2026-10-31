/**
 * DARS BALLI (`lesson_progress.score`) va BO'LIM FOIZLARI — YAGONA formula.
 *
 *   Bo'lim foizlari (teacher paneldagi kartalar):
 *     Grammatika = ishlangan har statik mashqning ENG YAXSHI foizi (+ bazadagi grammatika bloki) o'rtachasi —
 *                  ro'yxatda ko'rsatilgan hamma mashq, ekrandan olib tashlanganlari ham
 *     Lug'at     = mustahkam so'zlar / darsdagi so'zlar («mustahkam» — coinli sinovda to'g'ri)
 *     Reading, Listening, Test, Speaking = `lesson_progress` dagi ballar
 *   Dars balli = kartalar o'rtachasi (faqat ishlangan bo'limlar, har karta yaxlitlangan qiymati bilan)
 *
 * Hech qaysi bo'lim ishlanmagan bo'lsa ball `null` (chaqiruvchi eski qiymatni qoldiradi).
 *
 * Ishlatiladi: LessonScoreService (har yangi natijada), monitoring (kartalar, mavzular jadvali,
 * ko'nikmalar), 1790100000000-RecalcLessonScores migratsiyasi.
 */

export interface ExerciseBest {
  exerciseKey: string;
  best: number;
}

export interface LessonScoreInput {
  exerciseBests: ExerciseBest[];
  grammarScore: number | null;
  readingScore: number | null;
  listeningScore: number | null;
  quizScore: number | null;
  speakingScore?: number | null;
  /** `vocabularyPercent()` natijasi */
  vocabularyPercent?: number | null;
}

/** Kartalar tartibi — teacher paneldagi bilan bir xil */
export const SECTION_KEYS = ['grammar', 'vocabulary', 'reading', 'listening', 'quiz', 'speaking'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const num = (v: unknown): number | null => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Grammatika bo'limi foizi (kasr, yaxlitlanmagan) yoki `null` — hali ishlanmagan */
export function grammarSectionScore(
  input: Pick<LessonScoreInput, 'exerciseBests' | 'grammarScore'>,
): number | null {
  const items = input.exerciseBests
    .filter((e) => e.exerciseKey.split(':')[1] === 'grammar')
    .map((e) => Number(e.best));
  const block = num(input.grammarScore);
  if (block != null) items.push(block);
  return items.length ? mean(items) : null;
}

/**
 * Ilova ICHIDAGI (statik) mashqlardan iborat bo'lim foizi — kalit
 * `lesson1:listening:ex1` ko'rinishida. Listening 2026-10 dan boshlab
 * ilova ichida (src/content/listening): server kontentni bilmaydi, faqat
 * natijani (`exercise_results`) oladi, shuning uchun bo'lim foizi shundan
 * hisoblanadi. Eski, teacher kiritgan listeningli darslarda bunday kalit
 * bo'lmaydi va `lesson_progress` dagi eski ball ishlatilaveradi.
 */
export function staticSectionScore(
  input: Pick<LessonScoreInput, 'exerciseBests'>,
  section: string,
): number | null {
  const items = input.exerciseBests
    .filter((e) => e.exerciseKey.split(':')[1] === section)
    .map((e) => Number(e.best));
  return items.length ? mean(items) : null;
}

/**
 * Lug'at bo'limi foizi: mustahkam so'zlar / darsdagi so'zlar.
 * `null` — darsda so'z yo'q yoki lug'at hali ishlanmagan (`touched` — bosqich, sinov yoki mashq bor).
 */
export function vocabularyPercent(mastered: number, total: number, touched: boolean): number | null {
  if (!touched || total <= 0) return null;
  return Math.round((mastered / total) * 100);
}

/** Har bo'lim kartasining foizi (butun) yoki `null` — bo'lim ishlanmagan */
export function sectionScores(input: LessonScoreInput): Record<SectionKey, number | null> {
  const grammar = grammarSectionScore(input);
  const round = (v: unknown) => {
    const n = num(v);
    return n == null ? null : Math.round(n);
  };
  return {
    grammar: grammar == null ? null : Math.round(grammar),
    vocabulary: round(input.vocabularyPercent),
    // Reading 2026-10-30 dan ilova ichida (`lessonN:reading:exM`); eski teacher kiritgan readingda — lesson_progress
    reading: round(staticSectionScore(input, 'reading') ?? input.readingScore),
    listening: round(staticSectionScore(input, 'listening') ?? input.listeningScore),
    quiz: round(input.quizScore),
    speaking: round(input.speakingScore),
  };
}

/** Dars balli = bo'lim kartalari o'rtachasi (0–100, butun) yoki `null` — hech narsa ishlanmagan */
export function computeLessonScore(input: LessonScoreInput): number | null {
  const parts = Object.values(sectionScores(input)).filter((v): v is number => v != null);
  return parts.length ? Math.round(mean(parts)) : null;
}

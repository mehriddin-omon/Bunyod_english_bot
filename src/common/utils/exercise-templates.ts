/**
 * «Test qoliblari» (2026-11) — 9 ta mashq qolipi uchun YAGONA ma'lumot formati va baholash.
 *
 * Qolip = `exercises.exercise_type` + `exercises.settings` (`{ v: 1, ... }`).
 * `settings` null bo'lsa — eski (qolipdan oldingi) format, eski qoidalar bilan baholanadi.
 * Bitta element (`exercise_items`) = bitta savol raqami.
 *
 * | Qolip                 | exercise_type      | element                                            |
 * |-----------------------|--------------------|----------------------------------------------------|
 * | 1 Variant tanlash     | multiple_choice    | itemText=savol, options=[{text,isCorrect}]         |
 * | 2 Bo'sh joy to'ldirish| fill_in_blank      | itemText="... ____ ...", meta.gaps=[[javob,muqobil]]|
 * | 3 So'z banki          | word_bank          | fill_in_blank kabi; settings.words                 |
 * | 4 Moslashtirish       | matching           | itemText=element, correctAnswer=variant kaliti     |
 * | 5 Rasmda belgilash    | map_labelling      | itemText=joy nomi, correctAnswer=harf              |
 * | 6 To'g'ri/Noto'g'ri   | true_false         | correctAnswer=true|false|not_given, meta.fixes     |
 * | 7 Gap tuzish          | sentence_order     | itemText="a / b / c", correctAnswer="a b c"        |
 * | 8 Tarjima             | translation        | itemText=o'zbekcha, correctAnswer=namuna, meta.alts|
 * | 9 Xatoni tuzating     | error_correction   | itemText=xatoli gap, correctAnswer=to'g'ri gap     |
 *
 * Mobil ilova (`ilova/src/components/exercises/grading.ts`) va veb
 * (`frontend/src/components/teacher/exercises/grading.ts`) shu faylning nusxasini ishlatadi —
 * o'zgartirilsa uchalasi birga yangilanadi.
 */

export const GAP_TOKEN = '____';
export const NO_ERROR_ANSWER = '__no_error__';

export interface ExerciseSettings {
  v: 1;
  /** Grammar blokidagi mashq: grammatika kartalari orasida qaysi kartadan keyin chiqadi (0 = boshida, null = oxirida) */
  afterPage?: number | null;
  /** multiple_choice: variantlar soni (3 = A–C, 4 = A–D) */
  letters?: 3 | 4;
  /** multiple_choice: savol matni ko'rsatiladimi (Listening P1 da faqat javoblar) */
  showStem?: boolean;
  /** fill_in_blank: alohida gaplar / yaxlit matn / forma */
  layout?: 'sentences' | 'text' | 'form';
  /** fill_in_blank: so'z chegarasi */
  wordLimit?: 'none' | 'one' | 'one_num' | 'two';
  /** fill_in_blank (forma): forma sarlavhasi */
  formTitle?: string;
  /** fill_in_blank (matn): oxirgi bo'sh joydan keyingi matn */
  tail?: string;
  /** word_bank: so'zlar */
  words?: string[];
  /** word_bank / matching: so'z (variant) qayta ishlatiladimi */
  reuse?: boolean;
  /** word_bank: aynan so'z yoki o'zgartirib yoziladi (wear → wears) */
  answerForm?: 'exact' | 'transform';
  /** matching: variantlar (kalit — A, B... yoki so'zning o'zi) */
  choices?: { key: string; text: string }[];
  /** matching: variant belgisi */
  labelStyle?: 'letter' | 'word';
  /** map_labelling: rasm va undagi nuqtalar (x, y — 0..1 ulush) */
  imageUrl?: string | null;
  pins?: { key: string; x: number; y: number }[];
  /** true_false: rejim */
  mode?: 'tf' | 'tfng' | 'tf_fix';
  /** translation: avtomatik (namunalar bo'yicha) yoki teacher qo'lda */
  grading?: 'auto' | 'manual';
  /** Topshiriq matni (word_bank da instructions so'zlar ro'yxati bo'lgani uchun) */
  prompt?: string;
}

export interface ItemMeta {
  /** fill_in_blank / word_bank: har bo'sh joy uchun to'g'ri javoblar (muqobillar bilan) */
  gaps?: string[][];
  /** forma qatori yorlig'i (Running times:) */
  label?: string;
  /** variant tanlash guruhi (Extract One) */
  group?: string;
  /** namuna qatori — javobi ko'rsatiladi, baholanmaydi */
  example?: boolean;
  /** muqobil to'g'ri javoblar (translation, sentence_order, error_correction) */
  alts?: string[];
  /** error_correction: gapda xato yo'q */
  noError?: boolean;
  /** true_false (tf_fix): noto'g'ri gapning tuzatilgan shakllari */
  fixes?: string[];
}

export const isTemplateSettings = (s: unknown): s is ExerciseSettings =>
  !!s && typeof s === 'object' && (s as { v?: unknown }).v === 1;

/** Javoblarni solishtirish uchun normalizatsiya (eski baholash bilan bir xil) */
export const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[.?!]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[’ʼ‘`]/g, "'");
export const eq = (a?: string | null, b?: string | null) => norm(a ?? '') === norm(b ?? '');

/** Gap va tuzatishlar uchun: oxiridagi tinish belgisi va bosh harf farqi hisobga olinmaydi */
const normSentence = (s: string) => norm(s).replace(/[,;:]/g, '').replace(/\s+/g, ' ');
const eqSentence = (a?: string | null, b?: string | null) => normSentence(a ?? '') === normSentence(b ?? '');

const parseJson = <T>(s: string): T | null => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

/** Bo'sh joy(lar) javobi: '["goes","went"]' yoki oddiy satr (bitta bo'sh joy) */
export function parseGapAnswer(ans: string): string[] {
  const t = (ans ?? '').trim();
  if (t.startsWith('[')) {
    const arr = parseJson<unknown[]>(t);
    if (Array.isArray(arr)) return arr.map((x) => (x == null ? '' : String(x)));
  }
  return [ans ?? ''];
}

/** Elementning bo'sh joylari javoblari: meta.gaps, bo'lmasa correctAnswer ('|' — muqobil) */
export function gapAnswersOf(itemText: string, correctAnswer: string, meta?: ItemMeta | null): string[][] {
  if (meta?.gaps?.length) return meta.gaps.map((g) => (g ?? []).filter((x) => x != null));
  const count = Math.max(1, (itemText.match(/_{3,}/g) ?? []).length);
  if (count === 1) return [String(correctAnswer ?? '').split('|')];
  // Eski format: bir nechta bo'sh joy javobi «/» yoki «,» bilan
  const parts = String(correctAnswer ?? '').split(/\s*[/;]\s*/);
  return Array.from({ length: count }, (_, i) => (parts[i] ?? '').split('|'));
}

export interface GradableItem {
  itemText: string;
  correctAnswer: string;
  options?: unknown[] | null;
  meta?: ItemMeta | null;
}

/** Element ballga kiradimi (namuna qatorlari va qo'lda tekshiriladigan tarjima — yo'q) */
export function isScoredItem(type: string, settings: ExerciseSettings | null | undefined, item: GradableItem): boolean {
  if (item.meta?.example) return false;
  if (type === 'translation') return !!settings && settings.grading === 'auto';
  return true;
}

/**
 * Yangi qolip formatidagi elementni baholaydi. Eski formatdagi mashqlar uchun
 * chaqirilmaydi (StudentAnswersService eski qoidani ishlatadi).
 */
export function gradeTemplateItem(
  type: string,
  settings: ExerciseSettings,
  item: GradableItem,
  ans: string | undefined | null,
): boolean {
  if (ans == null || String(ans).trim() === '') return false;
  const meta = item.meta ?? {};

  switch (type) {
    case 'multiple_choice': {
      const options = (item.options ?? []) as ({ text?: string; isCorrect?: boolean } | string)[];
      const correct = options.find((o) => typeof o !== 'string' && o.isCorrect) as { text?: string } | undefined;
      // Javob — variant matni yoki harfi (A, B, C...)
      const idx = /^[A-Za-z]$/.test(ans.trim()) ? ans.trim().toUpperCase().charCodeAt(0) - 65 : -1;
      if (idx >= 0 && idx < options.length) {
        const o = options[idx];
        return typeof o !== 'string' && !!o.isCorrect;
      }
      return eq(ans, correct?.text ?? item.correctAnswer);
    }

    case 'fill_in_blank':
    case 'word_bank': {
      const expected = gapAnswersOf(item.itemText, item.correctAnswer, meta);
      const given = parseGapAnswer(ans);
      if (given.length < expected.length) return false;
      return expected.every((alts, i) => alts.some((a) => eq(given[i], a)));
    }

    case 'matching':
    case 'map_labelling':
      return eq(ans, item.correctAnswer);

    case 'true_false': {
      let v = ans;
      let fix = '';
      if (ans.trim().startsWith('{')) {
        const o = parseJson<{ v?: string; fix?: string }>(ans);
        v = o?.v ?? '';
        fix = o?.fix ?? '';
      }
      const want = norm(item.correctAnswer).replace(/\s+/g, '_');
      const got = norm(v).replace(/\s+/g, '_');
      if (got !== want) return false;
      if (settings.mode === 'tf_fix' && want === 'false') {
        const fixes = [...(meta.fixes ?? []), ...((item.options ?? []).filter((o) => typeof o === 'string') as string[])]
          .map((f) => f.trim())
          .filter(Boolean);
        // Tuzatish kiritilmagan bo'lsa (teacher bermagan) — faqat False yetarli
        if (!fixes.length) return true;
        if (!fix.trim()) return false;
        // To'liq gap yoki faqat o'zgargan qism — ikkalasi ham qabul qilinadi
        return fixes.some((f) => eqSentence(fix, f) || normSentence(fix).includes(normSentence(f)));
      }
      return true;
    }

    case 'sentence_order':
    case 'translation': {
      const wants = [item.correctAnswer, ...(meta.alts ?? [])].filter(Boolean);
      return wants.some((w) => eqSentence(ans, w));
    }

    case 'error_correction': {
      if (meta.noError) return ans === NO_ERROR_ANSWER || eqSentence(ans, item.itemText);
      if (ans === NO_ERROR_ANSWER) return false;
      const wants = [item.correctAnswer, ...(meta.alts ?? [])].filter(Boolean);
      return wants.some((w) => eqSentence(ans, w));
    }

    default:
      return eq(ans, item.correctAnswer);
  }
}

/** Gap tuzish: bo'laklar (itemText «/» bilan) */
export const splitChunks = (s: string) =>
  (s ?? '')
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);

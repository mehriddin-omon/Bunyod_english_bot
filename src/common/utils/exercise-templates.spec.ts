import { gradeTemplateItem, gapAnswersOf, isScoredItem, NO_ERROR_ANSWER, ExerciseSettings } from './exercise-templates';

const S: ExerciseSettings = { v: 1 };
const g = (type: string, item: any, ans: string, settings: ExerciseSettings = S) =>
  gradeTemplateItem(type, settings, { options: null, meta: null, ...item }, ans);

describe('exercise-templates: baholash', () => {
  it('1 Variant tanlash — matn yoki harf bilan', () => {
    const item = {
      itemText: 'What is the relationship?',
      correctAnswer: 'workman and customer',
      options: [
        { text: 'art teacher and pupil', isCorrect: false },
        { text: 'workman and customer', isCorrect: true },
        { text: 'architect and designer', isCorrect: false },
      ],
    };
    expect(g('multiple_choice', item, 'workman and customer')).toBe(true);
    expect(g('multiple_choice', item, 'B')).toBe(true);
    expect(g('multiple_choice', item, 'A')).toBe(false);
    expect(g('multiple_choice', item, '')).toBe(false);
  });

  it("2 Bo'sh joy — muqobillar, bir nechta bo'sh joy, katta-kichik harf", () => {
    const one = { itemText: 'from Monday to Saturday ____', correctAnswer: 'June 23', meta: { gaps: [['June 23', '23 June']] } };
    expect(g('fill_in_blank', one, '23 june')).toBe(true);
    expect(g('fill_in_blank', one, '["June 23"]')).toBe(true);
    expect(g('fill_in_blank', one, 'June 24')).toBe(false);
    const two = {
      itemText: 'Alice ____ (hurt) herself while she ____ (play) football.',
      correctAnswer: 'hurt',
      meta: { gaps: [['hurt'], ['was playing']] },
    };
    expect(g('fill_in_blank', two, '["hurt","was playing"]')).toBe(true);
    expect(g('fill_in_blank', two, '["hurt","played"]')).toBe(false);
    expect(g('fill_in_blank', two, 'hurt')).toBe(false);
  });

  it("2 Bo'sh joy — eski format (meta yo'q)", () => {
    expect(gapAnswersOf('Ali ____ a student.', 'is', null)).toEqual([['is']]);
    expect(g('fill_in_blank', { itemText: 'Ali ____ a student.', correctAnswer: 'is' }, 'IS')).toBe(true);
  });

  it("3 So'z banki", () => {
    const item = { itemText: 'He always ____ a suit to work.', correctAnswer: 'wears', meta: { gaps: [['wears']] } };
    expect(g('word_bank', item, 'wears')).toBe(true);
    expect(g('word_bank', item, 'wear')).toBe(false);
  });

  it('4 Moslashtirish va 5 Rasmda belgilash — kalit bilan', () => {
    expect(g('matching', { itemText: 'Speaker 1', correctAnswer: 'A' }, 'a')).toBe(true);
    expect(g('matching', { itemText: 'Sophie', correctAnswer: 'she' }, 'she')).toBe(true);
    expect(g('map_labelling', { itemText: 'School', correctAnswer: 'G' }, 'H')).toBe(false);
  });

  it("6 To'g'ri/Noto'g'ri — T/F, T/F/NG va tuzatish", () => {
    expect(g('true_false', { itemText: 'x', correctAnswer: 'true' }, 'true')).toBe(true);
    expect(g('true_false', { itemText: 'x', correctAnswer: 'not_given' }, 'not_given', { v: 1, mode: 'tfng' })).toBe(true);
    expect(g('true_false', { itemText: 'x', correctAnswer: 'false' }, 'not_given', { v: 1, mode: 'tfng' })).toBe(false);
    const fix = { itemText: 'The water boils. Can you turn it off?', correctAnswer: 'false', meta: { fixes: ['is boiling'] } };
    const mode: ExerciseSettings = { v: 1, mode: 'tf_fix' };
    expect(g('true_false', fix, JSON.stringify({ v: 'false', fix: 'is boiling' }), mode)).toBe(true);
    expect(g('true_false', fix, JSON.stringify({ v: 'false', fix: 'The water is boiling.' }), mode)).toBe(true);
    expect(g('true_false', fix, JSON.stringify({ v: 'false', fix: 'boils' }), mode)).toBe(false);
    expect(g('true_false', fix, JSON.stringify({ v: 'false', fix: '' }), mode)).toBe(false);
    expect(g('true_false', fix, 'false', mode)).toBe(false);
  });

  it('7 Gap tuzish — asosiy va muqobil tartib', () => {
    const item = {
      itemText: 'they / go / running / every morning',
      correctAnswer: 'they go running every morning',
      meta: { alts: ['every morning they go running'] },
    };
    expect(g('sentence_order', item, 'They go running every morning.')).toBe(true);
    expect(g('sentence_order', item, 'every morning they go running')).toBe(true);
    expect(g('sentence_order', item, 'go they running every morning')).toBe(false);
  });

  it('8 Tarjima — avtomatik rejimda ballga kiradi, qo\'lda — yo\'q', () => {
    const item = { itemText: 'Men har hafta Toshkentga boraman.', correctAnswer: 'I go to Tashkent every week.', meta: { alts: ['Every week I go to Tashkent.'] } };
    expect(g('translation', item, 'every week, I go to Tashkent')).toBe(true);
    expect(isScoredItem('translation', { v: 1, grading: 'auto' }, item)).toBe(true);
    expect(isScoredItem('translation', { v: 1, grading: 'manual' }, item)).toBe(false);
    expect(isScoredItem('fill_in_blank', S, { ...item, meta: { example: true } })).toBe(false);
  });

  it("9 Xatoni tuzating — xato bor / xato yo'q", () => {
    const wrong = { itemText: 'Lucy wash her hair every day.', correctAnswer: 'Lucy washes her hair every day.' };
    expect(g('error_correction', wrong, 'Lucy washes her hair every day')).toBe(true);
    expect(g('error_correction', wrong, NO_ERROR_ANSWER)).toBe(false);
    const ok = { itemText: 'I am visiting my grandparents these days.', correctAnswer: 'I am visiting my grandparents these days.', meta: { noError: true } };
    expect(g('error_correction', ok, NO_ERROR_ANSWER)).toBe(true);
    expect(g('error_correction', ok, 'I visit my grandparents these days.')).toBe(false);
  });
});

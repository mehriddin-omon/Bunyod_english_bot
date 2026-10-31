/**
 * NOTO'G'RI FE'LLAR — ilovadagi ro'yxatning nusxasi (ilova: src/content/irregularVerbs/verbs.ts, groups.ts).
 * Teacher panel (o'quvchi → mavzu → «Noto'g'ri fe'llar») hali ishlanmagan fe'llarni ham ko'rsatishi uchun kerak.
 * Ilovada fe'l / to'plam o'zgarsa — shu fayl ham yangilanadi.
 *
 * Natija kalitlari: `lessonN:verbs:exK` — K 1–24: to'plam = ceil(K/3), bosqich = (K−1)%3 + 2
 * (2 Tanlash · 3 Yozish · 4 Gapda); K = 25 — trenajyordagi takrorlash. Savol matni `q = "<V1> · …"`.
 */

export interface IrregularVerbInfo {
  id: number;
  v1: string;
  v2: string;
  v3: string;
  uz: string;
  set: number;
}

export const IRREGULAR_VERBS: IrregularVerbInfo[] = [
  { id: 1, v1: 'do', v2: 'did', v3: 'done', uz: 'qilmoq', set: 8 },
  { id: 2, v1: 'go', v2: 'went', v3: 'gone', uz: 'bormoq', set: 8 },
  { id: 3, v1: 'buy', v2: 'bought', v3: 'bought', uz: 'sotib olmoq', set: 1 },
  { id: 4, v1: 'think', v2: 'thought', v3: 'thought', uz: "o'ylamoq", set: 1 },
  { id: 5, v1: 'see', v2: 'saw', v3: 'seen', uz: "ko'rmoq", set: 8 },
  { id: 6, v1: 'be', v2: 'was / were', v3: 'been', uz: "bo'lmoq", set: 8 },
  { id: 7, v1: 'write', v2: 'wrote', v3: 'written', uz: 'yozmoq', set: 7 },
  { id: 8, v1: 'drive', v2: 'drove', v3: 'driven', uz: 'haydamoq (mashina)', set: 7 },
  { id: 9, v1: 'seek', v2: 'sought', v3: 'sought', uz: 'izlamoq', set: 1 },
  { id: 10, v1: 'catch', v2: 'caught', v3: 'caught', uz: 'tutib olmoq', set: 1 },
  { id: 11, v1: 'eat', v2: 'ate', v3: 'eaten', uz: 'yemoq', set: 7 },
  { id: 12, v1: 'beat', v2: 'beat', v3: 'beaten', uz: 'urmoq, yengmoq', set: 3 },
  { id: 13, v1: 'freeze', v2: 'froze', v3: 'frozen', uz: 'muzlamoq', set: 6 },
  { id: 14, v1: 'choose', v2: 'chose', v3: 'chosen', uz: 'tanlamoq', set: 6 },
  { id: 15, v1: 'grow', v2: 'grew', v3: 'grown', uz: "o'smoq, o'stirmoq", set: 5 },
  { id: 16, v1: 'know', v2: 'knew', v3: 'known', uz: 'bilmoq', set: 5 },
  { id: 17, v1: 'take', v2: 'took', v3: 'taken', uz: 'olmoq', set: 5 },
  { id: 18, v1: 'shake', v2: 'shook', v3: 'shaken', uz: 'silkitmoq', set: 5 },
  { id: 19, v1: 'say', v2: 'said', v3: 'said', uz: 'aytmoq', set: 1 },
  { id: 20, v1: 'read', v2: 'read', v3: 'read', uz: "o'qimoq (kitob)", set: 3 },
  { id: 21, v1: 'ring', v2: 'rang', v3: 'rung', uz: 'jiringlamoq', set: 4 },
  { id: 22, v1: 'sing', v2: 'sang', v3: 'sung', uz: 'kuylamoq', set: 4 },
  { id: 23, v1: 'teach', v2: 'taught', v3: 'taught', uz: "o'qitmoq, o'rgatmoq", set: 1 },
  { id: 24, v1: 'fight', v2: 'fought', v3: 'fought', uz: 'urishmoq', set: 1 },
  { id: 25, v1: 'win', v2: 'won', v3: 'won', uz: 'yutmoq', set: 7 },
  { id: 26, v1: 'become', v2: 'became', v3: 'become', uz: "bo'lmoq (aylanmoq)", set: 8 },
  { id: 27, v1: 'wake', v2: 'woke', v3: 'woken', uz: "uyg'onmoq", set: 6 },
  { id: 28, v1: 'speak', v2: 'spoke', v3: 'spoken', uz: 'gapirmoq', set: 6 },
  { id: 29, v1: 'drink', v2: 'drank', v3: 'drunk', uz: 'ichmoq', set: 4 },
  { id: 30, v1: 'shrink', v2: 'shrank', v3: 'shrunk', uz: 'kichraymoq', set: 4 },
  { id: 31, v1: 'give', v2: 'gave', v3: 'given', uz: 'bermoq', set: 7 },
  { id: 32, v1: 'ride', v2: 'rode', v3: 'ridden', uz: 'minmoq (velosiped, ot)', set: 7 },
  { id: 33, v1: 'pay', v2: 'paid', v3: 'paid', uz: "to'lamoq", set: 1 },
  { id: 34, v1: 'make', v2: 'made', v3: 'made', uz: 'yasamoq, qilmoq', set: 1 },
  { id: 35, v1: 'send', v2: 'sent', v3: 'sent', uz: "jo'natmoq", set: 3 },
  { id: 36, v1: 'bend', v2: 'bent', v3: 'bent', uz: 'egmoq, bukmoq', set: 3 },
  { id: 37, v1: 'creep', v2: 'crept', v3: 'crept', uz: 'emaklamoq, sekin yurmoq', set: 2 },
  { id: 38, v1: 'leap', v2: 'leapt', v3: 'leapt', uz: "sakrab o'tmoq", set: 2 },
  { id: 39, v1: 'begin', v2: 'began', v3: 'begun', uz: 'boshlamoq', set: 4 },
  { id: 40, v1: 'spin', v2: 'span', v3: 'spun', uz: 'aylantirmoq, aylanmoq', set: 4 },
  { id: 41, v1: 'keep', v2: 'kept', v3: 'kept', uz: 'saqlamoq', set: 2 },
  { id: 42, v1: 'sweep', v2: 'swept', v3: 'swept', uz: 'supurmoq', set: 2 },
  { id: 43, v1: 'leave', v2: 'left', v3: 'left', uz: 'tark etmoq, ketmoq', set: 2 },
  { id: 44, v1: 'sleep', v2: 'slept', v3: 'slept', uz: 'uxlamoq', set: 2 },
  { id: 45, v1: 'learn', v2: 'learnt', v3: 'learnt', uz: "o'rganmoq", set: 3 },
  { id: 46, v1: 'burn', v2: 'burnt', v3: 'burnt', uz: 'kuydirmoq', set: 3 },
  { id: 47, v1: 'deal', v2: 'dealt', v3: 'dealt', uz: 'tarqatmoq (karta)', set: 2 },
  { id: 48, v1: 'kneel', v2: 'knelt', v3: 'knelt', uz: "tiz cho'kmoq", set: 2 },
  { id: 49, v1: 'sit', v2: 'sat', v3: 'sat', uz: "o'tirmoq", set: 4 },
  { id: 50, v1: 'spit', v2: 'spat', v3: 'spat', uz: 'tupurmoq', set: 4 },
  { id: 51, v1: 'steal', v2: 'stole', v3: 'stolen', uz: "o'g'irlamoq", set: 6 },
  { id: 52, v1: 'break', v2: 'broke', v3: 'broken', uz: 'sindirmoq', set: 6 },
  { id: 53, v1: 'swim', v2: 'swam', v3: 'swum', uz: 'suzmoq', set: 4 },
  { id: 54, v1: 'sting', v2: 'stung', v3: 'stung', uz: 'chaqmoq (ari)', set: 5 },
  { id: 55, v1: 'come', v2: 'came', v3: 'come', uz: 'kelmoq', set: 8 },
  { id: 56, v1: 'spring', v2: 'sprang', v3: 'sprung', uz: 'sakramoq, otilib chiqmoq', set: 4 },
  { id: 57, v1: 'wear', v2: 'wore', v3: 'worn', uz: 'kiymoq', set: 6 },
  { id: 58, v1: 'tear', v2: 'tore', v3: 'torn', uz: 'yirtmoq', set: 6 },
  { id: 59, v1: 'throw', v2: 'threw', v3: 'thrown', uz: 'uloqtirmoq, otmoq', set: 5 },
  { id: 60, v1: 'sew', v2: 'sewed', v3: 'sewn', uz: 'tikmoq', set: 8 },
  { id: 61, v1: 'hide', v2: 'hid', v3: 'hidden', uz: 'yashirinmoq, yashirmoq', set: 7 },
  { id: 62, v1: 'forgive', v2: 'forgave', v3: 'forgiven', uz: 'kechirmoq', set: 7 },
  { id: 63, v1: 'feel', v2: 'felt', v3: 'felt', uz: 'his qilmoq', set: 2 },
  { id: 64, v1: 'spell', v2: 'spelt', v3: 'spelt', uz: 'harflab aytmoq', set: 3 },
  { id: 65, v1: 'stick', v2: 'stuck', v3: 'stuck', uz: 'yopishtirmoq', set: 5 },
  { id: 66, v1: 'strike', v2: 'struck', v3: 'struck', uz: 'urmoq; ish tashlamoq', set: 5 },
  { id: 67, v1: 'forget', v2: 'forgot', v3: 'forgotten', uz: 'unutmoq', set: 6 },
  { id: 68, v1: 'tread', v2: 'trod', v3: 'trodden', uz: 'bosmoq (oyoq bilan)', set: 6 },
  { id: 69, v1: 'sell', v2: 'sold', v3: 'sold', uz: 'sotmoq', set: 1 },
  { id: 70, v1: 'tell', v2: 'told', v3: 'told', uz: 'aytmoq, aytib bermoq', set: 1 },
  { id: 71, v1: 'rise', v2: 'rose', v3: 'risen', uz: "ko'tarilmoq", set: 7 },
  { id: 72, v1: 'bite', v2: 'bit', v3: 'bitten', uz: 'tishlamoq', set: 7 },
  { id: 73, v1: 'feed', v2: 'fed', v3: 'fed', uz: 'boqmoq, ovqatlantirmoq', set: 3 },
  { id: 74, v1: 'flee', v2: 'fled', v3: 'fled', uz: 'qochmoq', set: 3 },
  { id: 75, v1: 'blow', v2: 'blew', v3: 'blown', uz: 'puflamoq', set: 5 },
  { id: 76, v1: 'fly', v2: 'flew', v3: 'flown', uz: 'uchmoq', set: 5 },
  { id: 77, v1: 'meet', v2: 'met', v3: 'met', uz: 'uchrashmoq, tanishmoq', set: 3 },
  { id: 78, v1: 'weep', v2: 'wept', v3: 'wept', uz: "yig'lamoq", set: 2 },
  { id: 79, v1: 'lose', v2: 'lost', v3: 'lost', uz: "yo'qotmoq", set: 3 },
  { id: 80, v1: 'get', v2: 'got', v3: 'got', uz: "olmoq, ega bo'lmoq", set: 8 },
];

export const VERB_SET_TITLES: Record<number, string> = {
  1: '-ought, -aid, -old',
  2: 'keep → kept',
  3: 'send → sent, feed → fed',
  4: 'i → a',
  5: '-ew, -ook, st-u',
  6: '… → o',
  7: 'i → o, … → a',
  8: "come, be, go — o'ziga xoslar",
};

export const VERB_STAGE_TITLES: Record<number, string> = { 1: 'Karta', 2: 'Tanlash', 3: 'Yozish', 4: 'Gapda ishlatish' };

export const VERB_REVIEW_EX = 25;

/** Bo'lim shu grammatika sahifasi ulangan darsda (ilova: VERBS_GRAMMAR_PAGE) */
export const VERBS_GRAMMAR_PAGE = 'lesson4.tsx';

/** `lesson4:verbs:ex7` → { set: 3, stage: 2 } ; ex25 → { review: true } ; boshqasi → null */
export function parseVerbKey(key: string): { set: number; stage: number } | { review: true } | null {
  const [, section, ex] = key.split(':');
  if (section !== 'verbs') return null;
  const k = Number(ex?.replace(/^ex/, ''));
  if (!Number.isFinite(k) || k < 1) return null;
  if (k === VERB_REVIEW_EX) return { review: true };
  if (k > 24) return null;
  return { set: Math.ceil(k / 3), stage: ((k - 1) % 3) + 2 };
}

/** Savol matnidan fe'l: «teach · tanlash» → «teach» */
export function verbOfQuestion(q: string): string {
  return String(q ?? '').split(' · ')[0].trim().toLowerCase();
}

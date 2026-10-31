/**
 * Toshkent vaqti bilan sana/vaqt matnlari (bildirishnomalar uchun, 2026-11).
 * Server qaysi vaqt zonasida ishlashidan qat'i nazar to'g'ri chiqadi.
 */
const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function tashkentParts(d: Date) {
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour,
    minute: parts.minute,
    weekday: WD[parts.weekday] ?? 0,
  };
}

/** "18:00" */
export function tashkentTime(d: Date): string {
  const p = tashkentParts(d);
  return `${p.hour}:${p.minute}`;
}

/** "Bugun" | "Ertaga" | "27-oktabr" */
export function tashkentDayLabel(d: Date, now = new Date()): string {
  const a = tashkentParts(d);
  const b = tashkentParts(now);
  const t = new Date(Date.UTC(b.year, b.month - 1, b.day));
  const x = new Date(Date.UTC(a.year, a.month - 1, a.day));
  const diff = Math.round((x.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Ertaga';
  if (diff === -1) return 'Kecha';
  return `${a.day}-${MONTHS[a.month - 1]}`;
}

/** "27-oktabr, seshanba" */
export function tashkentDateLong(d: Date): string {
  const p = tashkentParts(d);
  return `${p.day}-${MONTHS[p.month - 1]}, ${WEEKDAYS[p.weekday].toLowerCase()}`;
}

/** "Ertaga, 18:00" */
export function tashkentWhen(d: Date, now = new Date()): string {
  return `${tashkentDayLabel(d, now)}, ${tashkentTime(d)}`;
}

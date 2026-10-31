import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

/**
 * «OXIRGI FAOLLIK» — foydalanuvchi oxirgi marta qachon onlayn bo'lgani.
 *
 * - `users.last_seen_at` — har avtorizatsiyali HTTP so'rovda (GuardService) yangilanadi, lekin bazaga
 *   bir foydalanuvchi uchun daqiqasiga ko'pi bilan 1 marta yoziladi (xotiradagi throttle).
 * - Chat socket ulanganda va uzilganda `force` bilan yoziladi — ilova yopilgan payt aniq qoladi.
 * - Hozir onlayn — `isUserOnline` (ilova ochiq, socket ulangan) yoki oxirgi 2 daqiqada so'rov bo'lgan.
 *
 * Backend BITTA jarayonda ishlaydi (CLAUDE.md), shuning uchun xotiradagi holat yetarli.
 */

const WRITE_EVERY_MS = 60_000;
const ONLINE_WINDOW_MS = 2 * 60_000;
const lastWrite = new Map<string, number>();
/** oxirgi avtorizatsiyali so'rov vaqti (har so'rovda, bazaga yozilmaydi) */
const lastHit = new Map<string, number>();
const sockets = new Map<string, number>();
const logger = new Logger('LastSeen');

export function touchLastSeen(ds: DataSource, userId: string | undefined, force = false): void {
  if (!userId) return;
  const now = Date.now();
  lastHit.set(userId, now);
  const prev = lastWrite.get(userId) ?? 0;
  if (!force && now - prev < WRITE_EVERY_MS) return;
  lastWrite.set(userId, now);
  ds.query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [userId]).catch((e: Error) =>
    logger.warn(`last_seen_at yozilmadi: ${e.message}`),
  );
}

/** Chat socket ulandi; birinchi ulanish bo'lsa true */
export function presenceAdd(userId: string): boolean {
  const n = (sockets.get(userId) ?? 0) + 1;
  sockets.set(userId, n);
  return n === 1;
}

/** Chat socket uzildi; oxirgisi bo'lsa true */
export function presenceRemove(userId: string): boolean {
  const n = (sockets.get(userId) ?? 0) - 1;
  if (n <= 0) {
    sockets.delete(userId);
    return true;
  }
  sockets.set(userId, n);
  return false;
}

/** Chat socket ulanganmi (ilova ochiq). Push'ni bostirish shunga qaraydi — 2 daqiqalik oyna emas */
export function isSocketConnected(userId: string): boolean {
  return (sockets.get(userId) ?? 0) > 0;
}

/** Hozir onlayn: ilova ochiq (socket ulangan) yoki oxirgi 2 daqiqada so'rov yuborgan */
export function isUserOnline(userId: string): boolean {
  if (isSocketConnected(userId)) return true;
  const h = lastHit.get(userId);
  return h != null && Date.now() - h < ONLINE_WINDOW_MS;
}

/** Bir nechta manbadan eng so'nggi vaqt (null va yaroqsizlar tashlanadi) */
export function latestOf(...values: Array<Date | string | null | undefined>): Date | null {
  let best: number | null = null;
  for (const v of values) {
    if (v == null) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t) && (best == null || t > best)) best = t;
  }
  return best == null ? null : new Date(best);
}

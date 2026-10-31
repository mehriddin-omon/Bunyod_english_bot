import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushToken } from 'src/common/core/entitys/push-token.entity';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
/** Expo bir so'rovda ko'pi bilan 100 ta xabar qabul qiladi */
const CHUNK = 100;

/** Android kanallari — ilovadagi `src/notifications/channels.ts` bilan BIR XIL */
export type PushChannel = 'teacher' | 'lessons' | 'chat' | 'default';

export interface PushMessage {
  /** kimga */
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: PushChannel;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Expo Push Service orqali push yuborish (2026-11).
 * SDK ishlatilmaydi — oddiy `fetch`. `EXPO_ACCESS_TOKEN` berilsa (Expo → Access tokens,
 * «Enhanced security for push» yoqilgan bo'lsa) Authorization sarlavhasi qo'shiladi.
 *
 * Push yetmasa ham xato otilmaydi — xabar `notifications` jadvalida turadi,
 * o'quvchi ilovani ochganda ko'radi.
 */
@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  /** ticket id → token (receipt'da DeviceNotRegistered bo'lsa token o'chiriladi) */
  private readonly pendingReceipts = new Map<string, { token: string; at: number }>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(PushToken)
    private readonly tokenRepo: Repository<PushToken>,
  ) {}

  onModuleInit() {
    // Receipt'larni 15 daqiqada bir tekshiramiz (Expo ularni ~30 daqiqada tayyorlaydi)
    this.timer = setInterval(() => void this.checkReceipts().catch(() => {}), 15 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Token qo'shish/yangilash. Token boshqa userda bo'lsa — egasi almashadi. */
  async registerToken(userId: string, token: string, platform = 'android', appBuild?: number | null) {
    const clean = token.trim();
    const existing = await this.tokenRepo.findOne({ where: { token: clean } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      existing.appBuild = appBuild ?? existing.appBuild ?? null;
      existing.isActive = true;
      existing.lastSeenAt = new Date();
      await this.tokenRepo.save(existing);
      return { registered: true };
    }
    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId,
        token: clean,
        platform,
        appBuild: appBuild ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      }),
    );
    return { registered: true };
  }

  async removeToken(userId: string, token: string) {
    await this.tokenRepo.delete({ userId, token: token.trim() });
    return { removed: true };
  }

  /** Foydalanuvchida faol token bormi — ro'yxatlar uchun */
  async usersWithTokens(userIds: string[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    const rows = await this.tokenRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.userId', 'userId')
      .where('t.userId IN (:...ids)', { ids: userIds })
      .andWhere('t.isActive = true')
      .getRawMany<{ userId: string }>();
    return new Set(rows.map((r) => r.userId));
  }

  /**
   * Har bir foydalanuvchiga o'z xabari (data'da notificationId har xil bo'ladi).
   * Qaytaradi: push muvaffaqiyatli qabul qilingan userlar to'plami.
   */
  async send(messages: PushMessage[]): Promise<Set<string>> {
    const delivered = new Set<string>();
    if (!messages.length) return delivered;

    const userIds = [...new Set(messages.map((m) => m.userId))];
    const tokens = await this.tokenRepo.find({ where: { userId: In(userIds), isActive: true } });
    if (!tokens.length) return delivered;

    const byUser = new Map<string, PushToken[]>();
    for (const t of tokens) {
      const list = byUser.get(t.userId) ?? [];
      list.push(t);
      byUser.set(t.userId, list);
    }

    const outgoing: { userId: string; token: string; payload: Record<string, unknown> }[] = [];
    for (const m of messages) {
      for (const t of byUser.get(m.userId) ?? []) {
        if (!isExpoToken(t.token)) continue;
        outgoing.push({
          userId: m.userId,
          token: t.token,
          payload: {
            to: t.token,
            title: m.title,
            body: m.body,
            data: m.data ?? {},
            sound: 'default',
            priority: 'high',
            channelId: m.channelId ?? 'default',
          },
        });
      }
    }

    for (let i = 0; i < outgoing.length; i += CHUNK) {
      const chunk = outgoing.slice(i, i + CHUNK);
      try {
        const tickets = await this.postToExpo(chunk.map((c) => c.payload));
        tickets.forEach((ticket, idx) => {
          const item = chunk[idx];
          if (!item) return;
          if (ticket.status === 'ok') {
            delivered.add(item.userId);
            if (ticket.id) this.pendingReceipts.set(ticket.id, { token: item.token, at: Date.now() });
          } else if (ticket.details?.error === 'DeviceNotRegistered') {
            void this.deactivate(item.token);
          } else {
            this.logger.warn(`Push xatosi: ${ticket.message ?? ticket.details?.error ?? 'noma\'lum'}`);
          }
        });
      } catch (err) {
        this.logger.error(`Expo push so'rovi muvaffaqiyatsiz: ${(err as Error).message}`);
      }
    }
    return delivered;
  }

  private async postToExpo(payloads: Record<string, unknown>[]): Promise<ExpoTicket[]> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(EXPO_SEND_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloads),
      signal: AbortSignal.timeout(15000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json?.errors ?? json).slice(0, 300)}`);
    }
    return Array.isArray(json?.data) ? json.data : [];
  }

  private async checkReceipts() {
    // 2 soatdan eski yozuvlar tashlab yuboriladi
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, v] of this.pendingReceipts) if (v.at < cutoff) this.pendingReceipts.delete(id);

    const ids = [...this.pendingReceipts.keys()].filter(
      (id) => (this.pendingReceipts.get(id)?.at ?? 0) < Date.now() - 10 * 60 * 1000,
    );
    for (let i = 0; i < ids.length; i += 300) {
      const chunk = ids.slice(i, i + 300);
      const res = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids: chunk }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      const json: any = res ? await res.json().catch(() => null) : null;
      const data = json?.data ?? {};
      for (const id of chunk) {
        const receipt = data[id];
        const entry = this.pendingReceipts.get(id);
        if (receipt?.status === 'error' && receipt?.details?.error === 'DeviceNotRegistered' && entry) {
          await this.deactivate(entry.token);
        }
        if (receipt) this.pendingReceipts.delete(id);
      }
    }
  }

  private async deactivate(token: string) {
    await this.tokenRepo.update({ token }, { isActive: false }).catch(() => {});
  }
}

export function isExpoToken(token: string): boolean {
  return /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token) || /^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i.test(token);
}

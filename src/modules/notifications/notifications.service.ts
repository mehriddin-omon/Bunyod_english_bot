import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Notification } from 'src/common/core/entitys/notification.entity';
import { NotificationPreference } from 'src/common/core/entitys/notification-preference.entity';
import type { NotificationAction } from 'src/common/core/entitys/notification-broadcast.entity';
import { NotificationType } from 'src/common/utils/enum';
import { PushChannel, PushService } from '../push/push.service';
import { UpdatePreferencesDto } from './dto/notifications.dto';

export type PreferenceKey = 'teacherMessages' | 'onlineLessons' | 'groupChat';

export interface NotifyPayload {
  type: NotificationType;
  title: string;
  body?: string | null;
  action?: NotificationAction | null;
  senderId?: string | null;
  broadcastId?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  /** Android kanali (ilovada foydalanuvchi alohida o'chira oladi) */
  channel?: PushChannel;
  /** Qaysi sozlama bu push'ni o'chira oladi (o'chirilgan bo'lsa ham ro'yxatga yoziladi) */
  preference?: PreferenceKey | null;
  /** false — faqat push, `notifications` ro'yxatiga yozilmaydi (masalan chat xabari) */
  store?: boolean;
  /** false — faqat ro'yxatga, push yuborilmaydi */
  push?: boolean;
  /** Push'da boshqacha sarlavha/matn kerak bo'lsa */
  pushTitle?: string;
  pushBody?: string;
  /** Push `data` ga qo'shimcha maydonlar */
  data?: Record<string, unknown>;
}

const DEFAULT_PREFS = {
  teacherMessages: true,
  onlineLessons: true,
  groupChat: true,
  chatMutedUntil: null as Date | null,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
    private readonly push: PushService,
    private readonly ds: DataSource,
  ) {}

  // ── O'quvchi ro'yxati ────────────────────────────────────────────────────

  async getNotifications(userId: string) {
    const [rows, countRows] = await Promise.all([
      this.ds.query(
        `SELECT n.id, n.title, n.body, n.type, n.is_read, n.created_at, n.action, n.opened_at,
                s.id AS sender_id, s.first_name AS sender_first_name, s.last_name AS sender_last_name,
                s.role AS sender_role, s.avatar_url AS sender_avatar_url
           FROM notifications n
           LEFT JOIN users s ON s.id = n.sender_id
          WHERE n.user_id = $1
          ORDER BY n.created_at DESC
          LIMIT 100`,
        [userId],
      ),
      this.ds.query(`SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = false`, [userId]),
    ]);

    return {
      unreadCount: Number(countRows?.[0]?.c ?? 0),
      notifications: (rows as any[]).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        isRead: n.is_read,
        createdAt: n.created_at,
        action: n.action ?? null,
        openedAt: n.opened_at ?? null,
        sender: n.sender_id
          ? {
              id: n.sender_id,
              firstName: n.sender_first_name,
              lastName: n.sender_last_name,
              role: n.sender_role,
              avatarUrl: n.sender_avatar_url ?? null,
            }
          : null,
      })),
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.notificationRepo.update({ id: notificationId, userId }, { isRead: true });
    return { message: "O'qildi deb belgilandi" };
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
    return { message: "Barcha bildirishnomalar o'qildi" };
  }

  /** Push yoki karta bosib ochildi — statistika uchun («Bosib ochdi») */
  async markOpened(notificationId: string, userId: string) {
    const n = await this.notificationRepo.findOne({ where: { id: notificationId, userId } });
    if (!n) throw new NotFoundException('Bildirishnoma topilmadi');
    if (!n.openedAt || !n.isRead) {
      await this.notificationRepo.update({ id: n.id }, { isRead: true, openedAt: n.openedAt ?? new Date() });
    }
    return { opened: true };
  }

  // ── Sozlamalar ───────────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    const p = await this.prefRepo.findOne({ where: { userId } });
    return this.formatPrefs(p);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    let p = await this.prefRepo.findOne({ where: { userId } });
    if (!p) p = this.prefRepo.create({ userId, ...DEFAULT_PREFS });
    if (dto.teacherMessages !== undefined) p.teacherMessages = dto.teacherMessages;
    if (dto.onlineLessons !== undefined) p.onlineLessons = dto.onlineLessons;
    if (dto.groupChat !== undefined) p.groupChat = dto.groupChat;
    if (dto.chatMutedUntil !== undefined) p.chatMutedUntil = dto.chatMutedUntil ? new Date(dto.chatMutedUntil) : null;
    await this.prefRepo.save(p);
    return this.formatPrefs(p);
  }

  private formatPrefs(p: NotificationPreference | null) {
    return {
      teacherMessages: p?.teacherMessages ?? true,
      onlineLessons: p?.onlineLessons ?? true,
      groupChat: p?.groupChat ?? true,
      chatMutedUntil: p?.chatMutedUntil && p.chatMutedUntil > new Date() ? p.chatMutedUntil : null,
    };
  }

  /** Push'ni o'chirib qo'yganlar (sozlama yoki chat ovozsiz) */
  async mutedUsers(userIds: string[], preference: PreferenceKey): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    const prefs = await this.prefRepo.find({ where: { userId: In(userIds) } });
    const now = new Date();
    const muted = new Set<string>();
    for (const p of prefs) {
      if (p[preference] === false) muted.add(p.userId);
      if (preference === 'groupChat' && p.chatMutedUntil && p.chatMutedUntil > now) muted.add(p.userId);
    }
    return muted;
  }

  // ── Yagona yuborish nuqtasi ──────────────────────────────────────────────

  /**
   * Bildirishnoma yaratish + push. Barcha modullar (guruh, topshiriq, teacher xabari,
   * onlayn dars, chat) SHU funksiyani chaqiradi.
   */
  async notify(userIds: string[], p: NotifyPayload): Promise<{ recipientCount: number; pushCount: number }> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return { recipientCount: 0, pushCount: 0 };

    const store = p.store !== false;
    const notifIdByUser = new Map<string, string>();

    if (store) {
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const result = await this.notificationRepo
          .createQueryBuilder()
          .insert()
          .into(Notification)
          .values(
            chunk.map((userId) => ({
              userId,
              type: p.type,
              title: p.title,
              body: p.body ?? '',
              senderId: p.senderId ?? null,
              broadcastId: p.broadcastId ?? null,
              action: p.action ?? null,
              referenceId: p.referenceId ?? null,
              referenceType: p.referenceType ?? null,
              pushStatus: 'none',
            })) as any,
          )
          .returning(['id', 'userId'])
          .execute();
        (result.raw as any[]).forEach((r) => notifIdByUser.set(r.user_id ?? r.userId, r.id));
      }
    }

    let pushCount = 0;
    if (p.push !== false) {
      const muted = p.preference ? await this.mutedUsers(ids, p.preference) : new Set<string>();
      const targets = ids.filter((id) => !muted.has(id));
      try {
        const delivered = await this.push.send(
          targets.map((userId) => ({
            userId,
            title: p.pushTitle ?? p.title,
            body: p.pushBody ?? p.body ?? '',
            channelId: p.channel ?? 'default',
            data: {
              ...(p.data ?? {}),
              type: p.type,
              notificationId: notifIdByUser.get(userId) ?? null,
              action: p.action ?? null,
            },
          })),
        );
        pushCount = delivered.size;
        if (store && delivered.size) {
          const notifIds = [...delivered].map((u) => notifIdByUser.get(u)).filter(Boolean) as string[];
          if (notifIds.length) await this.notificationRepo.update({ id: In(notifIds) }, { pushStatus: 'sent' });
        }
      } catch (err) {
        this.logger.error(`Push yuborilmadi: ${(err as Error).message}`);
      }
    }

    return { recipientCount: ids.length, pushCount };
  }

  /** Oldin yaratilgan bildirishnomalarni qayta push qilish (o'qimaganlarga) */
  async repush(notifications: { id: string; userId: string; title: string; body: string; action: any; type: string }[], channel: PushChannel) {
    const delivered = await this.push.send(
      notifications.map((n) => ({
        userId: n.userId,
        title: n.title,
        body: n.body,
        channelId: channel,
        data: { type: n.type, notificationId: n.id, action: n.action ?? null },
      })),
    );
    return delivered.size;
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AudienceSpec,
  BroadcastStatus,
  NotificationAction,
  NotificationBroadcast,
} from 'src/common/core/entitys/notification-broadcast.entity';
import { AudienceService, Requester } from 'src/common/services/audience.service';
import { NotificationType, Role } from 'src/common/utils/enum';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBroadcastDto, UpdateBroadcastDto } from './dto/broadcast.dto';

/** Teacher bir kunda ko'pi bilan shuncha ommaviy xabar yubora oladi (spam himoyasi) */
export const DAILY_BROADCAST_LIMIT = 10;
const ADMIN_ROLES: string[] = [Role.admin, Role.superAdmin];

@Injectable()
export class BroadcastsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastsService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    @InjectRepository(NotificationBroadcast)
    private readonly repo: Repository<NotificationBroadcast>,
    private readonly audience: AudienceService,
    private readonly notifications: NotificationsService,
    private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    // Rejalashtirilgan xabarlar — har daqiqada tekshiriladi (server bitta PM2 jarayonida)
    this.timer = setInterval(() => void this.tick(), 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── Yaratish / o'zgartirish ──────────────────────────────────────────────

  async create(dto: CreateBroadcastDto, requester: Requester) {
    this.validateAction(dto.action);
    const status = this.decideStatus(dto.draft, dto.scheduledAt);
    if (status !== BroadcastStatus.draft) await this.assertDailyLimit(requester.sub);

    // Guruh huquqini va bo'sh ro'yxatni tekshiramiz (qoralama ham to'g'ri bo'lsin)
    const recipients = await this.audience.resolve(dto.audience, requester);
    if (status !== BroadcastStatus.draft && !recipients.length) {
      throw new BadRequestException("Tanlangan ro'yxatda qabul qiluvchi yo'q");
    }

    const b = await this.repo.save(
      this.repo.create({
        senderId: requester.sub,
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: this.cleanAudience(dto.audience),
        action: dto.action ? this.cleanAction(dto.action) : null,
        status,
        scheduledAt: status === BroadcastStatus.scheduled && dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        recipientCount: recipients.length,
      }),
    );

    if (status === BroadcastStatus.sending) setImmediate(() => void this.dispatch(b.id));
    return (await this.decorate([b]))[0];
  }

  async update(id: string, dto: UpdateBroadcastDto, requester: Requester) {
    const b = await this.findOwned(id, requester);
    if (b.status !== BroadcastStatus.draft && b.status !== BroadcastStatus.scheduled) {
      throw new BadRequestException("Yuborilgan xabarni o'zgartirib bo'lmaydi");
    }
    if (dto.action !== undefined) this.validateAction(dto.action);
    if (dto.title !== undefined) b.title = dto.title.trim();
    if (dto.body !== undefined) b.body = dto.body.trim();
    if (dto.audience !== undefined) b.audience = this.cleanAudience(dto.audience);
    if (dto.action !== undefined) b.action = dto.action ? this.cleanAction(dto.action) : null;

    const wasDraft = b.status === BroadcastStatus.draft;
    const status = this.decideStatus(dto.draft ?? wasDraft, dto.scheduledAt ?? b.scheduledAt?.toISOString());
    if (status !== BroadcastStatus.draft && wasDraft) await this.assertDailyLimit(requester.sub);

    const recipients = await this.audience.resolve(b.audience, requester);
    if (status !== BroadcastStatus.draft && !recipients.length) {
      throw new BadRequestException("Tanlangan ro'yxatda qabul qiluvchi yo'q");
    }
    b.recipientCount = recipients.length;
    b.status = status;
    b.scheduledAt = status === BroadcastStatus.scheduled ? new Date(dto.scheduledAt ?? b.scheduledAt!) : null;
    await this.repo.save(b);
    if (status === BroadcastStatus.sending) setImmediate(() => void this.dispatch(b.id));
    return (await this.decorate([b]))[0];
  }

  /** Qoralamani darhol yuborish */
  async sendNow(id: string, requester: Requester) {
    return this.update(id, { draft: false, scheduledAt: undefined }, requester).then(async (r) => {
      const b = await this.repo.findOne({ where: { id } });
      if (b && b.status === BroadcastStatus.scheduled) {
        b.status = BroadcastStatus.sending;
        b.scheduledAt = null;
        await this.repo.save(b);
        setImmediate(() => void this.dispatch(b.id));
        return (await this.decorate([b]))[0];
      }
      return r;
    });
  }

  /** Rejalashtirilgan/qoralama — o'chadi; yuborilgan — hammaning ro'yxatidan ham o'chadi */
  async remove(id: string, requester: Requester) {
    const b = await this.findOwned(id, requester);
    await this.ds.query(`DELETE FROM notifications WHERE broadcast_id = $1`, [b.id]);
    await this.repo.delete({ id: b.id });
    return { deleted: true };
  }

  // ── Ro'yxat va tafsilot ──────────────────────────────────────────────────

  async list(requester: Requester, status?: string) {
    const isAdmin = ADMIN_ROLES.includes(requester.role as string);
    const params: any[] = [];
    const where: string[] = [];
    if (!isAdmin) {
      params.push(requester.sub);
      where.push(`b.sender_id = $${params.length}`);
    }
    if (status && ['draft', 'scheduled', 'sent'].includes(status)) {
      params.push(status === 'sent' ? ['sent', 'sending'] : [status]);
      where.push(`b.status = ANY($${params.length}::varchar[])`);
    }
    const rows: { id: string }[] = await this.ds.query(
      `SELECT b.id FROM notification_broadcasts b
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY COALESCE(b.sent_at, b.scheduled_at, b.created_at) DESC
        LIMIT 100`,
      params,
    );
    const items = rows.length ? await this.repo.find({ where: { id: In(rows.map((r) => r.id)) } }) : [];
    const order = new Map(rows.map((r, i) => [r.id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const countParams = isAdmin ? [] : [requester.sub];
    const [counts]: any[] = await this.ds.query(
      `SELECT COUNT(*)::int AS all,
              COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
              COUNT(*) FILTER (WHERE status = 'draft')::int AS draft
         FROM notification_broadcasts ${isAdmin ? '' : 'WHERE sender_id = $1'}`,
      countParams,
    );

    return {
      items: await this.decorate(items),
      counts: { all: counts?.all ?? 0, scheduled: counts?.scheduled ?? 0, draft: counts?.draft ?? 0 },
      today: { used: await this.todayCount(requester.sub), limit: DAILY_BROADCAST_LIMIT },
    };
  }

  async detail(id: string, requester: Requester) {
    const b = await this.findOwned(id, requester);
    const [decorated] = await this.decorate([b]);
    const [stats]: any[] = await this.ds.query(
      `SELECT COUNT(*)::int AS recipients,
              COUNT(*) FILTER (WHERE push_status = 'sent')::int AS push_sent,
              COUNT(*) FILTER (WHERE is_read = true)::int AS read,
              COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened
         FROM notifications WHERE broadcast_id = $1`,
      [b.id],
    );
    const sender = await this.ds.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [b.senderId]);
    return {
      ...decorated,
      senderName: sender?.[0] ? `${sender[0].first_name ?? ''} ${sender[0].last_name ?? ''}`.trim() : null,
      stats: {
        recipients: b.status === BroadcastStatus.sent ? stats?.recipients ?? 0 : b.recipientCount,
        pushSent: stats?.push_sent ?? 0,
        read: stats?.read ?? 0,
        opened: stats?.opened ?? 0,
      },
    };
  }

  async recipients(id: string, requester: Requester, filter?: string, search?: string) {
    const b = await this.findOwned(id, requester);
    const params: any[] = [b.id];
    let where = `n.broadcast_id = $1`;
    if (filter === 'unread') where += ` AND n.is_read = false`;
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      where += ` AND (u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }
    const rows: any[] = await this.ds.query(
      `SELECT n.id, n.is_read, n.updated_at, n.opened_at, n.push_status,
              u.id AS user_id, u.first_name, u.last_name, u.is_guest, u.avatar_url,
              (SELECT g.name FROM group_members gm JOIN groups g ON g.id = gm.group_id
                WHERE gm.user_id = u.id ORDER BY g.created_at ASC LIMIT 1) AS group_name
         FROM notifications n
         JOIN users u ON u.id = n.user_id
        WHERE ${where}
        ORDER BY n.is_read ASC, u.is_guest ASC, u.first_name ASC
        LIMIT 500`,
      params,
    );
    return rows.map((r) => ({
      notificationId: r.id,
      userId: r.user_id,
      firstName: r.first_name,
      lastName: r.last_name,
      isGuest: !!r.is_guest,
      guestCode: r.is_guest ? String(r.user_id).slice(-6) : null,
      avatarUrl: r.avatar_url ?? null,
      groupName: r.group_name ?? null,
      isRead: !!r.is_read,
      readAt: r.is_read ? r.updated_at : null,
      openedAt: r.opened_at ?? null,
      pushSent: r.push_status === 'sent',
    }));
  }

  /** O'qimaganlarga push qayta yuboriladi (yangi qator yaratilmaydi) */
  async resendUnread(id: string, requester: Requester) {
    const b = await this.findOwned(id, requester);
    if (b.status !== BroadcastStatus.sent) throw new BadRequestException('Xabar hali yuborilmagan');
    const rows: any[] = await this.ds.query(
      `SELECT id, user_id, title, body, action, type FROM notifications WHERE broadcast_id = $1 AND is_read = false`,
      [b.id],
    );
    const pushed = await this.notifications.repush(
      rows.map((r) => ({ id: r.id, userId: r.user_id, title: r.title, body: r.body, action: r.action, type: r.type })),
      'teacher',
    );
    return { unread: rows.length, pushed };
  }

  // ── Yuborish ──────────────────────────────────────────────────────────────

  async dispatch(id: string) {
    const b = await this.repo.findOne({ where: { id } });
    if (!b || b.status !== BroadcastStatus.sending) return;
    try {
      const sender: { role: string }[] = await this.ds.query(`SELECT role FROM users WHERE id = $1`, [b.senderId]);
      const userIds = await this.audience.resolve(b.audience, { sub: b.senderId, role: sender?.[0]?.role ?? Role.teacher });
      const res = await this.notifications.notify(userIds, {
        type: NotificationType.teacher_message,
        title: b.title,
        body: b.body,
        action: b.action,
        senderId: b.senderId,
        broadcastId: b.id,
        referenceId: b.id,
        referenceType: 'broadcast',
        channel: 'teacher',
        preference: 'teacherMessages',
      });
      await this.repo.update(
        { id: b.id },
        { status: BroadcastStatus.sent, sentAt: new Date(), recipientCount: res.recipientCount, pushCount: res.pushCount },
      );
    } catch (err) {
      this.logger.error(`Xabar yuborilmadi (${b.id}): ${(err as Error).message}`);
      // Qoralamaga qaytadi — teacher «Qoralamalar»da ko'radi va qayta yuboradi
      await this.repo.update({ id: b.id }, { status: BroadcastStatus.draft });
    }
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      // Bitta UPDATE ... RETURNING — ikki marta yuborishdan saqlaydi
      const claimed: { id: string }[] = await this.ds.query(
        `UPDATE notification_broadcasts SET status = 'sending', updated_at = now()
          WHERE status = 'scheduled' AND scheduled_at <= now()
          RETURNING id`,
      );
      for (const row of Array.isArray(claimed?.[0]) ? claimed[0] : claimed) {
        await this.dispatch(row.id);
      }
    } catch (err) {
      this.logger.error(`Rejalashtirilgan xabarlar: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  // ── Yordamchilar ─────────────────────────────────────────────────────────

  private decideStatus(draft: boolean | undefined, scheduledAt?: string | null): BroadcastStatus {
    if (draft) return BroadcastStatus.draft;
    if (scheduledAt) {
      const at = new Date(scheduledAt);
      if (Number.isNaN(at.getTime())) throw new BadRequestException("Vaqt noto'g'ri");
      if (at.getTime() < Date.now() - 60 * 1000) throw new BadRequestException("Belgilangan vaqt o'tib ketgan");
      if (at.getTime() > Date.now() + 30 * 1000) return BroadcastStatus.scheduled;
    }
    return BroadcastStatus.sending;
  }

  private validateAction(action?: { type: string; id?: string; url?: string } | null) {
    if (!action) return;
    if (action.type === 'url' && !action.url) throw new BadRequestException('Havola kiritilmagan');
    if (['lesson', 'online_lesson', 'recording', 'chat'].includes(action.type) && !action.id) {
      throw new BadRequestException('Ochiladigan joy tanlanmagan');
    }
  }

  private cleanAudience(a: AudienceSpec): AudienceSpec {
    return {
      mode: a.mode,
      groupIds: a.mode === 'groups' ? [...new Set(a.groupIds ?? [])] : [],
      userIds: a.mode === 'users' ? [...new Set(a.userIds ?? [])] : [],
      includeGuests: a.mode === 'users' ? false : a.includeGuests ?? a.mode === 'all',
    };
  }

  private cleanAction(a: NotificationAction): NotificationAction {
    return {
      type: a.type,
      id: a.id ?? null,
      url: a.type === 'url' ? a.url ?? null : null,
      label: a.label ?? null,
    };
  }

  private async findOwned(id: string, requester: Requester) {
    const b = await this.repo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Xabar topilmadi');
    if (b.senderId !== requester.sub && !ADMIN_ROLES.includes(requester.role as string)) {
      throw new ForbiddenException("Bu xabar sizniki emas");
    }
    return b;
  }

  private async todayCount(senderId: string): Promise<number> {
    const [row]: any[] = await this.ds.query(
      `SELECT COUNT(*)::int AS c FROM notification_broadcasts
        WHERE sender_id = $1 AND status IN ('sending', 'sent', 'scheduled')
          AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent')`,
      [senderId],
    );
    return row?.c ?? 0;
  }

  private async assertDailyLimit(senderId: string) {
    if ((await this.todayCount(senderId)) >= DAILY_BROADCAST_LIMIT) {
      throw new BadRequestException(`Bugun ${DAILY_BROADCAST_LIMIT} ta xabar yuborildi — kunlik limit tugadi`);
    }
  }

  /** Ro'yxat uchun: «Kimga» yozuvi va o'qilganlar soni */
  private async decorate(items: NotificationBroadcast[]) {
    if (!items.length) return [];
    const groupIds = [...new Set(items.flatMap((b) => b.audience?.groupIds ?? []))];
    const groups: { id: string; name: string }[] = groupIds.length
      ? await this.ds.query(`SELECT id, name FROM groups WHERE id = ANY($1::uuid[])`, [groupIds])
      : [];
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    const readRows: { broadcast_id: string; read: number; total: number }[] = await this.ds.query(
      `SELECT broadcast_id, COUNT(*) FILTER (WHERE is_read)::int AS read, COUNT(*)::int AS total
         FROM notifications WHERE broadcast_id = ANY($1::uuid[]) GROUP BY broadcast_id`,
      [items.map((b) => b.id)],
    );
    const readMap = new Map(readRows.map((r) => [r.broadcast_id, r]));

    return items.map((b) => {
      const a = b.audience ?? ({ mode: 'all' } as AudienceSpec);
      let audienceLabel: string;
      if (a.mode === 'all') audienceLabel = a.includeGuests === false ? "Barcha o'quvchilar" : 'Hammasi';
      else if (a.mode === 'groups') {
        const names = (a.groupIds ?? []).map((id) => groupName.get(id)).filter(Boolean) as string[];
        audienceLabel = names.length ? names.join(', ') : 'Guruhlar';
        if (a.includeGuests) audienceLabel += ' + mehmonlar';
      } else audienceLabel = `${(a.userIds ?? []).length} ta tanlangan`;
      const r = readMap.get(b.id);
      return {
        id: b.id,
        title: b.title,
        body: b.body,
        audience: a,
        audienceLabel,
        action: b.action,
        status: b.status,
        scheduledAt: b.scheduledAt,
        sentAt: b.sentAt,
        createdAt: b.createdAt,
        recipientCount: r?.total ?? b.recipientCount,
        pushCount: b.pushCount,
        readCount: r?.read ?? 0,
      };
    });
  }
}

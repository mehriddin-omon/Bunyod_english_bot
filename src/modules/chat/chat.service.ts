import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ChatMessage,
  ChatReport,
  ChatReportStatus,
  ChatRestriction,
  ChatUserBlock,
  GroupChat,
} from 'src/common/core/entitys/group-chat.entity';
import { NotificationType, Role } from 'src/common/utils/enum';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatBus, ChatPresence } from './chat-realtime';
import { ChatSettingsDto, EditMessageDto, SendMessageDto } from './dto/chat.dto';

export interface ChatUser {
  sub: string;
  role: string;
}

interface ChatContext {
  chat: GroupChat;
  groupId: string;
  groupName: string;
  teacherId: string | null;
  isModerator: boolean;
}

const ADMIN_ROLES: string[] = [Role.admin, Role.superAdmin];
/** O'z xabarini tahrirlash/o'chirish muddati */
const EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Bitta chat bo'yicha bir userga push oralig'i */
const PUSH_THROTTLE_MS = 2 * 60 * 1000;
/** 10 soniyada ko'pi bilan 5 ta xabar */
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX = 5;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly rate = new Map<string, number[]>();
  private readonly lastPush = new Map<string, number>();
  private readonly memberCache = new Map<string, { ids: string[]; at: number }>();

  constructor(
    @InjectRepository(GroupChat) private readonly chatRepo: Repository<GroupChat>,
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(ChatRestriction) private readonly restrictionRepo: Repository<ChatRestriction>,
    @InjectRepository(ChatReport) private readonly reportRepo: Repository<ChatReport>,
    @InjectRepository(ChatUserBlock) private readonly blockRepo: Repository<ChatUserBlock>,
    private readonly notifications: NotificationsService,
    private readonly presence: ChatPresence,
    private readonly bus: ChatBus,
    private readonly ds: DataSource,
  ) {}

  // ── Ro'yxat ──────────────────────────────────────────────────────────────

  async myChats(user: ChatUser) {
    const isAdmin = ADMIN_ROLES.includes(user.role);
    const isGuest = await this.isGuest(user.sub);
    if (isGuest) return { chats: [], rulesAccepted: false, isGuest: true };

    const groupFilter = isAdmin
      ? `g.status = 'active'`
      : `g.status = 'active' AND (g.teacher_id = $1 OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $1))`;
    // Chati yo'q guruhlarga chat ochiladi (guruh yaratilganda alohida qadam kerak emas)
    await this.ds.query(
      `INSERT INTO group_chats (group_id)
       SELECT g.id FROM groups g
        WHERE ${groupFilter}
          AND NOT EXISTS (SELECT 1 FROM group_chats c WHERE c.group_id = g.id)
       ON CONFLICT DO NOTHING`,
      isAdmin ? [] : [user.sub],
    );
    const rows: any[] = await this.ds.query(
      `SELECT c.id AS chat_id, c.is_enabled, c.teacher_only, g.id AS group_id, g.name, g.color, g.teacher_id,
              (SELECT COUNT(*) FROM group_members gm JOIN users u ON u.id = gm.user_id
                WHERE gm.group_id = g.id AND u.is_active = true)::int AS member_count,
              (SELECT COUNT(*) FROM chat_messages m
                WHERE m.chat_id = c.id AND m.deleted_at IS NULL AND m.sender_id <> $1
                  AND m.created_at > COALESCE((SELECT r.last_read_at FROM chat_reads r WHERE r.chat_id = c.id AND r.user_id = $1), '-infinity'::timestamptz)
                  AND NOT EXISTS (SELECT 1 FROM chat_user_blocks b WHERE b.user_id = $1 AND b.blocked_user_id = m.sender_id)
              )::int AS unread,
              lm.body AS last_body, lm.created_at AS last_at, lu.first_name AS last_sender
         FROM group_chats c
         JOIN groups g ON g.id = c.group_id
         LEFT JOIN LATERAL (
           SELECT m.body, m.created_at, m.sender_id FROM chat_messages m
            WHERE m.chat_id = c.id AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC LIMIT 1
         ) lm ON true
         LEFT JOIN users lu ON lu.id = lm.sender_id
        WHERE ${groupFilter}
        ORDER BY COALESCE(lm.created_at, c.created_at) DESC
        LIMIT 100`,
      [user.sub],
    );
    const accepted: any[] = await this.ds.query(`SELECT chat_rules_accepted_at FROM users WHERE id = $1`, [user.sub]);
    return {
      isGuest: false,
      rulesAccepted: !!accepted?.[0]?.chat_rules_accepted_at,
      chats: rows
        .filter((r) => r.is_enabled || r.teacher_id === user.sub || isAdmin)
        .map((r) => ({
          chatId: r.chat_id,
          groupId: r.group_id,
          groupName: r.name,
          groupColor: r.color ?? null,
          memberCount: r.member_count + (r.teacher_id ? 1 : 0),
          unreadCount: r.unread,
          isEnabled: r.is_enabled,
          teacherOnly: r.teacher_only,
          isModerator: r.teacher_id === user.sub || isAdmin,
          lastMessage: r.last_at ? { body: r.last_body, senderName: r.last_sender, createdAt: r.last_at } : null,
        })),
    };
  }

  async acceptRules(user: ChatUser) {
    await this.ds.query(`UPDATE users SET chat_rules_accepted_at = now() WHERE id = $1`, [user.sub]);
    return { accepted: true };
  }

  // ── Xabarlar ─────────────────────────────────────────────────────────────

  async messages(groupId: string, user: ChatUser, before?: string, limitRaw?: number) {
    const ctx = await this.context(groupId, user);
    const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 100);
    const params: any[] = [ctx.chat.id, user.sub];
    let cursor = '';
    if (before) {
      params.push(before);
      cursor = `AND m.created_at < (SELECT created_at FROM chat_messages WHERE id = $${params.length})`;
    }
    params.push(limit + 1);
    const rows: any[] = await this.ds.query(
      `${this.selectMessages()}
        WHERE m.chat_id = $1 ${cursor}
          AND NOT EXISTS (SELECT 1 FROM chat_user_blocks b WHERE b.user_id = $2 AND b.blocked_user_id = m.sender_id)
        ORDER BY m.created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => this.formatMessage(r, ctx));

    const pinned = ctx.chat.pinnedMessageId ? await this.loadMessage(ctx.chat.pinnedMessageId, ctx) : null;
    const restriction = await this.restrictionRepo.findOne({ where: { chatId: ctx.chat.id, userId: user.sub } });
    const [read]: any[] = await this.ds.query(
      `SELECT last_read_at FROM chat_reads WHERE chat_id = $1 AND user_id = $2`,
      [ctx.chat.id, user.sub],
    );
    return {
      items,
      hasMore,
      chat: {
        chatId: ctx.chat.id,
        groupId: ctx.groupId,
        groupName: ctx.groupName,
        isEnabled: ctx.chat.isEnabled,
        teacherOnly: ctx.chat.teacherOnly,
        isModerator: ctx.isModerator,
        pinned: pinned && !pinned.deleted ? pinned : null,
        mutedUntil: restriction && restriction.mutedUntil > new Date() ? restriction.mutedUntil : null,
        lastReadAt: read?.last_read_at ?? null,
        canWrite: this.canWrite(ctx, restriction),
      },
    };
  }

  async send(groupId: string, user: ChatUser, dto: SendMessageDto) {
    const ctx = await this.context(groupId, user);
    const body = (dto.body ?? '').trim();
    if (!body) throw new BadRequestException("Xabar bo'sh");
    if (!ctx.chat.isEnabled && !ctx.isModerator) throw new ForbiddenException('Chat vaqtincha yopiq');
    if (ctx.chat.teacherOnly && !ctx.isModerator) throw new ForbiddenException("Hozir faqat o'qituvchi yoza oladi");
    const restriction = await this.restrictionRepo.findOne({ where: { chatId: ctx.chat.id, userId: user.sub } });
    if (!ctx.isModerator && restriction && restriction.mutedUntil > new Date()) {
      throw new ForbiddenException('Sizga yozish vaqtincha cheklangan');
    }
    if (!ctx.isModerator) {
      const accepted: any[] = await this.ds.query(`SELECT chat_rules_accepted_at FROM users WHERE id = $1`, [user.sub]);
      if (!accepted?.[0]?.chat_rules_accepted_at) throw new ForbiddenException('Avval chat qoidalarini qabul qiling');
    }

    if (dto.clientId) {
      const dup = await this.msgRepo.findOne({ where: { chatId: ctx.chat.id, senderId: user.sub, clientId: dto.clientId } });
      if (dup) return { item: await this.loadMessage(dup.id, ctx) };
    }
    this.checkRate(user.sub);

    let replyTo: ChatMessage | null = null;
    if (dto.replyToId) {
      replyTo = await this.msgRepo.findOne({ where: { id: dto.replyToId, chatId: ctx.chat.id } });
      if (!replyTo) throw new BadRequestException('Javob berilayotgan xabar topilmadi');
    }

    const saved = await this.msgRepo.save(
      this.msgRepo.create({
        chatId: ctx.chat.id,
        senderId: user.sub,
        body,
        replyToId: replyTo?.id ?? null,
        clientId: dto.clientId ?? null,
      }),
    );
    // Yuboruvchi uchun o'qildi
    await this.touchRead(ctx.chat.id, user.sub, saved.createdAt);

    const item = await this.loadMessage(saved.id, ctx);
    const members = await this.memberIds(ctx);
    this.bus.publish({ recipients: members, event: 'message:new', data: { groupId: ctx.groupId, item } });
    void this.pushNewMessage(ctx, members, user.sub, item, replyTo?.senderId ?? null).catch((e) =>
      this.logger.warn(`Chat push: ${(e as Error).message}`),
    );
    return { item };
  }

  async edit(groupId: string, messageId: string, user: ChatUser, dto: EditMessageDto) {
    const ctx = await this.context(groupId, user);
    const m = await this.msgRepo.findOne({ where: { id: messageId, chatId: ctx.chat.id } });
    if (!m || m.deletedAt) throw new NotFoundException('Xabar topilmadi');
    if (m.senderId !== user.sub) throw new ForbiddenException("Faqat o'z xabaringizni tahrirlay olasiz");
    if (Date.now() - new Date(m.createdAt).getTime() > EDIT_WINDOW_MS) {
      throw new BadRequestException("Xabarni 15 daqiqa ichida tahrirlash mumkin");
    }
    const body = dto.body.trim();
    if (!body) throw new BadRequestException("Xabar bo'sh");
    m.body = body;
    m.editedAt = new Date();
    await this.msgRepo.save(m);
    const item = await this.loadMessage(m.id, ctx);
    this.bus.publish({ recipients: await this.memberIds(ctx), event: 'message:updated', data: { groupId: ctx.groupId, item } });
    return { item };
  }

  async remove(groupId: string, messageId: string, user: ChatUser) {
    const ctx = await this.context(groupId, user);
    const m = await this.msgRepo.findOne({ where: { id: messageId, chatId: ctx.chat.id } });
    if (!m || m.deletedAt) throw new NotFoundException('Xabar topilmadi');
    const own = m.senderId === user.sub;
    if (!ctx.isModerator) {
      if (!own) throw new ForbiddenException("Faqat o'z xabaringizni o'chira olasiz");
      if (Date.now() - new Date(m.createdAt).getTime() > EDIT_WINDOW_MS) {
        throw new BadRequestException("Xabarni 15 daqiqa ichida o'chirish mumkin");
      }
    }
    await this.softDelete(m, user.sub, ctx);
    return { deleted: true };
  }

  async markRead(groupId: string, user: ChatUser) {
    const ctx = await this.context(groupId, user);
    await this.touchRead(ctx.chat.id, user.sub, new Date());
    return { read: true };
  }

  async report(groupId: string, messageId: string, user: ChatUser, reason?: string) {
    const ctx = await this.context(groupId, user);
    const m = await this.msgRepo.findOne({ where: { id: messageId, chatId: ctx.chat.id } });
    if (!m) throw new NotFoundException('Xabar topilmadi');
    if (m.senderId === user.sub) throw new BadRequestException("O'z xabaringizga shikoyat qilib bo'lmaydi");
    await this.ds.query(
      `INSERT INTO chat_reports (chat_id, message_id, reporter_id, reason, status)
       VALUES ($1, $2, $3, $4, 'open')
       ON CONFLICT (message_id, reporter_id) DO NOTHING`,
      [ctx.chat.id, m.id, user.sub, reason?.slice(0, 200) ?? null],
    );
    if (ctx.teacherId && ctx.teacherId !== user.sub) {
      void this.notifications
        .notify([ctx.teacherId], {
          type: NotificationType.system,
          title: `Chatda shikoyat: ${ctx.groupName}`,
          body: `Xabar: «${m.body.slice(0, 80)}»`,
          action: { type: 'chat', id: ctx.groupId, label: ctx.groupName },
          channel: 'chat',
          referenceId: m.id,
          referenceType: 'chat_report',
        })
        .catch(() => {});
    }
    return { reported: true };
  }

  async block(user: ChatUser, targetId: string) {
    if (targetId === user.sub) throw new BadRequestException("O'zingizni yashira olmaysiz");
    await this.ds.query(
      `INSERT INTO chat_user_blocks (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.sub, targetId],
    );
    return { blocked: true };
  }

  async unblock(user: ChatUser, targetId: string) {
    await this.blockRepo.delete({ userId: user.sub, blockedUserId: targetId });
    return { blocked: false };
  }

  async blocked(user: ChatUser) {
    const rows: any[] = await this.ds.query(
      `SELECT u.id, u.first_name, u.last_name FROM chat_user_blocks b JOIN users u ON u.id = b.blocked_user_id
        WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
      [user.sub],
    );
    return rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name }));
  }

  async members(groupId: string, user: ChatUser) {
    const ctx = await this.context(groupId, user);
    const rows: any[] = await this.ds.query(
      `SELECT u.id, u.first_name, u.last_name, u.avatar_url, u.role,
              r.muted_until
         FROM users u
         LEFT JOIN chat_restrictions r ON r.chat_id = $2 AND r.user_id = u.id AND r.muted_until > now()
        WHERE u.is_active = true
          AND (u.id IN (SELECT gm.user_id FROM group_members gm WHERE gm.group_id = $1) OR u.id = $3)
        ORDER BY (u.id = $3) DESC, u.first_name ASC`,
      [ctx.groupId, ctx.chat.id, ctx.teacherId],
    );
    const list = rows.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      avatarUrl: r.avatar_url ?? null,
      isTeacher: r.id === ctx.teacherId,
      online: this.presence.isOnline(r.id),
      mutedUntil: r.muted_until ?? null,
    }));
    return { members: list, onlineCount: list.filter((m) => m.online).length };
  }

  // ── Moderatsiya (teacher) ────────────────────────────────────────────────

  async updateSettings(groupId: string, user: ChatUser, dto: ChatSettingsDto) {
    const ctx = await this.moderatorContext(groupId, user);
    if (dto.isEnabled !== undefined) ctx.chat.isEnabled = dto.isEnabled;
    if (dto.teacherOnly !== undefined) ctx.chat.teacherOnly = dto.teacherOnly;
    await this.chatRepo.save(ctx.chat);
    const data = { groupId: ctx.groupId, isEnabled: ctx.chat.isEnabled, teacherOnly: ctx.chat.teacherOnly };
    this.bus.publish({ recipients: await this.memberIds(ctx), event: 'chat:settings', data });
    return data;
  }

  async pin(groupId: string, user: ChatUser, messageId: string | null) {
    const ctx = await this.moderatorContext(groupId, user);
    if (messageId) {
      const m = await this.msgRepo.findOne({ where: { id: messageId, chatId: ctx.chat.id } });
      if (!m || m.deletedAt) throw new NotFoundException('Xabar topilmadi');
    }
    ctx.chat.pinnedMessageId = messageId;
    await this.chatRepo.save(ctx.chat);
    const pinned = messageId ? await this.loadMessage(messageId, ctx) : null;
    this.bus.publish({ recipients: await this.memberIds(ctx), event: 'chat:pinned', data: { groupId: ctx.groupId, pinned } });
    return { pinned };
  }

  async restrict(groupId: string, user: ChatUser, targetId: string, hours: number) {
    const ctx = await this.moderatorContext(groupId, user);
    if (targetId === ctx.teacherId) throw new BadRequestException("O'qituvchini cheklab bo'lmaydi");
    const until = new Date(Date.now() + hours * 3600 * 1000);
    await this.ds.query(
      `INSERT INTO chat_restrictions (chat_id, user_id, muted_until, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (chat_id, user_id) DO UPDATE SET muted_until = EXCLUDED.muted_until, created_by = EXCLUDED.created_by, updated_at = now()`,
      [ctx.chat.id, targetId, until, user.sub],
    );
    this.bus.publish({
      recipients: [targetId],
      event: 'chat:restricted',
      data: { groupId: ctx.groupId, mutedUntil: until },
    });
    return { mutedUntil: until };
  }

  async unrestrict(groupId: string, user: ChatUser, targetId: string) {
    const ctx = await this.moderatorContext(groupId, user);
    await this.restrictionRepo.delete({ chatId: ctx.chat.id, userId: targetId });
    this.bus.publish({ recipients: [targetId], event: 'chat:restricted', data: { groupId: ctx.groupId, mutedUntil: null } });
    return { mutedUntil: null };
  }

  async reports(groupId: string, user: ChatUser, status?: string) {
    const ctx = await this.moderatorContext(groupId, user);
    const rows: any[] = await this.ds.query(
      `SELECT r.id, r.reason, r.status, r.created_at, r.message_id,
              m.body, m.deleted_at, m.created_at AS message_at,
              s.id AS sender_id, s.first_name AS sender_first, s.last_name AS sender_last,
              rp.first_name AS reporter_first, rp.last_name AS reporter_last
         FROM chat_reports r
         JOIN chat_messages m ON m.id = r.message_id
         JOIN users s ON s.id = m.sender_id
         JOIN users rp ON rp.id = r.reporter_id
        WHERE r.chat_id = $1 ${status === 'open' ? `AND r.status = 'open'` : ''}
        ORDER BY (r.status = 'open') DESC, r.created_at DESC
        LIMIT 50`,
      [ctx.chat.id],
    );
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      createdAt: r.created_at,
      messageId: r.message_id,
      messageBody: r.deleted_at ? null : r.body,
      messageDeleted: !!r.deleted_at,
      messageAt: r.message_at,
      sender: { id: r.sender_id, firstName: r.sender_first, lastName: r.sender_last },
      reporter: { firstName: r.reporter_first, lastName: r.reporter_last },
    }));
  }

  async resolveReport(groupId: string, reportId: string, user: ChatUser, action: 'dismiss' | 'delete') {
    const ctx = await this.moderatorContext(groupId, user);
    const report = await this.reportRepo.findOne({ where: { id: reportId, chatId: ctx.chat.id } });
    if (!report) throw new NotFoundException('Shikoyat topilmadi');
    if (action === 'delete') {
      const m = await this.msgRepo.findOne({ where: { id: report.messageId } });
      if (m && !m.deletedAt) await this.softDelete(m, user.sub, ctx);
    }
    await this.reportRepo.update(
      { messageId: report.messageId, chatId: ctx.chat.id },
      { status: ChatReportStatus.resolved, resolvedBy: user.sub },
    );
    return { resolved: true };
  }

  // ── Gateway uchun ────────────────────────────────────────────────────────

  /** Socket ulanganda: foydalanuvchi a'zo bo'lgan guruhlar */
  async groupIdsForUser(userId: string, role: string): Promise<string[]> {
    if (ADMIN_ROLES.includes(role)) return [];
    const rows: { id: string }[] = await this.ds.query(
      `SELECT g.id FROM groups g
        WHERE g.teacher_id = $1 OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $1)`,
      [userId],
    );
    return rows.map((r) => r.id);
  }

  /** «… yozmoqda» — faqat a'zo bo'lsa, boshqa a'zolarga */
  async typingRecipients(groupId: string, user: ChatUser): Promise<string[] | null> {
    try {
      const ctx = await this.context(groupId, user);
      return (await this.memberIds(ctx)).filter((id) => id !== user.sub);
    } catch {
      return null;
    }
  }

  /** Kimdir ulandi/uzildi — uning guruhdoshlariga */
  async presenceRecipients(userId: string): Promise<string[]> {
    const rows: { id: string }[] = await this.ds.query(
      `SELECT DISTINCT x.id FROM (
         SELECT gm.user_id AS id FROM group_members gm
          WHERE gm.group_id IN (SELECT g.id FROM groups g WHERE g.teacher_id = $1
                                UNION SELECT gm2.group_id FROM group_members gm2 WHERE gm2.user_id = $1)
         UNION
         SELECT g.teacher_id FROM groups g
          WHERE g.teacher_id IS NOT NULL
            AND g.id IN (SELECT gm3.group_id FROM group_members gm3 WHERE gm3.user_id = $1)
       ) x WHERE x.id <> $1`,
      [userId],
    );
    return rows.map((r) => r.id);
  }

  // ── Ichki ────────────────────────────────────────────────────────────────

  private async context(groupId: string, user: ChatUser): Promise<ChatContext> {
    const rows: any[] = await this.ds.query(
      `SELECT g.id, g.name, g.teacher_id,
              EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $2) AS is_member,
              u.is_guest
         FROM groups g, users u
        WHERE g.id = $1 AND u.id = $2`,
      [groupId, user.sub],
    );
    const g = rows[0];
    if (!g) throw new NotFoundException('Guruh topilmadi');
    const isModerator = g.teacher_id === user.sub || ADMIN_ROLES.includes(user.role);
    if (!isModerator && (!g.is_member || g.is_guest)) throw new ForbiddenException("Siz bu guruh a'zosi emassiz");

    let chat = await this.chatRepo.findOne({ where: { groupId } });
    if (!chat) {
      await this.ds.query(`INSERT INTO group_chats (group_id) VALUES ($1) ON CONFLICT DO NOTHING`, [groupId]);
      chat = await this.chatRepo.findOne({ where: { groupId } });
    }
    if (!chat) throw new NotFoundException('Chat topilmadi');
    if (!chat.isEnabled && !isModerator) throw new ForbiddenException('Chat vaqtincha yopiq');
    return { chat, groupId: g.id, groupName: g.name, teacherId: g.teacher_id ?? null, isModerator };
  }

  private async moderatorContext(groupId: string, user: ChatUser) {
    const ctx = await this.context(groupId, user);
    if (!ctx.isModerator) throw new ForbiddenException("Bu amal faqat guruh o'qituvchisi uchun");
    return ctx;
  }

  private canWrite(ctx: ChatContext, restriction: ChatRestriction | null): boolean {
    if (ctx.isModerator) return true;
    if (!ctx.chat.isEnabled || ctx.chat.teacherOnly) return false;
    return !(restriction && restriction.mutedUntil > new Date());
  }

  private async memberIds(ctx: ChatContext): Promise<string[]> {
    const cached = this.memberCache.get(ctx.groupId);
    if (cached && Date.now() - cached.at < 30 * 1000) return cached.ids;
    const rows: { user_id: string }[] = await this.ds.query(
      `SELECT gm.user_id FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = $1 AND u.is_active = true AND u.is_guest = false`,
      [ctx.groupId],
    );
    const ids = [...new Set([...rows.map((r) => r.user_id), ...(ctx.teacherId ? [ctx.teacherId] : [])])];
    this.memberCache.set(ctx.groupId, { ids, at: Date.now() });
    return ids;
  }

  private checkRate(userId: string) {
    const now = Date.now();
    const list = (this.rate.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (list.length >= RATE_MAX) {
      throw new HttpException('Juda tez yozyapsiz — bir oz kuting', HttpStatus.TOO_MANY_REQUESTS);
    }
    list.push(now);
    this.rate.set(userId, list);
  }

  private async touchRead(chatId: string, userId: string, at: Date) {
    await this.ds.query(
      `INSERT INTO chat_reads (chat_id, user_id, last_read_at) VALUES ($1, $2, $3)
       ON CONFLICT (chat_id, user_id) DO UPDATE SET last_read_at = GREATEST(chat_reads.last_read_at, EXCLUDED.last_read_at), updated_at = now()`,
      [chatId, userId, at],
    );
  }

  private async softDelete(m: ChatMessage, byUserId: string, ctx: ChatContext) {
    m.deletedAt = new Date();
    m.deletedBy = byUserId;
    await this.msgRepo.save(m);
    if (ctx.chat.pinnedMessageId === m.id) {
      ctx.chat.pinnedMessageId = null;
      await this.chatRepo.save(ctx.chat);
      this.bus.publish({ recipients: await this.memberIds(ctx), event: 'chat:pinned', data: { groupId: ctx.groupId, pinned: null } });
    }
    const item = await this.loadMessage(m.id, ctx);
    this.bus.publish({ recipients: await this.memberIds(ctx), event: 'message:deleted', data: { groupId: ctx.groupId, item } });
  }

  private selectMessages(): string {
    return `SELECT m.id, m.chat_id, m.body, m.created_at, m.edited_at, m.deleted_at, m.deleted_by, m.client_id,
                   s.id AS sender_id, s.first_name, s.last_name, s.avatar_url, s.role,
                   rm.id AS reply_id, rm.body AS reply_body, rm.deleted_at AS reply_deleted,
                   rs.first_name AS reply_first, rs.last_name AS reply_last
              FROM chat_messages m
              JOIN users s ON s.id = m.sender_id
              LEFT JOIN chat_messages rm ON rm.id = m.reply_to_id
              LEFT JOIN users rs ON rs.id = rm.sender_id`;
  }

  private async loadMessage(id: string, ctx: ChatContext) {
    const rows: any[] = await this.ds.query(`${this.selectMessages()} WHERE m.id = $1`, [id]);
    return rows[0] ? this.formatMessage(rows[0], ctx) : null;
  }

  private formatMessage(r: any, ctx: ChatContext) {
    const deleted = !!r.deleted_at;
    return {
      id: r.id,
      groupId: ctx.groupId,
      body: deleted ? null : r.body,
      deleted,
      deletedByModerator: deleted && r.deleted_by !== r.sender_id,
      createdAt: r.created_at,
      editedAt: r.edited_at ?? null,
      clientId: r.client_id ?? null,
      sender: {
        id: r.sender_id,
        firstName: r.first_name,
        lastName: r.last_name,
        avatarUrl: r.avatar_url ?? null,
        isTeacher: r.sender_id === ctx.teacherId || ['teacher', 'admin', 'superAdmin'].includes(r.role),
      },
      replyTo: r.reply_id
        ? {
            id: r.reply_id,
            body: r.reply_deleted ? null : r.reply_body,
            deleted: !!r.reply_deleted,
            senderName: `${r.reply_first ?? ''} ${r.reply_last ?? ''}`.trim(),
          }
        : null,
    };
  }

  private async pushNewMessage(
    ctx: ChatContext,
    members: string[],
    senderId: string,
    item: any,
    replyToSenderId: string | null,
  ) {
    const senderIsTeacher = senderId === ctx.teacherId;
    const now = Date.now();
    const targets = members.filter((id) => {
      if (id === senderId) return false;
      if (this.presence.isOnline(id)) return false; // ilova ochiq — socket orqali ko'radi
      const important = senderIsTeacher || id === replyToSenderId;
      const key = `${id}:${ctx.chat.id}`;
      if (!important && now - (this.lastPush.get(key) ?? 0) < PUSH_THROTTLE_MS) return false;
      this.lastPush.set(key, now);
      return true;
    });
    if (!targets.length) return;
    // Bloklaganlar push olmaydi
    const blockers: { user_id: string }[] = await this.ds.query(
      `SELECT user_id FROM chat_user_blocks WHERE blocked_user_id = $1 AND user_id = ANY($2::uuid[])`,
      [senderId, targets],
    );
    const blocked = new Set(blockers.map((b) => b.user_id));
    const final = targets.filter((t) => !blocked.has(t));
    const name = item?.sender?.firstName ?? 'Guruhdosh';
    await this.notifications.notify(final, {
      type: NotificationType.message,
      title: ctx.groupName,
      body: `${name}: ${String(item?.body ?? '').slice(0, 140)}`,
      action: { type: 'chat', id: ctx.groupId, label: ctx.groupName },
      channel: 'chat',
      preference: 'groupChat',
      store: false,
      data: { groupId: ctx.groupId },
    });
  }

  private async isGuest(userId: string): Promise<boolean> {
    const rows: any[] = await this.ds.query(`SELECT is_guest FROM users WHERE id = $1`, [userId]);
    return !!rows?.[0]?.is_guest;
  }
}

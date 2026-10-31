import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { config } from '@my/config';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { touchLastSeen } from 'src/common/services/last-seen';
import { ChatBus, ChatEvent, ChatPresence } from './chat-realtime';
import { ChatService } from './chat.service';

function corsOrigin(): boolean | string[] {
  if (process.env.NODE_ENV !== 'production') return true;
  const list = process.env.FRONTEND_URL?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  return list.length ? list : true;
}

/**
 * Guruh chati — real vaqt (Socket.IO, namespace `/chat`, yo'l `/socket.io`).
 * Ulanish: `io(BASE + '/chat', { auth: { token: accessToken } })`.
 * Har bir user o'z `user:<id>` xonasiga qo'shiladi — xabar DB'dagi joriy a'zolikka qarab
 * yuboriladi, shuning uchun guruhdan chiqarilgan o'quvchiga keyingi xabar bormaydi.
 *
 * HTTP guard'lari (GuardService) socket'ga mos emas — shuning uchun @Public() va
 * token shu yerda (`handleConnection`) tekshiriladi.
 */
@Public()
@WebSocketGateway({ namespace: '/chat', cors: { origin: corsOrigin(), credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
    private readonly presence: ChatPresence,
    private readonly bus: ChatBus,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    this.bus.on('chat', (e: ChatEvent) => {
      if (!this.server) return;
      for (const id of e.recipients) this.server.to(`user:${id}`).emit(e.event, e.data);
    });
  }

  async handleConnection(client: Socket) {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization as string | undefined)?.replace(/^Bearer\s+/i, '') ??
      (client.handshake.query?.token as string | undefined);
    if (!raw) {
      client.emit('auth_error', { reason: 'no_token' });
      client.disconnect(true);
      return;
    }
    try {
      const payload: any = await this.jwt.verifyAsync(raw, { secret: config.JWT_ACCESS_SECRET });
      client.data.user = { sub: payload.sub, role: payload.role };
      await client.join(`user:${payload.sub}`);
      const first = this.presence.add(payload.sub);
      // Ilova ochildi — «oxirgi faollik»
      touchLastSeen(this.ds, payload.sub, true);
      client.emit('ready', { userId: payload.sub });
      if (first) void this.broadcastPresence(payload.sub, true);
    } catch {
      client.emit('auth_error', { reason: 'invalid_token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId: string | undefined = client.data?.user?.sub;
    if (!userId) return;
    const last = this.presence.remove(userId);
    if (last) {
      // Ilova yopildi / fonga o'tdi — onlayn bo'lgan oxirgi payt aniq qoladi
      touchLastSeen(this.ds, userId, true);
      void this.broadcastPresence(userId, false);
    }
  }

  @SubscribeMessage('message:send')
  async onSend(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const user = client.data?.user;
    if (!user) return { ok: false, error: 'Avtorizatsiya yo\'q' };
    try {
      const body = typeof payload?.body === 'string' ? payload.body.slice(0, 2000) : '';
      const res = await this.chat.send(String(payload?.groupId ?? ''), user, {
        body,
        replyToId: typeof payload?.replyToId === 'string' ? payload.replyToId : undefined,
        clientId: typeof payload?.clientId === 'string' ? payload.clientId.slice(0, 64) : undefined,
      });
      return { ok: true, item: res.item };
    } catch (err: any) {
      return { ok: false, error: err?.response?.message ?? err?.message ?? 'Xato', status: err?.status ?? 500 };
    }
  }

  @SubscribeMessage('typing')
  async onTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const user = client.data?.user;
    if (!user || typeof payload?.groupId !== 'string') return;
    const recipients = await this.chat.typingRecipients(payload.groupId, user);
    if (!recipients) return;
    const name = typeof payload?.name === 'string' ? payload.name.slice(0, 40) : '';
    for (const id of recipients) {
      this.server.to(`user:${id}`).emit('typing', { groupId: payload.groupId, userId: user.sub, name });
    }
  }

  @SubscribeMessage('read')
  async onRead(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const user = client.data?.user;
    if (!user || typeof payload?.groupId !== 'string') return { ok: false };
    try {
      await this.chat.markRead(payload.groupId, user);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  private async broadcastPresence(userId: string, online: boolean) {
    try {
      const ids = await this.chat.presenceRecipients(userId);
      for (const id of ids) this.server.to(`user:${id}`).emit('presence', { userId, online });
    } catch (err) {
      this.logger.warn(`presence: ${(err as Error).message}`);
    }
  }
}

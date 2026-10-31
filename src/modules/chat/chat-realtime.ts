import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { isSocketConnected, presenceAdd, presenceRemove } from 'src/common/services/last-seen';

/**
 * Kim hozir ulangan (socket soni) — bitta PM2 jarayoni uchun xotirada.
 * Hisob `common/services/last-seen.ts` da — teacher paneldagi «Onlayn» ham shundan o'qiydi.
 */
@Injectable()
export class ChatPresence {
  add(userId: string): boolean {
    return presenceAdd(userId);
  }

  remove(userId: string): boolean {
    return presenceRemove(userId);
  }

  isOnline(userId: string): boolean {
    return isSocketConnected(userId);
  }
}

export interface ChatEvent {
  /** Kimlarga yetkaziladi (guruh a'zolari + teacher) */
  recipients: string[];
  event: string;
  data: unknown;
}

/** ChatService → ChatGateway (aylana bog'liqliksiz) */
@Injectable()
export class ChatBus extends EventEmitter {
  publish(e: ChatEvent) {
    this.emit('chat', e);
  }
}

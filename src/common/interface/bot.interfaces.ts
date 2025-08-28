import { Context } from 'telegraf';

export interface SessionData {
  step?: string;
  lessonId?: number;
}

export interface BotContext extends Context {
  session: SessionData;
}

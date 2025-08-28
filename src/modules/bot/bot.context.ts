import type { Context } from 'telegraf';

export interface LessonField {
  type: 'text' | 'document' | 'audio' | 'photo' | 'video' | 'voice' | 'unknown';
  content?: string;
  fileId?: string;
  fileName?: string;
  title?: string;
  channelMessageId?: number;
}

export interface SessionData {
  data?: Record<string, LessonField>; // ✅ index signature qo‘shildi
  awaiting?: string | null;
  lessonId?: number | null;
}

export interface BotContext extends Context {
  session?: SessionData;
  match?: RegExpMatchArray;
}
import type { Context } from 'telegraf';
import { ResourceType } from 'src/common/utils/enum';

export interface LessonField {
  type: 'text' | 'document' | 'audio' | 'photo' | 'video' | 'voice' | 'unknown';
  content?: string;
  fileId?: string;
  fileName?: string;
  title?: string;
  channelMessageId?: number;
}

export interface LessonResource {
  id: number;
  type: ResourceType;
  channelId: number;
  messageId: number;
}

export interface Lesson {
  id: number;
  title: string;
  resources?: LessonResource[];
}

export interface SessionData {
  data?: Record<string, LessonField>;
  awaiting?: string | null;
  lessonId?: number | null;
  lessons?: Lesson[];
  currentLessonId?: number;
}

export interface BotContext extends Context {
  session?: SessionData;
  match?: RegExpMatchArray;
}
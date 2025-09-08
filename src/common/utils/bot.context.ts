import type { Context } from 'telegraf';
export type LessonFileType = 'text' | 'document' | 'audio' | 'photo' | 'video' | 'voice' | 'unknown';

export interface LessonField {
  type: string;
  content?: string;
  fileId?: string;
  fileName?: string;
  lesson_name?: string;
  channelMessageId?: number;
}

export interface SessionData {
  data: {
    lesson_name?: LessonField;
    listening?: LessonField[];
    reading?: LessonField[];
    test?: LessonField[];
    word_list?: LessonField[];
  };
  awaiting?: keyof SessionData['data'] | null;
  lessonId?: string | null;
  currentLessonId?: string | null;
  // lessons?: Lesson[];
}

export interface BotContext extends Context {
  session?: SessionData;
  match?: RegExpMatchArray;
}

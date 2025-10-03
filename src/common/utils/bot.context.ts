import { Lesson } from 'src/modules';
import type { Context } from 'telegraf';
import { LessonStatus } from './enum';

export type LessonFileType = 'text' | 'document' | 'audio' | 'photo' | 'video' | 'voice' | 'unknown';

export interface LessonField {
  type: LessonFileType;
  content?: string;
  fileId?: string;
  fileName?: string;
  lesson_name?: string;
  channelMessageId?: number;
}

export interface WordItem {
  type?: 'word_list';
  english: string;
  uzbek: string;
  transcription?: string;
  example?: string;
  voice_file_id?: string;
  message_id?: string;
  order_index: number;
  category?: string;
}

export interface SessionData {
  data: {
    lesson_name?: LessonField;
    listening?: LessonField[];
    reading?: LessonField[];
    word_list?: WordItem[];
    test?: LessonField[];
    status?: LessonStatus;
  };
  awaiting?: keyof SessionData['data'] | null;
  lessonId?: string | null;
  currentLessonId?: string | null;
  lessons?: Lesson[];
  prevPage: string | null;
}

export interface BotContext extends Context {
  session?: SessionData;
  match?: RegExpMatchArray;
}
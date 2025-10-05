import { BotContext, LessonField, SessionData, WordItem } from "./bot.context";

type SessionArrayField = 'listening' | 'reading' | 'vocabulary' | 'test';

// 🔧 Sessionni boshlash
export function initSession(ctx: BotContext) {
  if (!ctx.session) {
    ctx.session = {
      data: {},
      awaiting: null,
      lessonId: null,
      currentLessonId: null,
      prevPage:null,

    };
  }
  if (!ctx.session.data) {
    ctx.session.data = {};
  }
}

// ✅ Session borligini TypeScriptga bildirish
export function assertSession(ctx: BotContext): asserts ctx is BotContext & { session: SessionData } {
  if (!ctx.session) throw new Error("Session not initialized");
}

// 🕐 Awaiting holatini belgilash
export function setAwaiting(ctx: BotContext, field: keyof SessionData['data']) {
  initSession(ctx);
  assertSession(ctx);
  ctx.session.awaiting = field;
}

// ❌ Sessionni tozalash
export function clearSession(ctx: BotContext) {
  ctx.session = {
    data: {},
    awaiting: null,
    lessonId: null,
    currentLessonId: null,
    prevPage: null,
  };
}

// 📥 Faylni sessionga qo‘shish – overload bilan
export function pushResource(
  ctx: BotContext,
  field: 'vocabulary' | 'test',
  fileData: WordItem
): void;

export function pushResource(
  ctx: BotContext,
  field: 'listening' | 'reading' | 'test',
  fileData: LessonField
): void;

export function pushResource(
  ctx: BotContext,
  field: SessionArrayField,
  fileData: LessonField | WordItem
): void {
  initSession(ctx);
  assertSession(ctx);

  if (!ctx.session.data[field]) {
    if (field === 'vocabulary' || field === 'test') {
      ctx.session.data[field] = [] as WordItem[];
    } else {
      ctx.session.data[field] = [] as LessonField[];
    }
  }

  if (field === 'vocabulary') {
    (ctx.session.data[field] as WordItem[]).push(fileData as WordItem);
  } else {
    (ctx.session.data[field] as LessonField[]).push(fileData as LessonField);
  }
}
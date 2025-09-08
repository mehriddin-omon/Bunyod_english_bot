import { BotContext, LessonField, SessionData } from "./bot.context";

export function initSession(ctx: BotContext) {
    if (!ctx.session) {
        ctx.session = {
            data: {},
            awaiting: null,
            lessonId: null
        }
    }
}
export function assertSession(ctx: BotContext): asserts ctx is BotContext & { session: SessionData } {
    if (!ctx.session) throw new Error("Session not initialized");
}

export function setAwaiting(ctx: BotContext, field: keyof SessionData['data']) {
    initSession(ctx);
    assertSession(ctx);
    ctx.session.awaiting = field;
}

export function clearSession(ctx: BotContext) {
    ctx.session = {
        data: {},
        awaiting: null,
        lessonId: null,
        currentLessonId: null,
        // lessons: [],
    }
}

export function pushResource(
  ctx: BotContext,
  field: 'listening' | 'reading' | 'test' | 'word_list',
  fileData: LessonField
) {
  initSession(ctx);       // session yo‘q bo‘lsa, yaratadi
  assertSession(ctx);     // TypeScriptga session borligini bildiradi

  // data maydoni yo‘q bo‘lsa, yaratamiz
  if (!ctx.session.data) {
    ctx.session.data = {};
  }

  // Array maydoni yo‘q bo‘lsa, yaratamiz
  if (!ctx.session.data[field]) {
    ctx.session.data[field] = [];
  }

  // Faylni arrayga qo‘shamiz
  ctx.session.data[field]!.push(fileData);
}


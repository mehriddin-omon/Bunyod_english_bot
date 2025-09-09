import { UseGuards } from '@nestjs/common';
import { Action, Ctx, Hears, On, Update } from 'nestjs-telegraf';
import { AdminGuard } from 'src/common/guard/admin.guard';
import type { BotContext } from 'src/common/utils/bot.context';
import {
  assertSession,
  clearSession,
  initSession,
  pushResource,
  setAwaiting,
} from 'src/common/utils/session.utils';
import { Markup } from 'telegraf';

@Update()
export class LessonCreateCommand {
  @UseGuards(AdminGuard)
  @Hears("➕ Dars qo'shish")
  async startLessonMenu(@Ctx() ctx: BotContext) {
    initSession(ctx);
    await this.showLessonMenu(ctx);
  }

  @Hears("❌ Bekor qilish")
  async cancelLesson(@Ctx() ctx: BotContext) {
    clearSession(ctx);
    await ctx.reply("❌ Dars qo‘shish bekor qilindi.");
  }

  @Hears("📌 Dars nomi")
  async awaitingLessonName(@Ctx() ctx: BotContext) {
    setAwaiting(ctx, 'lesson_name');
    await ctx.reply("📌 Dars nomini kiriting:");
  }

  @Hears("💾 Saqlash")
  async saveLesson(@Ctx() ctx: BotContext) {
    initSession(ctx)
    assertSession(ctx);
    const data = ctx.session.data;

    if (!data.lesson_name?.content) {
      return ctx.reply("❌ Dars nomi kiritilmagan.");
    }

    const lessonPayload = {
      name: data.lesson_name.content,
      listening: data.listening ?? [],
      reading: data.reading ?? [],
      test: data.test ?? [],
      word_list: data.word_list ?? [],
    };

    // TODO: await this.lessonService.createLesson(lessonPayload);
    console.log(" 53-qator lesson createcommand Bazaga saqlanayotgan dars:", lessonPayload);

    clearSession(ctx);
    await ctx.reply("✅ Dars muvaffaqiyatli saqlandi.");
  }

  @Hears("🎧 Listening")
  async awaitingListening(@Ctx() ctx: BotContext) {
    setAwaiting(ctx, 'listening');
    await ctx.reply(
      "🎧 Audio fayl yuboring yoki ➕ tugmasini bosing:",
      Markup.inlineKeyboard(
        // ["➕ Qo‘shish"],
        [
          Markup.button.callback("Saqlash", 'cache_listens'), 
          // "❌ Bekor qilish"
        ],
        // ["Asosiy menu", "Orqaga"],
      )
    );
  }

  @Action('cache_listens')
  async cache_listens(@Ctx() ctx: BotContext){

    console.log('salom');
    
  }

  // @On('text')
  // async handleText(@Ctx() ctx: BotContext) {
  //   console.log('text kelyapti', ctx);

  //   assertSession(ctx);
  //   const awaiting = ctx.session.awaiting;
  //   const text =
  //     ctx.message &&
  //       'text' in ctx.message &&
  //       typeof ctx.message.text === 'string'
  //       ? ctx.message.text
  //       : undefined;

  //   if (!text || !awaiting) return;

  //   if (!ctx.session.data) {
  //     ctx.session.data = {};
  //   }

  //   if (awaiting === 'lesson_name') {
  //     ctx.session.data.lesson_name = {
  //       type: 'text',
  //       content: text,
  //     };
  //     ctx.session.awaiting = null;
  //     await ctx.reply(`📌 Dars nomi saqlandi: ${text}`);
  //     await this.showLessonMenu(ctx);
  //   }
  // }

  @On('message')
  async handleIncomingFile(@Ctx() ctx: BotContext) {
    assertSession(ctx);
    const awaiting = ctx.session.awaiting;
    const message = ctx.message;

    if (!awaiting || !message || !ctx.chat?.id) return;

    // ListeningHandler orqali channelga nusxalangan fayl ID ni olish
    const forwardedMessageId = 'forward_from_message_id' in message
      ? (message as any).forward_from_message_id
      : message.message_id;


    // Fayl turini aniqlash
    let fileData: any = null;

    if ('voice' in message && message.voice?.file_id) {
      fileData = {
        type: 'voice',
        fileId: message.voice.file_id,
        channelMessageId: forwardedMessageId,
      };
    } else if ('audio' in message && message.audio?.file_id) {
      fileData = {
        type: 'audio',
        fileId: message.audio.file_id,
        channelMessageId: forwardedMessageId,
      };
    } else {
      return ctx.reply("❌ Yuborilgan fayl audio formatda emas.");
    }

    pushResource(ctx, awaiting as any, fileData);
    await ctx.reply("✅ Fayl sessionga qo‘shildi.");
  }

  private async showLessonMenu(ctx: BotContext) {
    const data = ctx.session?.data || {};
    await ctx.reply(
      `📌 Dars qo‘shish menyusi:\n\n` +
      `📌 Nomi: ${data.lesson_name?.content || '❌ Yo‘q'}\n` +
      `🎧 Listening: ${data.listening?.length || 0} ta\n` +
      `📖 Reading: ${data.reading?.length || 0} ta\n` +
      `📝 Test: ${data.test?.length || 0} ta\n` +
      `📚 WordList: ${data.word_list?.length || 0} ta`,
      Markup.keyboard([
        ["📌 Dars nomi"],
        [{ text: "🎧 Listening" }, "📖 Reading"],
        ["📝 Test", "📚 WordList"],
        ["💾 Saqlash", "❌ Bekor qilish"],
      ]).resize()
    );
  }
}
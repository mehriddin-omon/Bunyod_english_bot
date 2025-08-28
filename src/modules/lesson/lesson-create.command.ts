import {
  Action,
  Ctx,
  Hears,
  On,
  Update,
} from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { LessonService } from './lesson.service';
import { BotService } from '../bot/bot.service';
import { AdminGuard } from 'src/common/guard/admin.guard';
import type { BotContext } from '../bot/bot.context';
import { ResourceType } from 'src/common/utils/enum';
import { SAVED_TELEGRAM_CHANNEL_ID } from 'src/common/utils/const';
import { UseGuards } from '@nestjs/common';

@Update()
export class LessonCreateCommand {
  constructor(
    private readonly lessonService: LessonService,
  ) { }

  @UseGuards(AdminGuard)
  @Hears("➕ Dars qo'shish")
  async startLessonMenu(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    await this.showLessonMenu(ctx);
  }

  @Action("add_title") async addTitle(@Ctx() ctx: BotContext) {
    return this.awaitField(ctx, "title", "📌 Dars nomini yuboring:");
  }

  @Action("add_listening") async addListening(@Ctx() ctx: BotContext) {
    return this.awaitField(ctx, "listening", "🎧 Audio fayl yuboring:");
  }

  @Action("add_reading") async addReading(@Ctx() ctx: BotContext) {
    return this.awaitField(ctx, "reading", "📖 Reading materialini fayl ko'rinishida yuboring:");
  }

  @Action("add_test") async addTest(@Ctx() ctx: BotContext) {
    return this.awaitField(ctx, "test", "📝 Test fayl yoki matn yuboring:");
  }

  @Action("add_homework") async addHomework(@Ctx() ctx: BotContext) {
    return this.awaitField(ctx, "homework", "📚 Uy vazifasini fayl ko'rinishida yuboring:");
  }

  @On("text")
  async handleText(@Ctx() ctx: BotContext) {
    const field = ctx.session?.awaiting;
    if (!field || !ctx.message || !('text' in ctx.message)) return;

    this.initSession(ctx);
    ctx.session!.data![field] = {
      type: "text",
      content: ctx.message.text,
    };
    ctx.session!.awaiting = null;

    await ctx.reply(`✅ ${field} qo'shildi!`);
    await this.showLessonMenu(ctx);
  }

  @On(["document", "audio", "photo", "video", "voice"])
  async handleFile(@Ctx() ctx: BotContext) {
    const field = ctx.session?.awaiting;
    const message = ctx.message;
    if (!field || !message || !ctx.chat?.id) {
      return ctx.reply("Avval yuqoridagi tugmalar orqali fayl turini tanlang.");
    }

    try {
      const sentMessage = await ctx.telegram.copyMessage(
        SAVED_TELEGRAM_CHANNEL_ID,
        ctx.chat.id,
        message.message_id
      );

      const fileData = this.extractFileData(message, sentMessage.message_id);
      this.initSession(ctx);
      ctx.session!.data![field] = fileData;
      ctx.session!.awaiting = null;

      await ctx.reply(`✅ ${field} fayli qo'shildi va private kanalda saqlandi!`);
      await this.showLessonMenu(ctx);
    } catch (error) {
      console.error('Fayl nusxalashda xatolik:', error);
      await ctx.reply("❌ Fayl saqlashda xatolik yuz berdi.");
    }
  }

  @Action("save_lesson")
  async saveLesson(@Ctx() ctx: BotContext) {
    try {
      const sessionData = ctx.session?.data;
      if (!sessionData?.title || !sessionData?.listening) {
        return ctx.reply("❌ Kamida dars nomi va audio bo'lishi kerak.");
      }

      const title = sessionData.title.content;
      if (!title)
        return ctx.reply("❌ Dars nomi aniqlanmadi.")
      const lesson = await this.lessonService.createLesson(title);

      const resourcePromises = Object.entries(sessionData)
        .filter(([key, value]) =>
          key !== 'title' &&
          value &&
          typeof value === 'object' &&
          typeof value.channelMessageId === 'number'
        )
        .map(([key, value]) => {
          const resourceType = key === 'listening'
            ? ResourceType.AUDIO
            : ResourceType.DOCUMENT;

          return this.lessonService.addLessonFile({
            lessonId: lesson.id,
            channelId: Number(SAVED_TELEGRAM_CHANNEL_ID.replace('@', '')),
            messageId: value.channelMessageId!,
            fileType: resourceType,
          });
        });

      await Promise.all(resourcePromises);
      ctx.session = { data: {}, awaiting: null, lessonId: null };

      if ('callback_query' in ctx.update) {
        await ctx.editMessageText(`✅ "${title}" darsi saqlandi!`);
      } else {
        await ctx.reply(`✅ "${title}" darsi saqlandi!`);
      }
    } catch (error) {
      console.error('Dars saqlashda xatolik:', error);
      await ctx.reply("❌ Dars saqlashda xatolik yuz berdi.");
    }
  }

  @Action("cancel_lesson")
  async cancelLesson(@Ctx() ctx: BotContext) {
    ctx.session = { data: {}, awaiting: null, lessonId: null };
    await ctx.editMessageText("❌ Dars qo'shish bekor qilindi.");
  }

  private initSession(ctx: BotContext) {
    if (!ctx.session) {
      ctx.session = { data: {}, awaiting: null, lessonId: null };
    }
    if (!ctx.session.data) {
      ctx.session.data = {};
    }
  }

  private async awaitField(ctx: BotContext, field: string, prompt: string) {
    this.initSession(ctx);
    ctx.session!.awaiting = field;
    await ctx.reply(prompt);
  }

  private extractFileData(message: BotContext['message'], sentMessageId: number): any {
    if (!message)
      return { type: 'unknown' }

    if ('document' in message) {
      return {
        type: "document",
        fileId: message.document.file_id,
        fileName: message.document.file_name,
        channelMessageId: sentMessageId
      };
    }
    if ('audio' in message) {
      return {
        type: "audio",
        fileId: message.audio.file_id,
        title: message.audio.title,
        channelMessageId: sentMessageId
      };
    }
    if ('photo' in message) {
      return {
        type: "photo",
        fileId: message.photo[message.photo.length - 1].file_id,
        channelMessageId: sentMessageId
      };
    }
    if ('video' in message) {
      return {
        type: "video",
        fileId: message.video.file_id,
        channelMessageId: sentMessageId
      };
    }
    if ('voice' in message) {
      return {
        type: "voice",
        fileId: message.voice.file_id,
        channelMessageId: sentMessageId
      };
    }
    return { type: "unknown" };
  }

  private async showLessonMenu(ctx: BotContext) {
    const data = ctx.session?.data || {};
    let status = "📌 Dars qo'shish menyusi:\n\n";
    status += `📌 Dars nomi : ${data.title ? '✅ ' + data.title.content : '❌ Yo\'q'}\n`;
    status += `🎧 Listening: ${data.listening ? '✅ Qo\'shilgan' : '❌ Yo\'q'}\n`;
    status += `📖 Reading: ${data.reading ? '✅ Qo\'shilgan' : '❌ Yo\'q'}\n`;
    status += `📝 Test: ${data.test ? '✅ Qo\'shilgan' : '❌ Yo\'q'}\n`;
    status += `📚 Homework: ${data.homework ? '✅ Qo\'shilgan' : '❌ Yo\'q'}`;

    await ctx.reply(
      status,
      Markup.inlineKeyboard([
        [Markup.button.callback("📌 Dars nomi", "add_title")],
        [
          Markup.button.callback("📖 Reading", "add_reading"),
          Markup.button.callback("🎧 Listening", "add_listening")
        ],
        [
          Markup.button.callback("📝 Test", "add_test"),
          Markup.button.callback("📚 Homework", "add_homework")
        ],
        [
          Markup.button.callback("❌ Bekor qilish", "cancel_lesson"),
          Markup.button.callback("💾 Saqlash", "save_lesson")
        ]
      ])
    );
  }
}
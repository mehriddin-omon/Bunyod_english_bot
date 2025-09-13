import { UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Action, Ctx, Hears, On, Update } from 'nestjs-telegraf';
import { AdminGuard } from 'src/common/guard/admin.guard';
import type { BotContext } from 'src/common/utils/bot.context';
import { SAVED_TELEGRAM_CHANNEL_ID } from 'src/common/utils/const';
import {
  assertSession,
  clearSession,
  initSession,
  pushResource,
  setAwaiting,
} from 'src/common/utils/session.utils';
import { Markup } from 'telegraf';
import { LessonService } from './lesson.service';
import { WordlistService } from '../wordlist/wordlist.service';
import path from 'path';
import fs from 'fs'
@Update()
export class LessonCreateCommand {
  constructor(
    private readonly lessonService: LessonService,
    private readonly wordlistService: WordlistService,

  ) { }

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
    initSession(ctx);
    assertSession(ctx);

    const data = ctx.session.data;
    const chatId = ctx.chat?.id;

    if (!data.lesson_name?.content) {
      return ctx.reply("❌ Dars nomi kiritilmagan.");
    }

    try {
      // 🔁 Har bir listening faylni channelga nusxalash
      if (data.listening?.length) {
        for (const file of data.listening) {
          if (typeof file.fileId === 'string') {
            const sent = await ctx.telegram.sendVoice(
              SAVED_TELEGRAM_CHANNEL_ID,
              file.fileId,
              {
                caption: `🎧 ${data.lesson_name.content} — Listening`,
              }
            );
            file.channelMessageId = sent.message_id; // 🔐 endi channelda bor
          }
        }
      }
      // 🔁 Har bir reading faylni channelga nusxalash
      if (data.reading?.length) {
        for (const file of data.reading) {
          if (typeof file.fileId === 'string') {
            const sent = await ctx.telegram.sendVoice(
              SAVED_TELEGRAM_CHANNEL_ID,
              file.fileId,
              {
                caption: `📖 ${data.lesson_name.content} — Reading`,
              }
            );
            file.channelMessageId = sent.message_id; // 🔐 endi channelda bor
          }
        }
      }

      //Bazaga saqlash (data ni to‘liq)
      await this.lessonService.saveFullLesson(data)

      clearSession(ctx);
      await ctx.reply("✅ Dars va fayllar muvaffaqiyatli saqlandi.");
    } catch (error) {
      console.error("Saqlashda xatolik:", error);
      await ctx.reply("❌ Saqlashda xatolik yuz berdi.");
    }
  }

  @Hears("🎧 Listening qo'shish")
  async awaitingListening(@Ctx() ctx: BotContext) {
    initSession(ctx);
    setAwaiting(ctx, 'listening');
    await ctx.reply("🎧 Audio fayl yuboring");
  }

  @Hears("📖 Reading qo'shish")
  async awaitingReading(@Ctx() ctx: BotContext) {
    initSession(ctx);
    setAwaiting(ctx, 'reading');
    await ctx.reply("📖 PDF (document) yoki video fayl yuboring");
  }

  @Hears("📚 WordList qo'shish")
  async awaitingWordList(@Ctx() ctx: BotContext) {
    initSession(ctx);
    setAwaiting(ctx, 'word_list');
    await ctx.reply("📚 Word qo‘shing (format: `english - uzbek`), optional: transcription, example, voice.");
  }

  @On('text')
  async handleText(@Ctx() ctx: BotContext) {
    assertSession(ctx);
    const awaiting = ctx.session.awaiting;
    const text =
      ctx.message &&
        'text' in ctx.message &&
        typeof ctx.message.text === 'string'
        ? ctx.message.text
        : undefined;

    if (!text || !awaiting) return;

    if (!ctx.session.data) {
      ctx.session.data = {};
    }

    if (awaiting === 'lesson_name') {
      ctx.session.data.lesson_name = {
        type: 'text',
        content: text,
      };
      ctx.session.awaiting = null;
      await ctx.reply(`📌 Dars nomi saqlandi: ${text}`);
      await this.showLessonMenu(ctx);
    }

    if (awaiting === 'word_list') {
      const { category, words } = await this.wordlistService.parseWordListText(text);

      if (!words.length) {
        return ctx.reply("❌ Format noto‘g‘ri yoki wordlar topilmadi.");
      }

      let savedCount = 0;

      for (const word of words) {
        try {
          const filePath = path.join('./voices', `${word.english}.mp3`);
          await this.wordlistService.generateVoice(word.english, './voices');

          const sent = await ctx.telegram.sendVoice(
            SAVED_TELEGRAM_CHANNEL_ID,
            { source: fs.createReadStream(filePath) },
            { caption: `${word.english} - ${word.uzbek}` }
          );

          const wordItem = {
            type: 'word_list',
            english: word.english,
            uzbek: word.uzbek,
            transcription: word.transcription,
            voice_file_id: sent.voice.file_id,
            message_id: sent.message_id.toString(),
            order_index: Date.now(),
            category,
          };

          if (!ctx.session.data.word_list) {
            ctx.session.data.word_list = [];
          }

          ctx.session.data.word_list.push(wordItem);
          savedCount++;

        } catch (error: any) {
          if (error?.response?.error_code === 429) {
            const retryAfter = error.response.parameters?.retry_after ?? 30;
            await ctx.reply(`⏳ Telegram blokladi. ${savedCount} ta so‘z saqlandi. Qolganlarini keyinroq yuboring.`);
            break;
          } else {
            console.error(`❌ Xatolik: ${word.english}`, error);
          }
        }
      }

      ctx.session.awaiting = null;
      await ctx.reply(`✅ ${words.length} ta word saqlandi (category: ${category})`);
      await this.showLessonMenu(ctx);
    }

  }

  @On('message')
  async handleIncomingFile(@Ctx() ctx: BotContext) {
    assertSession(ctx);
    const awaiting = ctx.session.awaiting;
    const message = ctx.message;

    if (!awaiting || !message || !ctx.chat?.id) return;

    const forwardedMessageId = 'forward_from_message_id' in message
      ? (message as any).forward_from_message_id
      : message.message_id;

    const fileData = this.lessonService.extractMediaData(message, forwardedMessageId);

    // Listening uchun audio yoki video faylni sessionga qo‘shish
    if (
      awaiting === 'listening' &&
      (fileData.type === 'audio' || fileData.type === 'voice' || fileData.type === 'video')
    ) {
      pushResource(ctx, awaiting as any, fileData);
      await ctx.reply(`✅ ${fileData.type === 'video' ? 'Video' : 'Audio'} fayl sessionga qo‘shildi.`);
      return;
    }

    // Reading uchun PDF (document) yoki video faylni sessionga qo‘shish
    if (
      awaiting === 'reading' &&
      (fileData.type === 'document' || fileData.type === 'video')
    ) {
      pushResource(ctx, awaiting as any, fileData);
      await ctx.reply(`✅ ${fileData.type === 'video' ? 'Video' : 'PDF'} fayl sessionga qo‘shildi.`);
      return;
    }

    await ctx.reply("❌ Yuborilgan fayl formatiga mos emas.");
  }

  private async showLessonMenu(ctx: BotContext) {
    const data = ctx.session?.data || {};
    const listening = data.listening || [];
    const audioCount = listening.filter((f: any) => f.type === 'audio' || f.type === 'voice').length;
    const videoCount = listening.filter((f: any) => f.type === 'video').length;
    await ctx.reply(
      `📌 Dars qo‘shish menyusi:\n\n` +
      `📌 Nomi: ${data.lesson_name?.content || '❌ Yo‘q'}\n` +
      `🎧 Listening: ${audioCount} ta audio, ${videoCount} ta video\n` +
      `📖 Reading: ${data.reading?.length || 0} ta\n` +
      `📝 Test: ${data.test?.length || 0} ta\n` +
      `📚 WordList: ${data.word_list?.length || 0} ta`,
      Markup.keyboard([
        ["📌 Dars nomi"],
        ["🎧 Listening qo'shish", "📖 Reading qo'shish"],
        ["📝 Test qo'shish", "📚 WordList qo'shish"],
        ["💾 Saqlash", "❌ Bekor qilish"],
      ]).resize()
    );
  }
}
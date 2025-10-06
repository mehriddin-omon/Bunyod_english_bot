import { Ctx, Hears, On, Update } from 'nestjs-telegraf';
import { UseGuards } from '@nestjs/common';
import { Markup } from 'telegraf';
import path from 'path';
import fs from 'fs';

import { VocabularyService } from '../vocabulary/vocabulary.service';
import { LessonService } from './lesson.service';
// import { TestsService } from '../tests/tests.service';
import {
  type BotContext, AdminGuard, assertSession, clearSession, initSession, pushResource, setAwaiting, SAVED_TELEGRAM_CHANNEL_ID, WordItem,
} from 'src/common';
import { BotService } from '../bot/bot.service';
import { CallbackQuery } from 'telegraf/types';

@Update()
export class LessonCreateCommand {
  constructor(
    private readonly botService: BotService,
    private readonly lessonService: LessonService,
    private readonly vocabularyService: VocabularyService,
    // private readonly testsService: TestsService,
  ) { }

  @UseGuards(AdminGuard)
  @Hears("➕ Lesson create")
  async startLessonMenu(@Ctx() ctx: BotContext) {
    // initSession(ctx);
    await this.showLessonMenu(ctx);
  }

  @Hears("❌ Bekor qilish")
  async cancelLesson(@Ctx() ctx: BotContext) {
    clearSession(ctx);
    const text = "❌ Lesson qo‘shish bekor qilindi.";
    // 🔙 Teacher menyusiga qaytish
    await this.botService.showTeacherMenu(ctx, text);
  }

  @Hears(/^📌 Lesson name$|^📌 Lesson name update$/)
  async awaitingLessonName(@Ctx() ctx: BotContext) {
    setAwaiting(ctx, 'lesson_name');
    await ctx.reply("📌 Lesson name kiriting:");
  }

  @Hears("✅ Saqlash")
  async saveLesson(@Ctx() ctx: BotContext) {

    assertSession(ctx);
    const data = ctx.session.data;
    if (!data.lesson_name?.content) {
      await ctx.reply("❌ Lesson name kiritilmagan.");
      return;
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

      if (data.vocabulary?.length) {
        for (const word of data.vocabulary) {
          try {
            const filePath = path.join('./voices', `${word.english}.mp3`);
            await this.vocabularyService.generateVoice(word.english, './voices');
            const sent = await ctx.telegram.sendVoice(
              SAVED_TELEGRAM_CHANNEL_ID,
              { source: fs.createReadStream(filePath) },
              { caption: `${word.english} - ${word.uzbek}` }
            );

            word.voice_file_id = sent.voice.file_id;
            word.message_id = sent.message_id.toString(); // 🔐 MUHIM QATOR
          } catch (error: any) {
            console.error(`❌ Vocabulary yuborishda xatolik: ${word.english}`, error);
          }
        }
      }

      //Bazaga saqlash (data ni to‘liq)
      await this.lessonService.saveFullLesson(data);

      clearSession(ctx);
      await ctx.reply("✅ Lesson va fayllar muvaffaqiyatli saqlandi.");
    } catch (error) {
      console.error("Saqlashda xatolik:", error);
      await ctx.reply("❌ Saqlashda xatolik yuz berdi.");
    }
  }

  @Hears("🎧 Listening create")
  async awaitingListening(@Ctx() ctx: BotContext) {
    initSession(ctx);
    setAwaiting(ctx, 'listening');
    await ctx.reply("🎧 Audio yoki video fayl yuboring");
  }

  @Hears("📖 Reading create")
  async awaitingReading(@Ctx() ctx: BotContext) {
    initSession(ctx);
    setAwaiting(ctx, 'reading');
    await ctx.reply("📖 PDF (document) yoki video fayl yuboring");
  }

  @Hears("📚 Vocabulary create")
  async awaitingVocabulary(@Ctx() ctx: BotContext) {
    initSession(ctx);
    setAwaiting(ctx, 'vocabulary');
    await ctx.reply("📚 Vocabulary format (format: `english - uzbek`), optional: transcription, example, voice.");
  }

  @Hears("🔄 Update status")
  async updateStatus(@Ctx() ctx: BotContext) {
    assertSession(ctx);

    await ctx.reply(
      "🟢 Lesson statusini tanlang:",
      Markup.inlineKeyboard([
        [Markup.button.callback("📝 Draft", "status_draft")],
        [Markup.button.callback("✅ Published", "status_published")],
        [Markup.button.callback("🗂 Archived", "status_archived")],
      ])
    );
  }

  // Inline tugmalar uchun handler
  @On('callback_query')
  async handleStatusCallback(@Ctx() ctx: BotContext) {
    // GameQuery bo‘lsa, qaytib ketadi
    if (ctx.callbackQuery && 'game_short_name' in ctx.callbackQuery) return;

    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    if (!callbackQuery) return;

    // Faqat "status_" bilan boshlanadigan callbacklarni qayta ishlash
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith('status_')) return;

    assertSession(ctx);
    ctx.session ??= { data: {}, prevPage: null };
    // Statusni sessionga yozish yoki bazaga o‘zgartirish
    const status = data.replace('status_', '');
    if (!ctx.session.data) ctx.session.data = {};
    await this.lessonService.updateLessonStatus(ctx.session.currentLessonId!, status as any);

    await ctx.answerCbQuery(`Status: ${status} tanlandi`);
    await ctx.reply(`✅ Lesson statusi "${status}" ga o‘zgartirildi.`);
  }

  // @Hears("❓ Test create")
  // async awaitingTest(@Ctx() ctx: BotContext) {
  //   initSession(ctx);
  //   setAwaiting(ctx, 'test');
  //   await ctx.reply("📝 Test savollarini yuboring (format: `1. Question?\nA) Option1\nB) Option2\nC) Option3\nD) Option4\nAnswer: A`)")
  // };

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
      await ctx.reply(`📌 Lesson name create: ${text}`);
      await this.showLessonMenu(ctx);
    }

    if (awaiting === 'vocabulary') {
      const { words } = await this.vocabularyService.parseVocabularyText(text);

      if (!words.length) {
        await ctx.reply("❌ Format noto‘g‘ri yoki wordlar topilmadi.");
        return;
      }

      if (!ctx.session.data.vocabulary) {
        ctx.session.data.vocabulary = [];
      }

      for (const word of words) {
        const wordItem: WordItem = {
          type: 'vocabulary',
          english: word.english,
          uzbek: word.uzbek,
          transcription: word.transcription,
          order_index: Date.now(),
        };

        ctx.session.data.vocabulary.push(wordItem);
      }

      ctx.session.awaiting = null;
      await ctx.reply(`✅ ${words.length} ta vocabulary sessionga saqlandi.`);
      await this.showLessonMenu(ctx);
    }

    // if (awaiting === 'test') {
    //   try {
    //     const parsed = await this.testsService.parseTestToJson(text);

    //     if (!parsed.length) {
    //       await ctx.reply("❌ Test savollari topilmadi yoki format noto‘g‘ri.");
    //       return;
    //     }

    //     // ctx.session.data.test = parsed;
    //     ctx.session.awaiting = null;

    //     await ctx.reply(`✅ ${parsed.length} ta test savol sessionga saqlandi.`);
    //     await this.showLessonMenu(ctx);
    //   } catch (error) {
    //     console.error("❌ Test parsingda xatolik:", error);
    //     await ctx.reply("❌ Test parsingda xatolik yuz berdi.");
    //   }
    // }

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
      pushResource(ctx, awaiting, fileData);
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
    const audioCount = listening.filter((f: any) => {
      f.type === 'audio' || f.type === 'voice'
    }).length;
    const videoCount = listening.filter((f: any) => f.type === 'video').length;
    await ctx.reply(
      `📌 Lesson create menyu:\n\n` +
      `📌 Name: ${data.lesson_name?.content || '❌ Yo‘q'}\n` +
      `🎧 Listening: ${audioCount} audio, ${videoCount} video\n` +
      `📖 Reading: ${data.reading?.length || 0}\n` +
      `❓ Test: ${data.test?.length || 0}\n` +
      `📚 Vocabulary: ${data.vocabulary?.length || 0}`,
      Markup.keyboard([
        ["📌 Lesson name"],
        ["🎧 Listening create", "📖 Reading create"],
        ["📓 Grammar create", "Vocabulary create"],
        ["📚 Grammar Test create", " Vocabulary test create"],
        ["✅ Saqlash", "❌ Bekor qilish"],
      ]).resize()
    );
  }
}
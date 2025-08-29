import {
  Ctx,
  Hears,
  Update,
} from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { LessonService } from './lesson.service';
import type { BotContext } from '../bot/bot.context';
import { ResourceType } from 'src/common/utils/enum';
import { log } from 'console';

@Update()
export class LessonViewCommand {
  constructor(private readonly lessonService: LessonService) { }

  @Hears("📚 Darslar")
  async showLessons(@Ctx() ctx: BotContext) {
    const lessons = await this.lessonService.getAllLessons();
    if (lessons.length === 0) {
      return ctx.reply("📚 Hali darslar mavjud emas.");
    }

    const keyboard = lessons.map((lesson, index) => {
      const unitNumber = index + 1;
      return [`📗 Unit ${unitNumber}`];
    });

    keyboard.push(["⬅️ Asosiy menyu"]);
    ctx.session ??= {}
    ctx.session.lessons = lessons;

    await ctx.reply("📚 Mavjud darslar:",
      Markup.keyboard(keyboard).resize()
    );
  }

  @Hears(/^📗 Unit (\d+)$/)
async selectLesson(@Ctx() ctx: BotContext) {
  if (!ctx.match || !ctx.match[1]) {
    await ctx.reply('Unit raqami topilmadi.');
    return;
  }

  const unitNumber = parseInt(ctx.match[1], 10);
  ctx.session ??= {};

  const lessons = ctx.session.lessons ?? await this.lessonService.getAllLessons();
  const baseLesson = lessons[unitNumber - 1];

  if (!baseLesson) return ctx.reply("❌ Dars topilmadi.");

  const lesson = await this.lessonService.getLessonWithResources(baseLesson.id);
  if (!lesson) return ctx.reply("❌ Dars topilmadi.");

  ctx.session.currentLessonId = lesson.id;

  let message = `📖 ${lesson.title}\n\n`;
  if (lesson.resources?.length) {
    message += "📎 Materiallar:\n";
    for (const resource of lesson.resources) {
      message += `${this.getResourceEmoji(resource.type)} ${resource.type}\n`;
    }
console.log(lesson);

    const keyboard = lesson.resources.map(resource => {
      return [`${this.getResourceEmoji(resource.type)} ${resource.type}`];
    });

    keyboard.push(["🔙 Orqaga"]);

    await ctx.reply(message, Markup.keyboard(keyboard).resize());
  } else {
    await ctx.reply(message + "❌ Bu darsda materiallar mavjud emas.", 
      Markup.keyboard([["🔙 Orqaga"]]).resize());
  }
}

  @Hears(/^🎧 AUDIO$|^📄 PDF$|^📋 DOCUMENT$|^📎 .*$/)
  async sendLessonResource(@Ctx() ctx: BotContext) {
    ctx.session ??= {}
    const lessonId = ctx.session.currentLessonId;
    if (!lessonId) return ctx.reply("❌ Dars tanlanmagan.");

    let typeText = '';
    if (ctx.message && 'text' in ctx.message) {
      typeText = ctx.message.text.trim();
    }

    const type = this.getResourceTypeFromText(typeText);
    if (!type) return ctx.reply("❌ Noto‘g‘ri material turi.");

    const resource = await this.lessonService.getResourceByLessonId(lessonId, type);
    if (!resource) return ctx.reply(`❌ ${type} materiali mavjud emas.`);

    try {
      await ctx.telegram.copyMessage(
        ctx.chat!.id,
        resource.channelId,
        resource.messageId
      );
    } catch (error) {
      console.error(`Resurs yuborishda xatolik (${resource.id}):`, error);
      await ctx.reply(`❌ ${type} materiali yuborilmadi.`);
    }
  }

  @Hears("🔙 Orqaga")
  async backToLessons(@Ctx() ctx: BotContext) {
    return this.showLessons(ctx);
  }

  @Hears("⬅️ Asosiy menyu")
  async backToMain(@Ctx() ctx: BotContext) {
    await ctx.reply("🏠 Asosiy menyu:", Markup.keyboard([
      ["📚 Darslar"],
      ["ℹ️ Yordam"]
    ]).resize()
    );
  }

  private getResourceEmoji(type: ResourceType): string {
    switch (type) {
      case ResourceType.AUDIO: return "🎧";
      case ResourceType.PDF: return "📄";
      case ResourceType.DOCUMENT: return "📋";
      default: return "📎";
    }
  }

  private getResourceTypeFromText(text: string): ResourceType | null {
    if (text.includes("AUDIO")) return ResourceType.AUDIO;
    if (text.includes("PDF")) return ResourceType.PDF;
    if (text.includes("DOCUMENT")) return ResourceType.DOCUMENT;
    return null;
  }
}
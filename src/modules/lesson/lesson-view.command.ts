import {
  Action,
  Ctx,
  Hears,
  Update,
} from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { LessonService } from './lesson.service';
import type { BotContext } from '../bot/bot.context';
import { ResourceType } from 'src/common/utils/enum';

@Update()
export class LessonViewCommand {
  constructor(private readonly lessonService: LessonService) {}

  @Hears("📚 Darslar")
  async showLessons(@Ctx() ctx: BotContext) {
    const lessons = await this.lessonService.getAllLessons();
    if (lessons.length === 0) {
      return ctx.reply("📚 Hali darslar mavjud emas.");
    }

    const keyboard = lessons.map(lesson =>
      [Markup.button.callback(lesson.title, `lesson_${lesson.id}`)]
    );

    await ctx.reply("📚 Mavjud darslar:", Markup.inlineKeyboard(keyboard));
  }

  @Action(/lesson_(\d+)/)
  async selectLesson(@Ctx() ctx: BotContext) {
    if (!ctx.match || !ctx.match[1]) return ctx.reply("❌ Xatolik yuz berdi.");

    const lessonId = parseInt(ctx.match[1]);
    const lesson = await this.lessonService.getLessonWithResources(lessonId);
    if (!lesson) return ctx.reply("❌ Dars topilmadi.");

    let message = `📖 ${lesson.title}\n\n`;
    if (lesson.resources?.length) {
      message += "📎 Materiallar:\n";
      for (const resource of lesson.resources) {
        message += `${this.getResourceEmoji(resource.type)} ${resource.type}\n`;
      }

      await ctx.reply(message, Markup.inlineKeyboard([
        [Markup.button.callback("📥 Materiallarni olish", `get_resources_${lessonId}`)],
        [Markup.button.callback("🔙 Orqaga", "back_to_lessons")]
      ]));
    } else {
      await ctx.reply(message + "❌ Bu darsda materiallar mavjud emas.", Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Orqaga", "back_to_lessons")]
      ]));
    }
  }

  @Action(/get_resources_(\d+)/)
  async sendLessonResources(@Ctx() ctx: BotContext) {
    if (!ctx.match || !ctx.match[1]) return ctx.reply("❌ Xatolik yuz berdi.");

    const lessonId = parseInt(ctx.match[1]);
    const lesson = await this.lessonService.getLessonWithResources(lessonId);
    if (!lesson?.resources?.length) {
      return ctx.reply("❌ Bu darsda materiallar mavjud emas.");
    }

    await ctx.reply(`📚 ${lesson.title} darsi materiallari:`);
    for (const resource of lesson.resources) {
      try {
        await ctx.telegram.copyMessage(
          ctx.chat!.id,
          resource.channelId,
          resource.messageId
        );
      } catch (error) {
        console.error(`Resurs yuborishda xatolik (${resource.id}):`, error);
        await ctx.reply(`❌ ${resource.type} materiali yuborilmadi.`);
      }
    }
  }

  @Action("back_to_lessons")
  async backToLessons(@Ctx() ctx: BotContext) {
    await ctx.deleteMessage();
    return this.showLessons(ctx);
  }

  private getResourceEmoji(type: ResourceType): string {
    switch (type) {
      case ResourceType.AUDIO:
        return "🎧";
      case ResourceType.PDF:
        return "📄";
      case ResourceType.DOCUMENT:
        return "📋";
      default:
        return "📎";
    }
  }
}
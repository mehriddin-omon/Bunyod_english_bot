import { UseGuards } from '@nestjs/common';
import { Ctx, Hears, Update } from 'nestjs-telegraf';
import { AdminGuard } from 'src/common/guard/admin.guard';
import type { BotContext } from 'src/common/utils/bot.context';
import { clearSession, initSession, setAwaiting } from 'src/common/utils/session.utils';
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
        ["🎧 Listening", "📖 Reading"],
        ["📝 Test", "📚 WordList"],
        ["💾 Saqlash", "❌ Bekor qilish"]
      ]).resize()
    );
  }
}
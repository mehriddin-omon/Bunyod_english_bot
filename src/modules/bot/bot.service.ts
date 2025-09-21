import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Injectable, Logger } from '@nestjs/common';

import { UserService } from 'src/modules/user/user.service';
import { CHANNEL_URL, TELEGRAM_CHANNEL_ID, TEACHER_ID } from 'src/common/utils/const';
import { BotContext } from '../../common/utils/bot.context';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly userService: UserService,
  ) { }

  async sendStartMessage(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId)
      return ctx.reply('❌ Foydalanuvchi aniqlanmadi.');

    const isMember = await this.checkChannelMembership(userId);
    if (!isMember)
      return this.askToJoinChannel(ctx);

    await this.userService.createOrUpdateFromTelegram(ctx.from);
    const role = await this.resolveUserRole(userId);

    return await this.showMenuByRole(ctx, role);
  }

  async confirmMembership(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) return ctx.reply('❌ Foydalanuvchi aniqlanmadi.');

    const isMember = await this.checkChannelMembership(userId);
    if (!isMember) {
      return await ctx.reply("❌ Siz hali kanalga a'zo bo'lmadingiz.", {
        reply_markup: {
          inline_keyboard: [[{ text: "📢 Kanalga qo'shilish", url: CHANNEL_URL }]],
        },
      });
    }

    await this.userService.createOrUpdateFromTelegram(ctx.from);
    const role = await this.resolveUserRole(userId);
    await this.showMenuByRole(ctx, role);
  }

  private async resolveUserRole(userId: number): Promise<'admin' | 'teacher' | 'student'> {
    const roleFromDb = await this.userService.getRole(userId);
    if (roleFromDb === 'admin') return roleFromDb;

    // fallback: agar bazada yo‘q bo‘lsa, TEACHER_ID ro‘yxatidan tekshiramiz
    if (TEACHER_ID.includes(userId)) return 'teacher';

    return 'student';
  }

  private async showMenuByRole(ctx: BotContext, role: 'admin' | 'teacher' | 'student') {
    if (role === 'admin' || role === 'teacher') {
      return await this.showTeacherMenu(ctx, "👨‍🏫 Xush kelibsiz ustoz! Amallarni tanlang 👇");
    }
    return await this.showStudentMenu(ctx);
  }

  async showTeacherMenu(ctx: BotContext, text: string) {
    await ctx.reply(text, Markup.keyboard([
      ["➕ Dars qo'shish", "📚 Darslar ro'yxati"],
      ["📊 Statistika", "⚙️ Sozlamalar"],
    ]).resize());
  }

  async showStudentMenu(ctx: BotContext) {
    const user = await this.userService.findByTelegramId(ctx.from?.id);
    const name = (user) ? user.fullName : 'Foydalanuvchi';
    await ctx.reply(`👋 Hurmatli ${name}, xush kelibsiz!`, {
      reply_markup: {
        keyboard: [["📚 Darslar"], ["ℹ️ Yordam"]],
        resize_keyboard: true,
      },
    });
  }

  private async askToJoinChannel(ctx: BotContext) {
    return ctx.reply(
      "Assalomu alaykum! Botdan foydalanish uchun kanalga qo'shiling 👇",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Kanalga qo'shilish", url: CHANNEL_URL }],
            [{ text: "✅ Tasdiqlash", callback_data: 'check_membership' }],
          ],
        },
      }
    );
  }

  async checkChannelMembership(userId: number): Promise<boolean> {
    try {
      const member = await this.bot.telegram.getChatMember(TELEGRAM_CHANNEL_ID, userId);
      return member.status !== 'left' && member.status !== 'kicked';
    } catch (error) {
      this.logger.warn(`Channel check failed for user ${userId}: ${error?.message || error}`);
      return false;
    }
  }
}
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Injectable, Logger } from '@nestjs/common';

import { UserService } from 'src/modules/user/user.service';
import { GROUP_URL, TELEGRAM_GROUP_ID, TEACHER_ID } from 'src/common/utils/const';
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
    if (!userId) {
      await ctx.reply('❌ Foydalanuvchi aniqlanmadi.');
      return;
    }

    const isMember = await this.checkGroupMembership(userId);
    if (!isMember)
      return this.askToJoinGroup(ctx);

    await this.userService.createOrUpdateFromTelegram(ctx.from);
    const role = await this.resolveUserRole(userId);

    return await this.showMenuByRole(ctx, role);
  }

  async confirmMembership(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Foydalanuvchi aniqlanmadi.');
      return;
    }

    const isMember = await this.checkGroupMembership(userId);
    if (!isMember) {
      await ctx.reply("❌ Siz hali guruhga a'zo bo'lmadingiz.",
        // {
        //   reply_markup: {
        //     inline_keyboard: [[{ text: "📢 Guruhga qo'shilish", url: GROUP_URL }]],
        //   },
        // }
      );
      return;
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
      ["➕ Lesson create", "📚 Lessons list"],
      ["📊 Statistika", "⚙️ Params"],
    ]).resize());
  }

  async showStudentMenu(ctx: BotContext) {
    const user = await this.userService.findByTelegramId(ctx.from?.id);
    const name = (user) ? user.fullName : 'Foydalanuvchi';
    await ctx.reply(`👋 Hurmatli ${name}, asosiy menudasiz!!`, {
      reply_markup: {
        keyboard: [["📚 Lessons"], ["ℹ️ Help"]],
        resize_keyboard: true,
      },
    });
  }

  private async askToJoinGroup(ctx: BotContext) {
    await ctx.reply(
      "Assalomu alaykum! Botdan foydalanish uchun guruhga qo'shiling 👇",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "👥 Guruhga qo'shilish", url: GROUP_URL }],
            [{ text: "✅ Tasdiqlash", callback_data: 'check_membership' }],
          ],
        },
      }
    );
  }

  async checkChannelMembership(userId: number): Promise<boolean> {
    try {
      const member = await this.bot.telegram.getChatMember(TELEGRAM_GROUP_ID, userId);
      return member.status !== 'left' && member.status !== 'kicked';
    } catch (error: any) {
      this.logger.warn(`Channel check failed for user ${userId}: ${error.message || error}`);
      return false;
    }
  }

  async checkGroupMembership(userId: number): Promise<boolean> {
    try {
      const member = await this.bot.telegram.getChatMember(TELEGRAM_GROUP_ID, userId);
      return member.status !== 'left' && member.status !== 'kicked';
    } catch (error: any) {
      this.logger.warn(`Group check failed for user ${userId}: ${error.message || error}`);
      return false;
    }
  }
}
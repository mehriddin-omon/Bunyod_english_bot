import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { Injectable, Logger } from '@nestjs/common';

import { UserService } from 'src/modules/user/user.service';
import { CHANNEL_URL, TELEGRAM_CHANNEL_ID } from 'src/common/utils/const';
import { BotContext } from './bot.context';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly userService: UserService,
  ) {}

  async sendStartMessage(ctx: BotContext) {
    console.log('start');
    const userId = ctx.from?.id;
    if (!userId) return ctx.reply('Foydalanuvchi topilmadi');

    const isMember = await this.checkChannelMembership(userId);
    if (!isMember) {
      return ctx.reply(
        "Assalomu alaykum! Botdan foydalanish uchun kanalga qo'shiling 👇",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📢 Kanalga qo'shilish", url: CHANNEL_URL }],
              [{ text: "✅ Tasdiqlash", callback_data: 'check_membership' }],
            ],
          },
        },
      );
    }

    await this.userService.createOrUpdateFromTelegram(ctx.from);
    const role = await this.userService.getRole(userId);
    return role === 'admin' ? this.showTeacherMenu(ctx) : this.showStudentMenu(ctx);
  }

  async confirmMembership(ctx: BotContext) {
    const userId = ctx.from?.id;
    if (!userId) return ctx.reply('Foydalanuvchi topilmadi');

    const isMember = await this.checkChannelMembership(userId);
    if (!isMember) {
      return ctx.reply("❌ Siz hali kanalga a'zo bo'lmadingiz.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Kanalga qo'shilish", url: CHANNEL_URL }],
          ],
        },
      });
    }

    await this.userService.createOrUpdateFromTelegram(ctx.from);
    const role = await this.userService.getRole(userId);
    return role === 'admin' ? this.showTeacherMenu(ctx) : this.showStudentMenu(ctx);
  }

  async showTeacherMenu(ctx: BotContext) {
    return ctx.reply("Xush kelibsiz ustoz! Amallarni tanlang 👇", {
      reply_markup: {
        keyboard: [
          ["➕ Dars qo'shish"],
          ["📚 Darslar"],
        ],
        resize_keyboard: true,
      },
    });
  }

  async showStudentMenu(ctx: BotContext) {
    const user = await this.userService.findByTelegramId(ctx.from?.id);
    if (!user) return;
    return ctx.reply(`Hurmatli ${user.fullName}, xush kelibsiz!`, {
      reply_markup: {
        keyboard: [["📚 Darslar"]],
        resize_keyboard: true,
      },
    });
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
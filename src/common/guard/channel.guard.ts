import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Context as TelegrafContext } from 'telegraf';
import { CHANNEL_URL, TELEGRAM_CHANNEL_ID } from '../utils/const';

@Injectable()
export class ChannelGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp().getRequest<TelegrafContext>();
    const userId = ctx.from?.id;

    if (!userId) {
      console.warn('ChannelGuard: ctx.from.id yo‘q');
      return true;
    }

    try {
      const member = await ctx.telegram.getChatMember(TELEGRAM_CHANNEL_ID, userId);

      if (['creator', 'administrator', 'member'].includes(member.status)) {
        return true;
      }

      await ctx.reply("Botdan foydalanish uchun kanalga a'zo bo‘ling 👇", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔗 Kanalga o‘tish", url: CHANNEL_URL }],
            [{ text: "✅ Tasdiqlash", callback_data: 'check_membership' }],
          ],
        },
      });

      return false;
    } catch (err) {
      console.error('ChannelGuard xatolik:', err.message);
      await ctx.reply("❌ Kanalga a’zolikni tekshirishda xatolik yuz berdi.");
      return false;
    }
  }
}
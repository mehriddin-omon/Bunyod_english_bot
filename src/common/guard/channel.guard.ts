import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Context as TelegrafContext } from 'telegraf';
import { TELEGRAM_GROUP_ID } from '../utils/const';

@Injectable()
export class ChannelGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp().getRequest<TelegrafContext>();
    const userId = ctx.from?.id;

    if (!userId) {
      console.warn('ChannelGuard: ctx.from.id yo‘q');
      throw new ForbiddenException('Foydalanuvchi topilmadi')
    }

    try {
      const member = await ctx.telegram.getChatMember(TELEGRAM_GROUP_ID, userId);

      if (['creator', 'administrator', 'member'].includes(member.status)) {
        return true;
      }
      ctx.state.needMembershipReply = true;
      return false;
      
    } catch (err: any) {
      console.error('ChannelGuard xatolik:', err.message);
      await ctx.reply("❌ Kanalga a’zolikni tekshirishda xatolik yuz berdi.");
      return false;
    }
  }
}
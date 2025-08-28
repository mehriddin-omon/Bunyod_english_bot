// src/common/guards/channel.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Context as TelegrafContext } from 'telegraf';
import { Reflector } from '@nestjs/core';
import { CHANNEL_URL, TELEGRAM_CHANNEL_ID } from '../utils/const';

@Injectable()
export class ChannelGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafContext = context.switchToHttp().getRequest<TelegrafContext>();
    const userId = telegrafContext.from?.id;

    if (!userId) {
      return true;
    }

    try {
      const member = await telegrafContext.telegram.getChatMember(TELEGRAM_CHANNEL_ID, userId);

      if (['creator', 'administrator', 'member'].includes(member.status)) {
        return true; //a'zo bo'lsa handlerga o'tkazadi 
      }

      await telegrafContext.reply("Botdan foydalanish uchun kanalga a'zo bo'ling 👇", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔗 Kanalga o‘tish", url: CHANNEL_URL }],
          ],
        },
      });
      return true; // faqat a'zo bo'lmaganda to'xtatiladi 
    } catch (err) {
      console.error('Guard error >>>', err.message);
      await telegrafContext.reply("Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.");
      return true;
    }
  }
}

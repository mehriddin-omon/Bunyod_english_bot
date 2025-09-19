import { Ctx, Start, Action, Update } from 'nestjs-telegraf';
import type { BotContext } from '../../common/utils/bot.context';
import { BotService } from './bot.service';
import { CHANNEL_URL } from 'src/common/utils/const';

@Update()
export class BotUpdate {
  constructor(private readonly botService: BotService) { }

  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    if (ctx.state.needMembershipReply) {
      await ctx.reply("Botdan foydalanish uchun kanalga a'zo bo‘ling 👇", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔗 Kanalga o‘tish", url: CHANNEL_URL }],
            [{ text: "✅ Tasdiqlash", callback_data: 'check_membership' }],
          ],
        },
      });
      return;

    }
    await this.botService.sendStartMessage(ctx);
  }

  @Action('check_membership')
  async checkMembership(@Ctx() ctx: BotContext) {
    return this.botService.confirmMembership(ctx);
  }
}
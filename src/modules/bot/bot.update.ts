import { Ctx, Start, Action, Update } from 'nestjs-telegraf';
import type { BotContext } from './bot.context';
import { BotService } from './bot.service';

@Update()
export class BotUpdate {
  constructor(private readonly botService: BotService) {}

  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    return this.botService.sendStartMessage(ctx);
  }

  @Action('check_membership')
  async checkMembership(@Ctx() ctx: BotContext) {
    console.log('object chiqadi');
    
    return this.botService.confirmMembership(ctx);
  }
}
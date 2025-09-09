// import { Action, Ctx, On, Update } from 'nestjs-telegraf';
// import { Markup } from 'telegraf';
// import { SAVED_TELEGRAM_CHANNEL_ID } from 'src/common/utils/const';
// import type { BotContext } from 'src/common/utils/bot.context';
// import { ListeningService } from './listening.service';
// import { assertSession, initSession, pushResource, setAwaiting } from 'src/common/utils/session.utils';

// @Update()
// export class ListeningHandler {
//   constructor(private readonly listeningService: ListeningService) {}

//   @Action('add_listening')
//   async showListeningMenu(@Ctx() ctx: BotContext) {
//     initSession(ctx);
//     setAwaiting(ctx, 'listening');
//     await ctx.reply(
//       '🎧 Audio fayl yuboring yoki + tugmasini bosing:',
//       Markup.inlineKeyboard([
//         [Markup.button.callback("➕ Qo'shish", 'add_listening_file')],
//         [Markup.button.callback('💾 Saqlash', 'save_lesson')],
//         [Markup.button.callback('❌ Bekor qilish', 'cancel_lesson')],
//       ])
//     );
//   }

//   @Action('add_listening_file')
//   async awaitListeningFile(@Ctx() ctx: BotContext) {
//     initSession(ctx);
//     setAwaiting(ctx, 'listening');
//     await ctx.reply('🎧 Audio fayl yuboring:');
//   }

//   @On(['audio', 'voice'])
//   async handleListeningFile(@Ctx() ctx: BotContext) {
//     initSession(ctx);
//     const field = ctx.session?.awaiting;
//     const message = ctx.message;
//     if (field !== 'listening' || !message || !ctx.chat?.id) return;

//     try {
//       const sentMessage = await ctx.telegram.copyMessage(
//         SAVED_TELEGRAM_CHANNEL_ID,
//         ctx.chat.id,
//         message.message_id
//       );

//       // const fileData = this.listeningService.extractAudioData(message, sentMessage.message_id);

//       // pushResource(ctx, 'listening', fileData);

//       initSession(ctx);
//       assertSession(ctx)
//       ctx.session.awaiting = null;

//       await ctx.reply('✅ Audio fayl qo‘shildi!');
//       await this.showListeningMenu(ctx);
//     } catch (error) {
//       console.error('Audio saqlashda xatolik:', error);
//       await ctx.reply('❌ Fayl saqlashda xatolik yuz berdi.');
//     }
//   }
// }
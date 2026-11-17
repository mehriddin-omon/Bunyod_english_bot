import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import type { User as TgUser } from 'telegraf/types';
import { TelegramAuthService, TelegramFrom } from './telegram-auth.service';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=uz.lenguara.app';

const MSG = {
  askContact: (name: string) =>
    `Assalomu alaykum, ${name}! 👋\n\n` +
    'DinoEnglish — ingliz tilini o\'rganish ilovasi.\n\n' +
    "Ro'yxatdan o'tish uchun pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing. " +
    'Raqamingiz faqat sizni tanish va akkauntingizni tiklash uchun ishlatiladi.',
  contactButton: '📱 Telefon raqamni yuborish',
  confirmed: (name: string) =>
    `✅ ${name}, kirish tasdiqlandi!\n\n` +
    "Endi DinoEnglish ilovasiga QAYTING (telefondagi «orqaga» tugmasi yoki ochiq ilovalar ro'yxati) — " +
    "u sizni o'zi kiritadi. Ilovani Play Market orqali qayta ochmang: kutib turgan kirish uziladi.",
  registered: (name: string) =>
    `✅ Rahmat, ${name}! Ro'yxatdan o'tdingiz.\n\n` +
    "DinoEnglish ilovasida «Telegram orqali kirish» tugmasini bosing.",
  welcomeBack: (name: string) =>
    `Xush kelibsiz, ${name}! 👋\n\n` +
    "Ilovaga kirish uchun DinoEnglish'da «Telegram orqali kirish» tugmasini bosing.",
  appButton: '📲 Ilovani ochish',
  expired: "⏳ Bu havolaning muddati tugagan. Ilovada «Telegram orqali kirish» tugmasini qayta bosing.",
  invalid: "Havola noto'g'ri. Ilovadan qaytadan urinib ko'ring.",
  notOwn: "Iltimos, boshqa odamning emas, o'zingizning raqamingizni pastdagi tugma orqali yuboring.",
  blocked: "Hisobingiz bloklangan. O'qituvchingizga murojaat qiling.",
  error: "Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
  help:
    "Bu bot DinoEnglish ilovasiga kirish va ro'yxatdan o'tish uchun.\n\n" +
    "/start — ro'yxatdan o'tish",
};

/**
 * DinoEnglish Telegram boti (telegraf, long polling) — API jarayoni ichida ishlaydi.
 * Bot nomi (@...) tokendan `getMe()` bilan o'zi aniqlanadi — kodda yozilmaydi.
 * `.env`: DINOENGLISH_BOT_TOKEN (berilmasa bot o'chiq, qolgan API ishlayveradi),
 * DINOENGLISH_BOT_POLLING=false — tokenni bilib turib pollingni o'chirish (masalan lokal dev
 * production bilan bir botni talashmasin: Telegram bitta bot uchun bitta poller'ga ruxsat beradi).
 * Backend BITTA PM2 jarayonida ishlashi shart.
 */
@Injectable()
export class DinoEnglishBotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(DinoEnglishBotService.name);
  private bot?: Telegraf;

  constructor(private readonly auth: TelegramAuthService) {}

  async onApplicationBootstrap() {
    const token = process.env.DINOENGLISH_BOT_TOKEN?.trim();
    if (!token || process.env.NODE_ENV === 'test') {
      this.log.warn("DINOENGLISH_BOT_TOKEN berilmagan — Telegram orqali kirish o'chiq");
      return;
    }
    const bot = new Telegraf(token);

    try {
      const me = await bot.telegram.getMe();
      this.auth.setBotUsername(me.username);
    } catch (err) {
      this.log.error(`Telegram'ga ulanib bo'lmadi (token to'g'rimi?): ${String(err)}`);
      return;
    }

    // Profil rasmi: eng katta o'lchamdagi birinchi rasm
    this.auth.photoFetcher = async (telegramId) => {
      const photos = await bot.telegram.getUserProfilePhotos(telegramId, 0, 1);
      const sizes = photos.photos[0];
      if (!sizes?.length) return null;
      const link = await bot.telegram.getFileLink(sizes[sizes.length - 1].file_id);
      const res = await fetch(link.toString());
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    };

    // Qiymat .env dan bo'shliq/CR bilan kelishi mumkin — qat'iy solishtirilmaydi
    const polling = (process.env.DINOENGLISH_BOT_POLLING ?? '').trim().toLowerCase();
    if (polling === 'false' || polling === '0' || polling === 'no') {
      this.log.warn(
        `DINOENGLISH_BOT_POLLING=${polling} — @${bot.botInfo?.username ?? ''} xabarlarni tinglamaydi ` +
          '(kirish oqimi serverdagi bot orqali ishlaydi)',
      );
      return;
    }

    this.bot = bot;
    this.register(bot);
    bot.catch((err) => this.log.error(`Bot xatosi: ${String(err)}`));
    await bot.telegram
      .setMyCommands([{ command: 'start', description: "Ro'yxatdan o'tish / ilovaga kirish" }])
      .catch(() => undefined);

    // launch() bot to'xtaguncha resolve bo'lmaydi — kutmaymiz
    void bot
      .launch({ dropPendingUpdates: true, allowedUpdates: ['message'] }, () =>
        this.log.log(`Telegram bot ishga tushdi: @${bot.botInfo?.username ?? ''}`),
      )
      .catch((err: unknown) => this.log.error(`Bot ishga tushmadi: ${String(err)}`));
  }

  onModuleDestroy() {
    try {
      this.bot?.stop('shutdown');
    } catch {
      // ishga tushmagan bo'lsa
    }
  }

  private register(bot: Telegraf) {
    bot.start(async (ctx) => {
      const from = ctx.from;
      const payload = (ctx.payload ?? '').trim();
      await this.safe(ctx, async () => {
        // Ilovadagi «Telegram orqali kirish» tugmasidan kelgan
        if (payload.startsWith('login_')) {
          const result = await this.auth.handleStart(payload.slice(6), ctx.chat.id, fromOf(from));
          if (result === 'confirmed') await this.replyConfirmed(ctx, from.first_name);
          else if (result === 'need_contact') await this.askContact(ctx, from);
          else if (result === 'blocked') await ctx.reply(MSG.blocked);
          else if (result === 'expired') await ctx.reply(MSG.expired);
          else await ctx.reply(MSG.invalid);
          return;
        }
        // Botga to'g'ridan-to'g'ri kirgan
        const user = await this.auth.findRegistered(fromOf(from));
        if (user) await this.replyWithApp(ctx, MSG.welcomeBack(user.firstName || from.first_name));
        else await this.askContact(ctx, from);
      });
    });

    bot.help((ctx) => ctx.reply(MSG.help));

    bot.on('contact', async (ctx) => {
      const c = ctx.message.contact;
      await this.safe(ctx, async () => {
        const result = await this.auth.handleContact(ctx.chat.id, fromOf(ctx.from), {
          userId: c.user_id,
          phone: c.phone_number,
        });
        if (result === 'not_own') {
          await ctx.reply(MSG.notOwn);
          return;
        }
        await ctx.reply(result === 'blocked' ? MSG.blocked : '👌', Markup.removeKeyboard());
        if (result === 'confirmed') await this.replyConfirmed(ctx, ctx.from.first_name);
        else if (result === 'registered') await this.replyWithApp(ctx, MSG.registered(ctx.from.first_name));
      });
    });

    // Boshqa har qanday xabar — yo'riqnoma
    bot.on('message', async (ctx) => {
      await this.safe(ctx, async () => {
        const user = await this.auth.findRegistered(fromOf(ctx.from));
        if (user) await this.replyWithApp(ctx, MSG.welcomeBack(user.firstName || ctx.from.first_name));
        else await this.askContact(ctx, ctx.from);
      });
    });
  }

  private askContact(ctx: Context, from: TgUser) {
    return ctx.reply(
      MSG.askContact(from.first_name),
      Markup.keyboard([Markup.button.contactRequest(MSG.contactButton)]).resize().oneTime(),
    );
  }

  /**
   * Tasdiqlangandan keyin Play Market tugmasi QO'YILMAYDI: u ilovani Do'kon orqali qayta ochadi,
   * natijada ilova sovuq ishga tushib, kutib turgan kirish so'rovi yo'qoladi va foydalanuvchi
   * «Vaqt tugadi» ni ko'radi. Foydalanuvchi ilovaga o'zi qaytadi — ilova qaytishi bilan tekshiradi.
   */
  private replyConfirmed(ctx: Context, name: string) {
    return ctx.reply(MSG.confirmed(name));
  }

  /** «Ilovani ochish» — Play Market havolasi: ilova o'rnatilgan bo'lsa «Ochish» chiqadi */
  private replyWithApp(ctx: Context, text: string) {
    return ctx.reply(text, Markup.inlineKeyboard([Markup.button.url(MSG.appButton, PLAY_URL)]));
  }

  private async safe(ctx: Context, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.log.error(err);
      await ctx.reply(MSG.error).catch(() => undefined);
    }
  }
}

function fromOf(u: TgUser): TelegramFrom {
  return { id: u.id, firstName: u.first_name, lastName: u.last_name, username: u.username };
}

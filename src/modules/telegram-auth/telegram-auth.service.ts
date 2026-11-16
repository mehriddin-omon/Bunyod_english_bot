import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { TelegramLoginRequest } from 'src/common/core/entitys/telegram-login-request.entity';
import { Role } from 'src/common/utils/enum';
import { AuthService } from '../auth/auth.service';

/** Kirish so'rovi necha daqiqa amal qiladi */
const REQUEST_TTL_MIN = 10;
/** Bir IP dan daqiqasiga nechta `start` */
const START_LIMIT_PER_MIN = 20;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const randomToken = (bytes: number) => randomBytes(bytes).toString('hex');

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Telegram kontakti: "998901234567" / "+998901234567" → "+998901234567" */
export function normalizeTgPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return `+${digits}`;
}

/** Telegram profilidan olinadigan ma'lumotlar */
export interface TelegramFrom {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface StartedTelegramLogin {
  requestId: string;
  /** Faqat ilovada saqlanadi — poll uchun */
  pollSecret: string;
  /** https://t.me/<bot>?start=login_<token> */
  deepLink: string;
  expiresAt: Date;
}

export type TelegramPollResult =
  | { status: 'pending' | 'awaiting_contact' | 'expired' }
  | ({ status: 'confirmed' } & Awaited<ReturnType<AuthService['issueTokens']>>);

export type BotStartResult = 'confirmed' | 'need_contact' | 'expired' | 'invalid' | 'blocked';
export type BotContactResult = 'confirmed' | 'registered' | 'not_own' | 'blocked';

/**
 * Telegram orqali kirish / ro'yxatdan o'tish (2026-11) — Abu Tolib loyihasidagi usul:
 *  1. Ilova `start()` → requestId, pollSecret va bot deep link oladi, Telegram'ni ochadi.
 *  2. Bot `/start login_<token>` → tanish foydalanuvchi bo'lsa darhol tasdiqlanadi,
 *     yangi bo'lsa telefon raqami so'raladi (`handleContact`): Telegram'dagi ism, familiya,
 *     username, tasdiqlangan telefon raqami va profil rasmi olinadi.
 *  3. Ilova `poll()` bilan kutadi; CONFIRMED bo'lsa tokenlar bir marta beriladi.
 * So'rovni mehmon ochgan bo'lsa (`guestUserId`) yangi akkaunt ochilmaydi — o'sha mehmon
 * saqlanadi (ID o'zgarmaydi, progress joyida). Telefon/Telegram allaqachon boshqa akkauntda
 * bo'lsa — o'sha akkauntga kiriladi.
 */
@Injectable()
export class TelegramAuthService {
  private readonly log = new Logger(TelegramAuthService.name);
  private detectedBotUsername?: string;
  private readonly startHits = new Map<string, number[]>();
  /** Bot servisi beradi: profil rasmini yuklab olish (bot o'chiq bo'lsa yo'q) */
  photoFetcher?: (telegramId: number) => Promise<Buffer | null>;

  constructor(
    @InjectRepository(TelegramLoginRequest)
    private readonly requests: Repository<TelegramLoginRequest>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserGamification)
    private readonly gamification: Repository<UserGamification>,
    private readonly auth: AuthService,
  ) {}

  setBotUsername(username: string) {
    this.detectedBotUsername = username;
  }

  get botUsername(): string | undefined {
    const fromEnv = process.env.DINOENGLISH_BOT_USERNAME?.trim().replace(/^@/, '');
    return this.detectedBotUsername || fromEnv || undefined;
  }

  // ───────────────────────────── Ilova tomoni ─────────────────────────────

  async start(ip: string, userId?: string): Promise<StartedTelegramLogin> {
    this.assertRateLimit(ip);
    const bot = this.botUsername;
    if (!bot) throw new ServiceUnavailableException("Telegram orqali kirish hozircha ishlamayapti");

    // Eskirgan so'rovlarni vaqti-vaqti bilan tozalaymiz
    void this.requests
      .createQueryBuilder()
      .delete()
      .where(`created_at < now() - interval '1 day'`)
      .execute()
      .catch(() => undefined);

    let guestUserId: string | null = null;
    if (userId) {
      const me = await this.users.findOne({ where: { id: userId }, select: ['id', 'isGuest'] });
      if (me?.isGuest) guestUserId = me.id;
    }

    const token = randomToken(24); // 48 belgi + "login_" — start parametri (≤64) ichida
    const pollSecret = randomToken(32);
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MIN * 60_000);
    const row = await this.requests.save(
      this.requests.create({
        tokenHash: sha256(token),
        pollSecretHash: sha256(pollSecret),
        status: 'PENDING',
        guestUserId,
        expiresAt,
      }),
    );
    return {
      requestId: row.id,
      pollSecret,
      deepLink: `https://t.me/${bot}?start=login_${token}`,
      expiresAt,
    };
  }

  async poll(requestId: string, pollSecret: string): Promise<TelegramPollResult> {
    const req = await this.requests.findOne({ where: { id: requestId } });
    if (!req || !safeEqualHex(sha256(pollSecret), req.pollSecretHash)) {
      throw new NotFoundException("Kirish so'rovi topilmadi");
    }

    if (req.status === 'CONFIRMED' && req.userId) {
      // Atomik: tokenlarni faqat bitta poll oladi
      const res = await this.requests
        .createQueryBuilder()
        .update()
        .set({ status: 'USED' })
        .where('id = :id AND status = :s', { id: req.id, s: 'CONFIRMED' })
        .returning(['user_id'])
        .execute();
      const usedUserId: string | undefined = res.raw?.[0]?.user_id;
      if (!usedUserId) return { status: 'expired' };
      const user = await this.users.findOne({ where: { id: usedUserId } });
      if (!user) return { status: 'expired' };
      if (user.isActive === false) {
        throw new ForbiddenException("Hisobingiz bloklangan. O'qituvchingizga murojaat qiling.");
      }
      return { status: 'confirmed', ...(await this.auth.issueTokens(user)) };
    }

    if (req.status === 'USED' || req.expiresAt < new Date()) return { status: 'expired' };
    return { status: req.status === 'AWAITING_CONTACT' ? 'awaiting_contact' : 'pending' };
  }

  // ───────────────────────────── Bot tomoni ─────────────────────────────

  /** Bot: /start login_<token> */
  async handleStart(token: string, chatId: number, from: TelegramFrom): Promise<BotStartResult> {
    const req = await this.requests.findOne({ where: { tokenHash: sha256(token) } });
    if (!req) return 'invalid';
    if (!this.isOpen(req)) return 'expired';

    const known = await this.findRegistered(from);
    if (known) {
      if (known.isActive === false) return 'blocked';
      await this.confirm(req.id, known.id, chatId);
      return 'confirmed';
    }

    await this.requests.update(req.id, {
      status: 'AWAITING_CONTACT',
      telegramChatId: String(chatId),
    });
    return 'need_contact';
  }

  /** Bot: foydalanuvchi «Telefon raqamni yuborish» tugmasini bosdi */
  async handleContact(
    chatId: number,
    from: TelegramFrom,
    contact: { userId?: number; phone: string },
  ): Promise<BotContactResult> {
    // Faqat o'zining raqami (boshqa odamning kontaktini yuborib bo'lmaydi)
    if (contact.userId !== from.id) return 'not_own';
    const phone = normalizeTgPhone(contact.phone);

    const pending = await this.requests.findOne({
      where: {
        telegramChatId: String(chatId),
        status: In(['AWAITING_CONTACT', 'PENDING']),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    let user =
      (await this.users.findOne({ where: { telegramId: String(from.id) } })) ??
      (await this.users.findOne({ where: { phoneNumber: phone, isGuest: false } }));

    if (user) {
      if (user.isActive === false) return 'blocked';
      user = await this.applyProfile(user, from, phone);
    } else {
      const guest = pending?.guestUserId
        ? await this.users.findOne({ where: { id: pending.guestUserId, isGuest: true } })
        : null;
      user = guest ? await this.upgradeGuest(guest, from, phone) : await this.createUser(from, phone);
    }

    void this.fetchAvatar(user, from.id);

    if (!pending) return 'registered';
    await this.confirm(pending.id, user.id, chatId);
    return 'confirmed';
  }

  /** Telegram ID si bog'langan (telefoni tasdiqlangan) foydalanuvchi; topilsa username yangilanadi */
  async findRegistered(from: TelegramFrom): Promise<User | null> {
    const user = await this.users.findOne({ where: { telegramId: String(from.id) } });
    if (!user || user.isGuest) return null;
    if (from.username && from.username !== user.telegramUsername) {
      user.telegramUsername = from.username;
      await this.users.update(user.id, { telegramUsername: from.username });
    }
    return user;
  }

  // ───────────────────────────── Ichki ─────────────────────────────

  /**
   * Mavjud akkauntga Telegram ma'lumotlarini bog'laydi. O'qituvchi yozgan ism-familiya
   * USTIDAN YOZILMAYDI — faqat bo'sh bo'lsa to'ldiriladi; Telegram ID va username har doim yangilanadi.
   */
  private async applyProfile(user: User, from: TelegramFrom, phone: string): Promise<User> {
    user.telegramId = String(from.id);
    if (from.username) user.telegramUsername = from.username;
    if (!user.firstName?.trim()) user.firstName = from.firstName?.trim() || user.firstName;
    if (!user.lastName?.trim() && from.lastName?.trim()) user.lastName = from.lastName.trim();
    if (!user.phoneNumber) user.phoneNumber = phone;
    return this.users.save(user);
  }

  /** Mehmon → oddiy akkaunt (ID o'zgarmaydi — darslar, coin, lug'at joyida) */
  private async upgradeGuest(guest: User, from: TelegramFrom, phone: string): Promise<User> {
    guest.firstName = from.firstName?.trim() || 'Talaba';
    guest.lastName = from.lastName?.trim() || null;
    guest.telegramId = String(from.id);
    guest.telegramUsername = from.username ?? null;
    guest.phoneNumber = phone;
    guest.username = await this.pickUsername(from);
    guest.isGuest = false;
    // Paroli yo'q (tasodifiy) — kirish Telegram orqali; mehmonda allaqachon tasodifiy hash bor
    return this.users.save(guest);
  }

  private async createUser(from: TelegramFrom, phone: string): Promise<User> {
    const user = await this.users.save(
      this.users.create({
        firstName: from.firstName?.trim() || 'Talaba',
        lastName: from.lastName?.trim() || null,
        username: await this.pickUsername(from),
        password: await bcrypt.hash(randomToken(32), 10),
        phoneNumber: phone,
        telegramId: String(from.id),
        telegramUsername: from.username ?? null,
        role: Role.student,
      }),
    );
    await this.gamification.save(this.gamification.create({ userId: user.id }));
    return user;
  }

  /** Login: Telegram username (bo'sh bo'lsa), aks holda tg_<id> */
  private async pickUsername(from: TelegramFrom): Promise<string> {
    const candidates: string[] = [];
    const tg = (from.username ?? '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    if (tg.length >= 4 && !/^(guest|deleted)_/i.test(tg)) candidates.push(tg);
    candidates.push(`tg_${from.id}`.slice(0, 20));
    for (const c of candidates) if (!(await this.isUsernameTaken(c))) return c;
    return `tg_${randomToken(4)}`;
  }

  private async isUsernameTaken(username: string): Promise<boolean> {
    const n = await this.users
      .createQueryBuilder('u')
      .where('LOWER(u.username) = LOWER(:username)', { username })
      .getCount();
    return n > 0;
  }

  /** Profil rasmi bo'lmasa — Telegram'dagisi olinadi (xato bo'lsa jim o'tadi) */
  private async fetchAvatar(user: User, telegramId: number) {
    if (user.avatarUrl || !this.photoFetcher) return;
    try {
      const buf = await this.photoFetcher(telegramId);
      if (!buf) return;
      const dir = join(process.cwd(), 'uploads', 'images');
      await mkdir(dir, { recursive: true });
      const name = `tg_${Date.now()}_${randomToken(4)}.jpg`;
      await writeFile(join(dir, name), buf);
      // Shu orada foydalanuvchi o'zi rasm qo'ygan bo'lsa ustidan yozmaymiz
      await this.users
        .createQueryBuilder()
        .update()
        .set({ avatarUrl: `/uploads/images/${name}` })
        .where('id = :id AND avatar_url IS NULL', { id: user.id })
        .execute();
    } catch (err) {
      this.log.warn(`Telegram profil rasmi olinmadi: ${String(err)}`);
    }
  }

  private isOpen(req: TelegramLoginRequest) {
    return (req.status === 'PENDING' || req.status === 'AWAITING_CONTACT') && req.expiresAt > new Date();
  }

  private async confirm(requestId: string, userId: string, chatId: number) {
    await this.requests.update(requestId, {
      status: 'CONFIRMED',
      userId,
      telegramChatId: String(chatId),
      confirmedAt: new Date(),
    });
  }

  private assertRateLimit(ip: string) {
    const now = Date.now();
    const hits = (this.startHits.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (hits.length >= START_LIMIT_PER_MIN) {
      throw new HttpException("Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.", HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.startHits.set(ip, hits);
    if (this.startHits.size > 5000) {
      for (const [k, t] of this.startHits) if (t.every((x) => now - x >= 60_000)) this.startHits.delete(k);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGamification, XpTransaction } from 'src/common/core/entitys/gamification.entity';
import { XpSource } from 'src/common/utils/enum';

/**
 * XP (coin) berishning YAGONA joyi.
 *
 * Ilgari har modul o'zi bilganicha ish tutardi: dars `user_gamification` ni
 * yangilardi-yu daftarga yozmasdi, lug'at esa XP ni hisoblab ilovaga
 * qaytarardi va hech qayerga saqlamasdi (ekranda ko'rinib, darajaga
 * qo'shilmasdi). Endi hamma manba shu servisdan o'tadi.
 *
 * IKKI QOIDA:
 *  1. Daftar (`xp_transactions`) — haqiqat manbai. `user_gamification.xp_total`
 *     faqat tez o'qish uchun yig'indi; u daftarga yozilgan taqdirdagina o'sadi.
 *  2. `referenceKey` berilgan bo'lsa mukofot BIR MARTA beriladi. Takroriy
 *     chaqiruv (offline navbat qayta yuborildi, dars ikki marta yakunlandi,
 *     mashq qayta ishlandi) hech narsa qo'shmaydi va xato ham bermaydi.
 */
@Injectable()
export class XpService {
  constructor(
    @InjectRepository(XpTransaction)
    private readonly xpRepo: Repository<XpTransaction>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,
  ) {}

  /**
   * Bitta mukofot yozadi.
   *
   * @returns haqiqatan yozilgan XP miqdori. 0 — allaqachon berilgan bo'lsa
   *          (yoki amount <= 0). Chaqiruvchi shu qiymatni ilovaga qaytarsa,
   *          foydalanuvchi ekranda "haqiqiy" coinni ko'radi.
   */
  async award(input: {
    userId: string;
    amount: number;
    source: XpSource;
    /** uuid bo'lgan manba (dars, so'z jufti) — hisobot uchun */
    referenceId?: string | null;
    /** takrorlanmaslik kaliti; berilmasa mukofot har safar yoziladi */
    referenceKey?: string | null;
  }): Promise<number> {
    const amount = Math.round(input.amount);
    if (!amount || amount <= 0) return 0;

    const res = await this.xpRepo
      .createQueryBuilder()
      .insert()
      .into(XpTransaction)
      .values({
        userId: input.userId,
        amount,
        source: input.source,
        // `?? undefined` (null emas): entity tipida referenceId nullable emas,
        // TypeORM esa undefined ustunni INSERT dan tushirib qoldiradi — bazada
        // natija bir xil (NULL), lekin tip to'g'ri qoladi.
        referenceId: input.referenceId ?? undefined,
        referenceKey: input.referenceKey ?? null,
      })
      .orIgnore()
      .returning(['amount'])
      .execute();

    // Postgres RETURNING faqat haqiqatda INSERT bo'lgan qatorni qaytaradi —
    // konflikt bo'lsa massiv bo'sh, demak bu mukofot ilgari berilgan.
    const inserted = Array.isArray(res.raw) ? res.raw.length > 0 : true;
    if (!inserted) return 0;

    await this.bumpTotals(input.userId, amount);
    return amount;
  }

  /**
   * Bir nechta mukofotni birdaniga yozadi (masalan bitta lug'at sessiyasidagi
   * hamma yangi so'z). Har biri alohida tekshiriladi, `user_gamification` esa
   * bir marta yangilanadi.
   *
   * @returns haqiqatan berilgan JAMI XP
   */
  async awardMany(
    userId: string,
    items: { amount: number; source: XpSource; referenceId?: string | null; referenceKey?: string | null }[],
  ): Promise<number> {
    const rows = items
      .filter((i) => Math.round(i.amount) > 0)
      .map((i) => ({
        userId,
        amount: Math.round(i.amount),
        source: i.source,
        referenceId: i.referenceId ?? undefined,
        referenceKey: i.referenceKey ?? null,
      }));
    if (!rows.length) return 0;

    const res = await this.xpRepo
      .createQueryBuilder()
      .insert()
      .into(XpTransaction)
      .values(rows)
      .orIgnore()
      // `returning` MAJBURIY: TypeORM sukut bo'yicha faqat generatsiya
      // qilinadigan ustunlarni (id, created_at…) qaytaradi, `amount` esa
      // undefined bo'lib chiqadi — u holda yig'indi doim 0 bo'lib, coin
      // hech qachon qo'shilmagan bo'lardi.
      .returning(['amount'])
      .execute();

    const insertedRows: { amount?: number | string }[] = Array.isArray(res.raw) ? res.raw : [];
    const total = insertedRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    if (total > 0) await this.bumpTotals(userId, total);
    return total;
  }

  /**
   * COIN JARIMASI — manfiy tranzaksiya.
   *
   * Qoida: `xp_total` hech qachon 0 dan pastga tushmaydi. Shuning uchun
   * daftarga HAQIQATDA ayirilgan miqdor yoziladi (bolada 12 coin bo'lsa,
   * 20 lik jarima 12 bo'lib yoziladi) — daftar bilan yig'indi doim mos.
   * `referenceKey` berilsa jarima ham BIR MARTA qo'llanadi (takror chaqiruv
   * hech narsa ayirmaydi).
   *
   * @returns haqiqatda ayirilgan miqdor (musbat son), 0 — ayirilmagan bo'lsa
   */
  async penalize(input: {
    userId: string;
    amount: number;
    source: XpSource;
    referenceId?: string | null;
    referenceKey?: string | null;
  }): Promise<number> {
    const requested = Math.round(Math.abs(input.amount));
    if (!requested) return 0;

    const gamification = await this.getOrCreateGamification(input.userId);

    const applied = Math.min(requested, Math.max(0, gamification.xpTotal));

    // Daftarga takrorlanmaslik kaliti bilan yoziladi — 0 bo'lsa ham
    // (keyingi safar "jarima allaqachon qo'llangan" deb bilish uchun)
    const res = await this.xpRepo
      .createQueryBuilder()
      .insert()
      .into(XpTransaction)
      .values({
        userId: input.userId,
        amount: -applied,
        source: input.source,
        referenceId: input.referenceId ?? undefined,
        referenceKey: input.referenceKey ?? null,
      })
      .orIgnore()
      .returning(['amount'])
      .execute();

    const inserted = Array.isArray(res.raw) ? res.raw.length > 0 : true;
    if (!inserted || applied === 0) return 0;

    gamification.xpTotal = Math.max(0, gamification.xpTotal - applied);
    gamification.xpWeekly = Math.max(0, gamification.xpWeekly - applied);
    gamification.level = Math.floor(gamification.xpTotal / 100) + 1;
    this.applyStreak(gamification);
    await this.gamificationRepo.save(gamification);
    return applied;
  }

  /**
   * XP bermasdan faqat "bugun faollik bo'ldi" deb belgilaydi (streak uchun).
   *
   * Kerak bo'ladigan hol: dars qayta yakunlandi — XP takror berilmaydi, lekin
   * bola bugun ishlagani rost, streak uzilmasligi kerak.
   */
  async touchActivity(userId: string): Promise<void> {
    await this.withUniqueRetry(async () => {
      const gamification = await this.getOrCreateGamification(userId);
      if (this.applyStreak(gamification)) {
        await this.gamificationRepo.save(gamification);
      }
    });
  }

  /** Shu manbadan foydalanuvchiga allaqachon XP berilganmi */
  async alreadyAwarded(userId: string, source: XpSource, referenceKeys: string[]): Promise<Set<string>> {
    if (!referenceKeys.length) return new Set();
    const rows = await this.xpRepo
      .createQueryBuilder('x')
      .select('x.reference_key', 'referenceKey')
      .where('x.user_id = :userId', { userId })
      .andWhere('x.source = :source', { source })
      .andWhere('x.reference_key IN (:...keys)', { keys: referenceKeys })
      .getRawMany<{ referenceKey: string }>();
    return new Set(rows.map((r) => r.referenceKey));
  }

  /**
   * Yig'ma ko'rsatkichlarni oshiradi: xp_total, xp_weekly, level va streak.
   * Streak kuniga bir marta o'sadi — XP qaysi manbadan kelganiga bog'liq emas.
   */
  private async bumpTotals(userId: string, amount: number): Promise<void> {
    await this.withUniqueRetry(async () => {
      const gamification = await this.getOrCreateGamification(userId);
      gamification.xpTotal += amount;
      gamification.xpWeekly += amount;
      gamification.level = Math.floor(gamification.xpTotal / 100) + 1;
      this.applyStreak(gamification);
      await this.gamificationRepo.save(gamification);
    });
  }

  /**
   * `user_gamification` yozuvini oladi, bo'lmasa yaratadi.
   *
   * MUHIM: `repository.create()` ustunlarning BAZADAGI `default` qiymatini
   * qo'ymaydi — berilmagan maydon `undefined` bo'lib qoladi va ustiga
   * `+= amount` qilinsa `NaN` chiqadi (int ustunga NaN yozilsa Postgres
   * xatosi → 500). Shuning uchun hamma sonli maydon ochiq 0 bilan boshlanadi.
   */
  private async getOrCreateGamification(userId: string): Promise<UserGamification> {
    const existing = await this.gamificationRepo.findOne({ where: { userId } });
    if (existing) return existing;
    return this.gamificationRepo.create({
      userId,
      level: 1,
      xpTotal: 0,
      xpWeekly: 0,
      streakCurrent: 0,
      streakMax: 0,
      previousWeekXp: 0,
    });
  }

  /**
   * Unique konflikt (Postgres 23505) — ikki so'rov bir vaqtda bir xil yangi
   * yozuvni yaratmoqchi bo'lgan hol (avto-yakunlash va "sarflangan vaqt"
   * so'rovlari yonma-yon ketadi). Qayta o'qib bir marta takrorlanadi.
   */
  private async withUniqueRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      const code = (e as any)?.code ?? (e as any)?.driverError?.code;
      if (code !== '23505') throw e;
      return fn();
    }
  }

  /**
   * Streakni bugungi kunga moslashtiradi. Kuniga faqat bir marta o'sadi —
   * XP qaysi manbadan (dars, lug'at, mashq) kelganiga bog'liq emas.
   *
   * @returns o'zgarish bo'ldimi (saqlash kerakmi)
   */
  private applyStreak(gamification: UserGamification): boolean {
    const today = new Date().toISOString().split('T')[0];
    if (gamification.lastActivityDate === today) return false;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    gamification.streakCurrent =
      gamification.lastActivityDate === yesterday ? gamification.streakCurrent + 1 : 1;
    gamification.lastActivityDate = today;
    if (gamification.streakCurrent > gamification.streakMax) {
      gamification.streakMax = gamification.streakCurrent;
    }
    return true;
  }
}

import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '@my/common';
import { LoginDto, RegisterDto, UpdateProfileDto, UpgradeAccountDto } from './dto/auth.dto';
import { User } from 'src/common/core/entitys/user.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { StudentProfile } from 'src/common/core/entitys/student-profile.entity';
import { Role } from 'src/common/utils/enum';

/** Bir IP dan soatiga nechta mehmon akkaunt ochish mumkin */
const GUEST_LIMIT_PER_HOUR = 30; // o‘quv markazida ko‘p bola bitta IP (NAT) orqali chiqadi
const HOUR_MS = 60 * 60 * 1000;

/** Login (username) formati — DTO dagi bilan bir xil */
const USERNAME_RE = /^[a-zA-Z0-9_]{4,20}$/;
/** Tizim o'zi beradigan loginlar (mehmon, o'chirilgan) — foydalanuvchi tanlay olmaydi */
const RESERVED_USERNAME_RE = /^(guest|deleted)_/i;

/** Telefon raqam ko'rinishidagi login: +998901234567 / 998901234567 / 901234567 */
function toPhone(login: string): string | null {
  const digits = login.replace(/[\s()-]/g, '');
  if (/^\+998\d{9}$/.test(digits)) return digits;
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepository: Repository<UserGamification>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,

    private readonly tokenService: TokenService,
  ) {}

  /** IP → so'nggi bir soatdagi mehmon yaratish vaqtlari (xotirada, oddiy himoya) */
  private readonly guestHits = new Map<string, number[]>();

  private assertGuestRateLimit(ip: string) {
    const now = Date.now();
    const hits = (this.guestHits.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
    if (hits.length >= GUEST_LIMIT_PER_HOUR) {
      throw new HttpException("Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.", HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.guestHits.set(ip, hits);
    // Xarita cheksiz o'smasin
    if (this.guestHits.size > 5000) {
      for (const [key, times] of this.guestHits) {
        if (times.every((t) => now - t >= HOUR_MS)) this.guestHits.delete(key);
      }
    }
  }

  /**
   * Mehmon student: login sahifasisiz darhol o'qishni boshlash uchun.
   * Username tasodifiy, parol noma'lum (tasodifiy hash) — kirish faqat
   * qurilmadagi refresh token orqali. Saqlash: `upgradeGuest`.
   */
  async createGuest(ip: string) {
    this.assertGuestRateLimit(ip);

    const user = await this.userRepository.save(
      this.userRepository.create({
        firstName: 'Mehmon',
        lastName: null,
        username: `guest_${randomBytes(6).toString('hex')}`,
        password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        role: Role.student,
        isGuest: true,
      }),
    );

    await this.gamificationRepository.save(
      this.gamificationRepository.create({ userId: user.id }),
    );

    return this.issueTokens(user);
  }

  /** Mehmon akkauntga ism, login va parol qo'yadi — progress joyida qoladi */
  async upgradeGuest(userId: string, dto: UpgradeAccountDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (!user.isGuest) throw new BadRequestException('Akkaunt allaqachon saqlangan');

    this.assertUsernameAllowed(dto.username);
    if (await this.isUsernameTaken(dto.username, user.id)) throw new ConflictException('Bu login band');

    if (dto.phoneNumber) {
      const phoneOwner = await this.userRepository.findOne({ where: { phoneNumber: dto.phoneNumber } });
      if (phoneOwner && phoneOwner.id !== user.id) throw new ConflictException('Bu telefon raqam band');
    }

    user.firstName = dto.firstName.trim();
    user.lastName = dto.lastName?.trim() || null;
    user.username = dto.username;
    user.phoneNumber = dto.phoneNumber ?? null;
    user.password = await bcrypt.hash(dto.password, 10);
    user.isGuest = false;

    // username tokenda bor — yangisini beramiz
    return this.issueTokens(user);
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.tokenService.createAccessToken(payload);
    const refreshToken = this.tokenService.createRefreshToken(payload);

    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    const saved = await this.userRepository.save(user);

    return { accessToken, refreshToken, user: this.formatUser(saved) };
  }

  async register(dto: RegisterDto) {
    if (await this.isUsernameTaken(dto.username)) throw new ConflictException('Bu username band');

    if (dto.phoneNumber) {
      const existingPhone = await this.userRepository.findOne({ where: { phoneNumber: dto.phoneNumber } });
      if (existingPhone) throw new ConflictException('Bu telefon raqam band');
    }

    // Ochiq ro'yxatdan o'tishda faqat student yaratiladi. dto.role e'tiborsiz
    // qoldiriladi — aks holda istalgan odam o'zini teacher/admin/superAdmin qila
    // olardi. Teacher kerak bo'lsa admin PATCH /admin/user/:id/role orqali beradi.
    const role = Role.student;
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.userRepository.save(
      this.userRepository.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        password: hashedPassword,
        phoneNumber: dto.phoneNumber,
        role,
      }),
    );

    await this.gamificationRepository.save(
      this.gamificationRepository.create({ userId: user.id }),
    );

    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.tokenService.createAccessToken(payload);
    const refreshToken = this.tokenService.createRefreshToken(payload);

    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.save(user);

    return { accessToken, refreshToken, user: this.formatUser(user) };
  }

  async login(dto: LoginDto) {
    const login = dto.username.trim();
    const phone = toPhone(login);
    const user =
      (await this.userRepository.findOne({ where: { username: login } })) ??
      (phone ? await this.userRepository.findOne({ where: { phoneNumber: phone } }) : null);
    // Mehmonning paroli yo'q — u faqat qurilmadagi token bilan kiradi
    if (!user || user.isGuest) throw new UnauthorizedException("Noto'g'ri login yoki parol");

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException("Noto'g'ri login yoki parol");

    // Kirish holati o'chirilgan bo'lsa parol to'g'ri bo'lsa ham kiritilmaydi
    if (user.isActive === false) {
      throw new ForbiddenException("Hisobingiz bloklangan. O'qituvchingizga murojaat qiling.");
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.tokenService.createAccessToken(payload);
    const refreshToken = this.tokenService.createRefreshToken(payload);

    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.save(user);

    return { accessToken, refreshToken, user: this.formatUser(user) };
  }

  async refresh(refreshToken: string) {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.refreshToken) throw new UnauthorizedException("Token noto'g'ri");

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) throw new UnauthorizedException("Token noto'g'ri");

    // Bloklangan foydalanuvchi eski token bilan sessiyani uzaytira olmaydi
    if (user.isActive === false) {
      throw new ForbiddenException('Hisobingiz bloklangan');
    }

    const fresh = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.tokenService.createAccessToken(fresh);

    // Sirpanuvchi muddat: refresh token yarmidan ko'pi o'tib qolgan bo'lsa
    // yangisi beriladi — ilovani ishlatib turgan talaba 30 kundan keyin
    // chiqib ketmaydi. Mehmon akkaunt uchun bu shart: paroli yo'q, token
    // yo'qolsa progress ham yo'qoladi. Har so'rovda emas, faqat yarmida —
    // bir vaqtda ketgan bir nechta refresh bir-birining tokenini bekor qilmasin.
    // Ilova va veb javobdagi refreshToken'ni o'zi saqlaydi.
    const nowSec = Math.floor(Date.now() / 1000);
    const halfLife = Math.floor((Number(payload.exp) - Number(payload.iat)) / 2) || 0;
    const shouldRotate = !payload.exp || Number(payload.exp) - nowSec < halfLife;
    if (!shouldRotate) return { accessToken };

    const newRefreshToken = this.tokenService.createRefreshToken(fresh);
    user.refreshToken = await bcrypt.hash(newRefreshToken, 10);
    await this.userRepository.save(user);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
    return { message: 'Chiqildi' };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    const profile = await this.studentProfileRepository.findOne({ where: { userId } });

    const gamification = await this.gamificationRepository.findOne({ where: { userId } });

    return {
      ...this.formatUser(user, profile),
      gamification: gamification
        ? {
            xp: gamification.xpTotal,
            level: gamification.level,
            xpInLevel: gamification.xpTotal % 100,
            league: gamification.league,
            streak: gamification.streakCurrent,
            weeklyXp: gamification.xpWeekly,
          }
        : null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (dto.username !== undefined) dto.username = dto.username.trim();
    if (dto.username && dto.username !== user.username) {
      this.assertUsernameAllowed(dto.username);
      // Katta-kichik harf farqi hisobga olinmaydi: "Ali" bor bo'lsa "ali" ham band.
      // O'zining loginida faqat harf registrini o'zgartirish mumkin.
      if (await this.isUsernameTaken(dto.username, user.id)) {
        throw new ConflictException('Bu username band');
      }
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) throw new BadRequestException('Joriy parol kiritilmagan');
      const isValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isValid) throw new UnauthorizedException("Joriy parol noto'g'ri");
      user.password = await bcrypt.hash(dto.newPassword, 10);
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    // Telegram username — login (username) dan ALOHIDA; @ belgisisiz saqlanadi
    if (dto.telegramUsername !== undefined) {
      user.telegramUsername = dto.telegramUsername ? dto.telegramUsername.replace(/^@/, '') : null;
    }

    let saved: User;
    try {
      saved = await this.userRepository.save(user);
    } catch (err) {
      // Ikki so'rov bir vaqtda bir xil loginni olsa — UNIQUE (23505)
      const code = (err as any)?.driverError?.code ?? (err as any)?.code;
      if (err instanceof QueryFailedError && code === '23505') {
        throw new ConflictException('Bu username band');
      }
      throw err;
    }

    // Tug'ilgan sana student_profiles jadvalida — profil yo'q bo'lsa yaratiladi
    let profile = await this.studentProfileRepository.findOne({ where: { userId } });
    if (dto.birthDate !== undefined) {
      if (dto.birthDate && Number.isNaN(Date.parse(dto.birthDate))) {
        throw new BadRequestException("Tug'ilgan sana noto'g'ri");
      }
      if (!profile) profile = this.studentProfileRepository.create({ userId });
      profile.birthDate = dto.birthDate;
      profile = await this.studentProfileRepository.save(profile);
    }

    return { message: 'Profil yangilandi', user: this.formatUser(saved, profile) };
  }

  /**
   * GET /auth/username-available — profilni tahrirlashda login bandligini oldindan
   * tekshirish (yozayotganda). Yakuniy tekshiruv baribir `updateProfile` da.
   */
  async checkUsername(userId: string, raw: string) {
    const username = (raw ?? '').trim();
    if (!USERNAME_RE.test(username)) {
      return { username, available: false, message: "Username 4–20 ta lotin harfi, raqam yoki _ bo'lishi kerak" };
    }
    if (RESERVED_USERNAME_RE.test(username)) {
      return { username, available: false, message: "Bu username'ni tanlab bo'lmaydi" };
    }
    const taken = await this.isUsernameTaken(username, userId);
    return { username, available: !taken, message: taken ? 'Bu username band' : "Username bo'sh" };
  }

  /** Login boshqa foydalanuvchida bormi (registrsiz solishtiriladi) */
  private async isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
    const qb = this.userRepository
      .createQueryBuilder('u')
      .where('LOWER(u.username) = LOWER(:username)', { username: username.trim() });
    if (exceptUserId) qb.andWhere('u.id != :id', { id: exceptUserId });
    return (await qb.getCount()) > 0;
  }

  private assertUsernameAllowed(username: string) {
    if (RESERVED_USERNAME_RE.test(username)) {
      throw new BadRequestException("Bu username'ni tanlab bo'lmaydi");
    }
  }

  /** Ilova ichidan: tizimga kirgan foydalanuvchi o'z parolini tasdiqlaydi */
  async deleteOwnAccount(userId: string, password: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    // Mehmon parol qo'ymagan — tasdiqsiz o'chiriladi (token bor-ku)
    if (user.isGuest) return this.removeAccount(user);

    const ok = await bcrypt.compare(password, user.password);
    // 401 emas — ilova 401 da token yangilashga urinib, sessiyani uzib qo'ymasin
    if (!ok) throw new BadRequestException("Parol noto'g'ri");

    return this.removeAccount(user);
  }

  /** Veb-sahifadan: login + parol bilan (tokensiz) */
  async deleteAccountByCredentials(username: string, password: string) {
    const user = await this.userRepository.findOne({ where: { username } });
    // Login yoki parol xatosini ajratmaymiz — login mavjudligini bilib bo'lmasin
    if (!user) throw new UnauthorizedException("Noto'g'ri login yoki parol");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException("Noto'g'ri login yoki parol");

    return this.removeAccount(user);
  }

  /**
   * Akkauntni butunlay o'chiradi. Bog'liq jadvallar (progress, lug'at, coin,
   * bildirishnoma, profil, gamifikatsiya...) FK `ON DELETE CASCADE` orqali
   * o'zi o'chadi. Agar biror jadval o'chirishga to'sqinlik qilsa (FK xatosi
   * 23503) — shaxsiy ma'lumotlar tozalanib, akkaunt anonimlashtiriladi.
   */
  private async removeAccount(user: User) {
    if (user.role === Role.admin || user.role === Role.superAdmin) {
      throw new ForbiddenException(
        "Administrator akkauntini bu yerdan o'chirib bo'lmaydi",
      );
    }

    try {
      await this.userRepository.delete({ id: user.id });
    } catch (err) {
      const code = (err as any)?.driverError?.code ?? (err as any)?.code;
      if (!(err instanceof QueryFailedError) || code !== '23503') throw err;

      const randomPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      await this.userRepository.update(user.id, {
        username: `deleted_${user.id}`,
        password: randomPassword,
        firstName: null,
        lastName: null,
        phoneNumber: null,
        email: null,
        telegramId: null,
        telegramUsername: null,
        avatarUrl: null,
        refreshToken: null,
        isActive: false,
      });
    }

    return { message: "Akkaunt va unga tegishli ma'lumotlar o'chirildi" };
  }

  formatUser(user: User, profile?: StudentProfile | null) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phoneNumber: user.phoneNumber,
      email: user.email,
      avatarUrl: user.avatarUrl,
      telegramUsername: user.telegramUsername,
      // profil yuklanmagan joylarda (login, refresh) undefined — ilova eski qiymatni saqlaydi
      ...(profile !== undefined ? { birthDate: profile?.birthDate ?? null } : {}),
      role: user.role,
      isGuest: user.isGuest,
    };
  }
}

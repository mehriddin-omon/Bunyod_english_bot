import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '@my/common';
import { LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { User } from 'src/common/core/entitys/user.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { Role } from 'src/common/utils/enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepository: Repository<UserGamification>,

    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUsername = await this.userRepository.findOne({ where: { username: dto.username } });
    if (existingUsername) throw new ConflictException('Bu username band');

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
    const user = await this.userRepository.findOne({ where: { username: dto.username } });
    if (!user) throw new UnauthorizedException("Noto'g'ri login yoki parol");

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

    return {
      accessToken: this.tokenService.createAccessToken({
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      }),
    };
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
    return { message: 'Chiqildi' };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const gamification = await this.gamificationRepository.findOne({ where: { userId } });

    return {
      ...this.formatUser(user),
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

    if (dto.username && dto.username !== user.username) {
      const existing = await this.userRepository.findOne({ where: { username: dto.username } });
      if (existing) throw new ConflictException('Bu username band');
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

    const saved = await this.userRepository.save(user);
    return { message: 'Profil yangilandi', user: this.formatUser(saved) };
  }

  /** Ilova ichidan: tizimga kirgan foydalanuvchi o'z parolini tasdiqlaydi */
  async deleteOwnAccount(userId: string, password: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

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

  formatUser(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phoneNumber: user.phoneNumber,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }
}

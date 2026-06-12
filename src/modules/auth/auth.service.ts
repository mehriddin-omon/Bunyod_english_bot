import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
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

    const role = dto.role === Role.admin ? Role.student : (dto.role ?? Role.student);
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

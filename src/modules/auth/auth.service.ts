import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '@my/common';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { User } from 'src/common/core/entitys/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tokenService: TokenService,
  ) { }

  async register(dto: RegisterDto): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      username: dto.username,
      password: hashedPassword,
    });

    return await this.userRepository.save(user);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };

    return {
      accessToken: this.tokenService.createAccessToken(payload),
      refreshToken: this.tokenService.createRefreshToken(payload),
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    return {
      accessToken: this.tokenService.createAccessToken({
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      }),
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    return {
      message: `User ${userId} logged out successfully`
    }
  }
}

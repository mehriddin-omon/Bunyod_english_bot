import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { User } from 'src/common/core/entitys/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

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

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username };
    const token = await this.jwtService.signAsync(payload);

    return { access_token: token };
  }
}
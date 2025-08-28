import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entitys/user.entity';
import { TEACHER_ID } from 'src/common/utils/const';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  // Telegramdan kelgan userni bazaga yozish
  async createOrUpdateFromTelegram(tgUser: any): Promise<User> {
    let user = await this.userRepository.findOne({ where: { telegramId: tgUser.id } });
    if (!user) {
      user = this.userRepository.create({
        telegramId: tgUser.id,
        username: tgUser.username,
        fullName: `${tgUser.first_name ?? ''} ${tgUser.last_name ?? ''}`,
        role: TEACHER_ID.includes(tgUser.id) ? 'admin' : 'student',  //ustozni aniqlash
      });
    } else {
      // agar username yoki ism o‘zgargan bo‘lsa yangilash
      user.username = tgUser.username;
      user.fullName = `${tgUser.first_name ?? ''} ${tgUser.last_name ?? ''}`;
    }
    return this.userRepository.save(user);
  }

  async getRole(telegramId: number) {
    const user = await this.userRepository.findOne({ where: { telegramId } })
    return user?.role ?? 'student';
  }

  async findByTelegramId(telegramId: number | null | undefined) {
    if (!telegramId) {
      console.log('User topilmadi' );
      return false;
    }
    const user = await this.userRepository.findOne({ where: { telegramId } })
    return user;
  }
}

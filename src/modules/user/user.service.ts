import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TEACHER_ID } from '@my/common';
import { User } from 'src/common/core/entitys/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async getRole(telegramId: number): Promise<string | undefined> {
    const user = await this.userRepository.findOne({ where: { telegramId } });
    return user?.role;
  }

  async findByTelegramId(telegramId: number | null | undefined) {
    if (!telegramId) {
      return false;
    }
    const user = await this.userRepository.findOne({ where: { telegramId } })
    return user;
  }

  async getmyInfo(username: string) {
    const user = await this.userRepository.findOne(
      { where: { username } }
    );
    return user;
  }

  async updateMyProfile(id: string, dto: Partial<UpdateUserDto>) {
    const user = await this.userRepository.findOne({ where: { id } }); // userni topadi
    if (!user) {
      throw new Error("User not found");
    }
    Object.assign(user, dto); // updateDto'dagi maydonlarni userga biriktiradi
    return this.userRepository.save(user); // yangilangan userni saqlaydi
  }
}

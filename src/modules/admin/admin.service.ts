import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { StudentProfile } from 'src/common/core/entitys/student-profile.entity';
import { CefrLevel, Role, GroupStatus } from 'src/common/utils/enum';
import { UpdateUserDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(DailyTracking)
    private readonly dailyTrackingRepository: Repository<DailyTracking>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
  ) {}

  async getOverview() {
    const today = new Date().toISOString().slice(0, 10);

    const [totalUsers, totalStudents, totalTeachers, activeGroups, totalLessons, avgDailyActive] =
      await Promise.all([
        this.userRepository.count(),
        this.userRepository.count({ where: { role: Role.student } }),
        this.userRepository.count({ where: { role: Role.teacher } }),
        this.groupRepository.count({ where: { status: GroupStatus.active } }),
        this.lessonRepository.count(),
        this.dailyTrackingRepository.count({ where: { date: today } }),
      ]);

    return {
      stats: { totalUsers, totalStudents, totalTeachers, activeGroups, totalLessons, avgDailyActive },
    };
  }

  async updateUserRole(userId: string, role: Role): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    return this.userRepository.save(user);
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.username && dto.username !== user.username) {
      const existing = await this.userRepository.findOne({ where: { username: dto.username } });
      if (existing) throw new ConflictException('Username already taken');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.password !== undefined) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    await this.userRepository.save(user);

    const finalRole = dto.role ?? user.role;
    if (dto.cefrLevel !== undefined && finalRole === Role.student) {
      let profile = await this.studentProfileRepository.findOne({ where: { userId } });
      if (!profile) {
        profile = this.studentProfileRepository.create({ userId });
      }
      profile.cefrLevel = dto.cefrLevel as CefrLevel;
      await this.studentProfileRepository.save(profile);
    }

    return user;
  }
}

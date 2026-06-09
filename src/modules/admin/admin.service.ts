import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { CurriculumLesson } from 'src/common/core/entitys/lesson.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { Role, GroupStatus } from 'src/common/utils/enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(CurriculumLesson)
    private readonly lessonRepository: Repository<CurriculumLesson>,
    @InjectRepository(DailyTracking)
    private readonly dailyTrackingRepository: Repository<DailyTracking>,
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

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.role = role;
    return await this.userRepository.save(user);
  }
}
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { Schedule } from 'src/common/core/entitys/schedule.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Notification } from 'src/common/core/entitys/notification.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { GroupMemberSettings } from 'src/common/core/entitys/group-member-settings.entity';
import { Role, NotificationType, LessonProgressStatus } from 'src/common/utils/enum';
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddStudentsDto,
  SetAutoAdvanceDto,
  SetManualCeilingDto,
  SetStudentFreeDto,
  UnlockNextDto,
} from './dto/group.dto';
import { LessonGatingService } from 'src/common/services/lesson-gating.service';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,

    @InjectRepository(GroupMemberSettings)
    private readonly settingsRepo: Repository<GroupMemberSettings>,

    private readonly lessonGatingService: LessonGatingService,
  ) {}

  async getAllGroups(userId: string, role: string) {
    const groups = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoin('g.teacher', 'teacher')
      .addSelect(['teacher.id', 'teacher.firstName', 'teacher.lastName'])
      .leftJoinAndSelect('g.members', 'member')
      .where(role === Role.teacher ? 'g.teacherId = :userId' : '1=1', { userId })
      .getMany();

    if (!groups.length) return [];

    const allGroupIds = groups.map((g) => g.id);
    const allMemberIds = [...new Set(groups.flatMap((g) => g.members.map((m) => m.id)))];

    const [schedules, progressRecords] = await Promise.all([
      this.scheduleRepo.createQueryBuilder('s').where('s.groupId IN (:...ids)', { ids: allGroupIds }).getMany(),
      allMemberIds.length
        ? this.progressRepo
            .createQueryBuilder('lp')
            .where('lp.userId IN (:...ids)', { ids: allMemberIds })
            .getMany()
        : Promise.resolve([] as LessonProgress[]),
    ]);

    const scheduleMap = new Map<string, Schedule[]>();
    for (const s of schedules) {
      if (!scheduleMap.has(s.groupId)) scheduleMap.set(s.groupId, []);
      scheduleMap.get(s.groupId)!.push(s);
    }

    const progressByUser = new Map<string, LessonProgress[]>();
    for (const p of progressRecords) {
      if (!progressByUser.has(p.userId)) progressByUser.set(p.userId, []);
      progressByUser.get(p.userId)!.push(p);
    }

    return groups.map((group) => {
      const memberIds = group.members.map((m) => m.id);

      let totalCompleted = 0;
      let totalRecords = 0;
      let totalScore = 0;
      let scoredCount = 0;

      for (const mId of memberIds) {
        const records = progressByUser.get(mId) ?? [];
        for (const r of records) {
          totalRecords++;
          if (r.status === LessonProgressStatus.completed) {
            totalCompleted++;
            if (r.score != null) {
              totalScore += r.score;
              scoredCount++;
            }
          }
        }
      }

      const progress = totalRecords > 0 ? Math.round((totalCompleted / totalRecords) * 100) : 0;
      const avgScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

      return {
        id: group.id,
        name: group.name,
        color: group.color,
        status: group.status,
        studentCount: group.members.length,
        teacher: group.teacher
          ? { id: group.teacher.id, firstName: group.teacher.firstName, lastName: group.teacher.lastName }
          : null,
        schedule: scheduleMap.get(group.id) ?? [],
        progress,
        avgScore,
      };
    });
  }

  async createGroup(dto: CreateGroupDto, userId: string) {
    const group = this.groupRepo.create({
      name: dto.name,
      color: dto.color ?? null,
      description: dto.description ?? null,
      teacherId: userId,
      createdBy: userId,
      members: [],
    });

    if (dto.studentIds?.length) {
      group.members = await this.userRepo.find({ where: { id: In(dto.studentIds) } });
    }

    const saved = await this.groupRepo.save(group);

    let schedule: Schedule | null = null;
    if (dto.schedule) {
      schedule = await this.scheduleRepo.save(
        this.scheduleRepo.create({
          groupId: saved.id,
          teacherId: userId,
          daysOfWeek: JSON.stringify(dto.schedule.days),
          startTime: dto.schedule.startTime,
          durationMinutes: dto.schedule.duration,
          topic: dto.schedule.topic,
          isRecurring: dto.schedule.recurring ?? true,
          validFrom: new Date().toISOString().split('T')[0],
        }),
      );
    }

    if (dto.studentIds?.length) {
      await this.notifyStudents(dto.studentIds, saved.id, saved.name);
    }

    return {
      ...saved,
      schedule: schedule ? [schedule] : [],
      studentCount: saved.members.length,
    };
  }

  async getGroupById(groupId: string) {
    const group = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoin('g.teacher', 'teacher')
      .addSelect(['teacher.id', 'teacher.firstName', 'teacher.lastName'])
      .leftJoinAndSelect('g.members', 'member')
      .where('g.id = :groupId', { groupId })
      .getOne();

    if (!group) throw new NotFoundException('Group not found');

    const schedules = await this.scheduleRepo.find({ where: { groupId } });
    const memberUserIds = group.members.map((m) => m.id);

    const [progress, gamifications] = await Promise.all([
      memberUserIds.length
        ? this.progressRepo
            .createQueryBuilder('lp')
            .where('lp.userId IN (:...memberUserIds)', { memberUserIds })
            .getMany()
        : Promise.resolve([] as LessonProgress[]),
      memberUserIds.length
        ? this.gamificationRepo.find({ where: memberUserIds.map((id) => ({ userId: id })) })
        : Promise.resolve([] as UserGamification[]),
    ]);

    const gamMap = new Map(gamifications.map((g) => [g.userId, g]));

    const students = group.members.map((member) => {
      const gam = gamMap.get(member.id);
      return {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        gamification: gam ? { xp: gam.xpTotal, level: gam.level } : { xp: 0, level: 1 },
      };
    });

    let totalCompleted = 0;
    let totalScore = 0;
    let scoredCount = 0;
    let attendedCount = 0;
    const totalRecords = progress.length;

    for (const r of progress) {
      if (r.status === LessonProgressStatus.completed) {
        totalCompleted++;
        if (r.score != null) {
          totalScore += r.score;
          scoredCount++;
        }
      }
      if (r.status !== LessonProgressStatus.not_started) attendedCount++;
    }

    const stats = {
      avgScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
      completedLessons: totalCompleted,
      avgAttendance: totalRecords > 0 ? Math.round((attendedCount / totalRecords) * 100) : 0,
    };

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      description: group.description,
      status: group.status,
      teacher: group.teacher
        ? { id: group.teacher.id, firstName: group.teacher.firstName, lastName: group.teacher.lastName }
        : null,
      schedule: schedules,
      students,
      stats,
    };
  }

  async updateGroup(groupId: string, dto: UpdateGroupDto, userId: string, role: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    if (role === Role.teacher && group.teacherId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.color !== undefined) group.color = dto.color;
    if (dto.description !== undefined) group.description = dto.description;

    return this.groupRepo.save(group);
  }

  async deleteGroup(groupId: string) {
    const result = await this.groupRepo.delete(groupId);
    if (result.affected === 0) throw new NotFoundException('Group not found');
  }

  async addStudents(groupId: string, dto: AddStudentsDto) {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');

    const existingUserIds = new Set(group.members.map((m) => m.id));
    const newUserIds = dto.studentIds.filter((id) => !existingUserIds.has(id));

    if (newUserIds.length) {
      const newUsers = await this.userRepo.find({ where: { id: In(newUserIds) } });
      group.members = [...group.members, ...newUsers];
      await this.groupRepo.save(group);
      await this.notifyStudents(newUserIds, group.id, group.name);
    }

    return { added: newUserIds.length, message: "O'quvchilar qo'shildi" };
  }

  async removeStudent(groupId: string, studentId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');

    group.members = group.members.filter((m) => m.id !== studentId);
    await this.groupRepo.save(group);
    await this.settingsRepo.delete({ groupId, userId: studentId });

    return { message: "O'quvchi guruhdan chiqarildi" };
  }

  async getGroupSchedule(groupId: string, userId: string, role: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');

    if (role === Role.student) {
      const isMember = group.members.some((m) => m.id === userId);
      if (!isMember) throw new ForbiddenException('Access denied');
    }

    const schedule = await this.scheduleRepo.find({ where: { groupId } });
    return { groupId: group.id, groupName: group.name, schedule };
  }

  async setAutoAdvance(groupId: string, dto: SetAutoAdvanceDto, userId: string, role: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (role === Role.teacher && group.teacherId !== userId) throw new ForbiddenException('Access denied');

    if (!dto.enabled && group.autoAdvanceEnabled) {
      // Auto-advance o'chirilganda, joriy avtomatik hisoblangan chegarani saqlab qolamiz
      // (guruh to'satdan 0-chegaraga qaytib ketmasligi uchun).
      group.manualLessonCeiling = await this.lessonGatingService.getGroupCeilingIndex(group);
    }
    group.autoAdvanceEnabled = dto.enabled;
    return this.groupRepo.save(group);
  }

  async setManualCeiling(groupId: string, dto: SetManualCeilingDto, userId: string, role: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (role === Role.teacher && group.teacherId !== userId) throw new ForbiddenException('Access denied');
    if (group.autoAdvanceEnabled) {
      throw new BadRequestException("Avval auto-advance'ni o'chiring, keyin chegarani qo'lda o'rnating");
    }

    group.manualLessonCeiling = dto.ceilingIndex;
    return this.groupRepo.save(group);
  }

  async getGatingStatus(groupId: string, userId: string, role: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');
    if (role === Role.teacher && group.teacherId !== userId) throw new ForbiddenException('Access denied');

    const lessonOrder = await this.lessonGatingService.getPublishedLessonOrder();
    const ceilingIndex = await this.lessonGatingService.getGroupCeilingIndex(group);
    const ceilingLesson = lessonOrder[ceilingIndex] ?? null;
    const memberIds = group.members.map((m) => m.id);

    const [progressRecords, settingsRecords] = await Promise.all([
      ceilingLesson && memberIds.length
        ? this.progressRepo.find({
            where: { lessonId: ceilingLesson.id, userId: In(memberIds), status: LessonProgressStatus.completed },
          })
        : Promise.resolve([] as LessonProgress[]),
      memberIds.length
        ? this.settingsRepo.find({ where: { groupId, userId: In(memberIds) } })
        : Promise.resolve([] as GroupMemberSettings[]),
    ]);

    const completedUserIds = new Set(progressRecords.map((p) => p.userId));
    const settingsByUser = new Map(settingsRecords.map((s) => [s.userId, s]));

    const completed: Array<{ studentId: string; firstName: string | null; lastName: string | null; isFree: boolean; manualUnlockCeiling: number | null }> = [];
    const notCompleted: typeof completed = [];

    for (const member of group.members) {
      const settings = settingsByUser.get(member.id);
      const entry = {
        studentId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        isFree: settings?.isFree ?? false,
        manualUnlockCeiling: settings?.manualUnlockCeiling ?? null,
      };
      (completedUserIds.has(member.id) ? completed : notCompleted).push(entry);
    }

    return {
      groupId: group.id,
      ceilingIndex,
      ceilingLessonId: ceilingLesson?.id ?? null,
      ceilingLessonTitle: ceilingLesson?.lessonName ?? null,
      completed,
      notCompleted,
    };
  }

  async setStudentFree(groupId: string, studentId: string, dto: SetStudentFreeDto, userId: string, role: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');
    if (role === Role.teacher && group.teacherId !== userId) throw new ForbiddenException('Access denied');
    if (!group.members.some((m) => m.id === studentId)) {
      throw new NotFoundException("Bu o'quvchi guruh a'zosi emas");
    }

    let settings = await this.settingsRepo.findOne({ where: { groupId, userId: studentId } });
    if (!settings) settings = this.settingsRepo.create({ groupId, userId: studentId });
    settings.isFree = dto.isFree;
    await this.settingsRepo.save(settings);

    return { studentId, isFree: settings.isFree };
  }

  async unlockNextForStudents(groupId: string, dto: UnlockNextDto, userId: string, role: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['members'] });
    if (!group) throw new NotFoundException('Group not found');
    if (role === Role.teacher && group.teacherId !== userId) throw new ForbiddenException('Access denied');

    const memberIds = new Set(group.members.map((m) => m.id));
    const targetIds = dto.studentIds.filter((id) => memberIds.has(id));
    const groupCeiling = await this.lessonGatingService.getGroupCeilingIndex(group);
    const targetCeiling = groupCeiling + 1;

    for (const studentId of targetIds) {
      let settings = await this.settingsRepo.findOne({ where: { groupId, userId: studentId } });
      if (!settings) settings = this.settingsRepo.create({ groupId, userId: studentId });
      settings.manualUnlockCeiling = Math.max(settings.manualUnlockCeiling ?? -1, targetCeiling);
      await this.settingsRepo.save(settings);
    }

    return { unlocked: targetIds.length };
  }

  private async notifyStudents(studentIds: string[], groupId: string, groupName: string) {
    const notifications = studentIds.map((uId) =>
      this.notificationRepo.create({
        userId: uId,
        type: NotificationType.system,
        title: "Guruhga qo'shildingiz",
        body: `Siz "${groupName}" guruhiga qo'shildingiz`,
        referenceId: groupId,
        referenceType: 'group',
      }),
    );
    await this.notificationRepo.save(notifications);
  }
}

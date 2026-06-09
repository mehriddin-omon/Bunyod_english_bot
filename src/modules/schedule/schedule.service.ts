import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from 'src/common/core/entitys/schedule.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';

function weekRange(dateStr?: string): { monday: Date; sunday: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();
  // getDay(): 0=Sun, 1=Mon … 6=Sat → shift so Mon=0
  const dow = (base.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(base);
  monday.setDate(base.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
  ) {}

  async getWeeklySchedule(teacherId: string, week?: string): Promise<any> {
    const { monday } = weekRange(week);

    const schedules = await this.scheduleRepo.find({
      where: { teacherId },
      relations: ['group', 'group.members'],
    });

    const lessons = schedules.flatMap((s) => {
      const days: number[] = JSON.parse(s.daysOfWeek);
      return days.map((day) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + day); // day: 0=Mon…6=Sun
        return {
          id: s.id,
          groupId: s.groupId,
          groupName: s.group?.name ?? null,
          groupColor: s.group?.color ?? null,
          day,
          date: toDateStr(date),
          startTime: s.startTime,
          duration: s.durationMinutes,
          topic: s.topic ?? null,
          studentCount: s.group?.members?.length ?? 0,
        };
      });
    });

    // Sort by day then startTime
    lessons.sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));

    return { week: toDateStr(monday), lessons };
  }

  async createSchedule(teacherId: string, dto: CreateScheduleDto): Promise<Schedule> {
    const group = await this.groupRepo.findOne({
      where: { id: dto.groupId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (group.teacherId !== teacherId) throw new ForbiddenException('Bu guruh sizniki emas');

    const schedule = this.scheduleRepo.create({
      groupId: dto.groupId,
      teacherId,
      daysOfWeek: JSON.stringify(dto.days),
      startTime: dto.startTime,
      durationMinutes: dto.duration,
      topic: dto.topic,
      isRecurring: dto.recurring ?? true,
      validFrom: toDateStr(new Date()),
    });

    return this.scheduleRepo.save(schedule);
  }

  async updateSchedule(scheduleId: string, teacherId: string, dto: UpdateScheduleDto): Promise<Schedule> {
    const schedule = await this.scheduleRepo.findOne({ where: { id: scheduleId, teacherId } });
    if (!schedule) throw new NotFoundException('Jadval topilmadi yoki ruxsat yo\'q');

    if (dto.days !== undefined) schedule.daysOfWeek = JSON.stringify(dto.days);
    if (dto.startTime !== undefined) schedule.startTime = dto.startTime;
    if (dto.duration !== undefined) schedule.durationMinutes = dto.duration;
    if (dto.topic !== undefined) schedule.topic = dto.topic;
    if (dto.recurring !== undefined) schedule.isRecurring = dto.recurring;

    return this.scheduleRepo.save(schedule);
  }

  async deleteSchedule(scheduleId: string, teacherId: string): Promise<void> {
    const schedule = await this.scheduleRepo.findOne({ where: { id: scheduleId, teacherId } });
    if (!schedule) throw new NotFoundException('Jadval topilmadi yoki ruxsat yo\'q');
    await this.scheduleRepo.delete(scheduleId);
  }

  async getGroupSchedule(groupId: string): Promise<any> {
    const schedules = await this.scheduleRepo.find({ where: { groupId } });
    return {
      groupId,
      schedule: schedules.map((s) => ({
        id: s.id,
        days: JSON.parse(s.daysOfWeek),
        startTime: s.startTime,
        duration: s.durationMinutes,
        topic: s.topic ?? null,
        recurring: s.isRecurring,
      })),
    };
  }
}

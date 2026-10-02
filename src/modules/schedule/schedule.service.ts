import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from 'src/common/core/entitys/schedule.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';

/** Berilgan sana (yoki bugun) tushgan haftaning Dushanba–Yakshanbasi (mahalliy vaqt) */
function weekRange(dateStr?: string): { monday: Date; sunday: Date } {
  let base: Date;
  if (dateStr) {
    // "YYYY-MM-DD" ni mahalliy vaqtda o'qiymiz — new Date("2026-05-25") UTC deb talqin qiladi
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    base = new Date(y, (m ?? 1) - 1, d ?? 1);
  } else {
    base = new Date();
  }
  const dow = (base.getDay() + 6) % 7; // Dushanba = 0 … Yakshanba = 6
  const monday = new Date(base);
  monday.setDate(base.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

/** Mahalliy sanani "YYYY-MM-DD" ga aylantiradi.
 *  `toISOString()` ishlatilmaydi — u UTC ga o'tkazib, UTC+5 da bir kun oldinga suradi. */
function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `date` ustuni TypeORM'dan string ham, Date ham kelishi mumkin */
function asDateStr(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? toDateStr(v) : String(v).slice(0, 10);
}

/** "14:00" + 90 daqiqa -> "15:30" */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 60) % 24)}:${p(total % 60)}`;
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
  ) {}

  /**
   * So'ralgan haftadagi darslar.
   * `valid_from` / `valid_until` oralig'i va `is_recurring` hisobga olinadi:
   * takrorlanmaydigan dars faqat o'zi boshlangan haftada ko'rinadi.
   */
  async getWeeklySchedule(teacherId: string, week?: string): Promise<any> {
    const { monday, sunday } = weekRange(week);
    const mondayStr = toDateStr(monday);
    const sundayStr = toDateStr(sunday);

    const schedules = await this.scheduleRepo.find({
      where: { teacherId },
      relations: ['group', 'group.members'],
    });

    const lessons = schedules.flatMap((s) => {
      let days: number[];
      try {
        days = JSON.parse(s.daysOfWeek);
      } catch {
        return [];
      }
      if (!Array.isArray(days)) return [];

      const from = asDateStr(s.validFrom);
      const until = asDateStr(s.validUntil);

      // Takrorlanmaydigan dars — faqat o'z haftasida
      if (!s.isRecurring && from && (from < mondayStr || from > sundayStr)) return [];

      return days.flatMap((day) => {
        if (day < 0 || day > 6) return [];
        const date = new Date(monday);
        date.setDate(monday.getDate() + day);
        const dateStr = toDateStr(date);

        if (from && dateStr < from) return [];
        if (until && dateStr > until) return [];

        const startTime = String(s.startTime).slice(0, 5);
        return [
          {
            id: s.id,
            groupId: s.groupId,
            groupName: s.group?.name ?? null,
            groupColor: s.group?.color ?? null,
            day,
            date: dateStr,
            startTime,
            endTime: addMinutes(startTime, s.durationMinutes),
            duration: s.durationMinutes,
            topic: s.topic ?? null,
            recurring: s.isRecurring,
            validFrom: from,
            validUntil: until,
            studentCount: s.group?.members?.length ?? 0,
          },
        ];
      });
    });

    lessons.sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));

    return { week: mondayStr, weekEnd: sundayStr, lessons };
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
      // Ko'rilayotgan hafta berilsa o'shandan, aks holda bugundan boshlanadi
      validFrom: dto.validFrom ?? toDateStr(new Date()),
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

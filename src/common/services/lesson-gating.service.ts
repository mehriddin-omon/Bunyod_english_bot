import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { GroupMemberSettings } from 'src/common/core/entitys/group-member-settings.entity';
import { ScheduleSession } from 'src/common/core/entitys/schedule.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonStatus, SessionStatus } from 'src/common/utils/enum';

export interface EffectiveCeiling {
  /** null = cheklanmagan (guruhsiz yoki "erkin" talaba) */
  ceilingIndex: number | null;
  groupId: string | null;
}

/**
 * Guruh bo'yicha dars ochilishi (gating) uchun umumiy hisoblash mantig'i.
 * home.service.ts, progress.service.ts va group.service.ts shu servisdan foydalanadi,
 * shunda barcha joyda bir xil dars tartibi va chegara hisobi ishlatiladi.
 */
@Injectable()
export class LessonGatingService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(GroupMemberSettings)
    private readonly settingsRepo: Repository<GroupMemberSettings>,

    @InjectRepository(ScheduleSession)
    private readonly sessionRepo: Repository<ScheduleSession>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
  ) {}

  /**
   * Barcha nashr etilgan darslarni global tartibda qaytaradi: bo'lim.number ASC,
   * har bir bo'lim ichida dars.orderIndex ASC. Massivdagi indeks = "ceiling index".
   */
  async getPublishedLessonOrder(): Promise<Lesson[]> {
    const [units, lessons] = await Promise.all([
      this.unitRepo.find({ where: { status: LessonStatus.published as any }, order: { number: 'ASC' } }),
      this.lessonRepo.find({ where: { status: LessonStatus.published }, order: { orderIndex: 'ASC' } }),
    ]);

    const byUnit = new Map<string, Lesson[]>();
    const withoutUnit: Lesson[] = [];
    for (const lesson of lessons) {
      if (!lesson.unitId) {
        withoutUnit.push(lesson);
        continue;
      }
      if (!byUnit.has(lesson.unitId)) byUnit.set(lesson.unitId, []);
      byUnit.get(lesson.unitId)!.push(lesson);
    }

    const ordered: Lesson[] = [];
    for (const unit of units) ordered.push(...(byUnit.get(unit.id) ?? []));
    ordered.push(...withoutUnit);
    return ordered;
  }

  async findStudentGroup(userId: string): Promise<Group | null> {
    return this.groupRepo
      .createQueryBuilder('g')
      .innerJoin('g.members', 'm', 'm.id = :userId', { userId })
      .getOne();
  }

  /** Guruhning joriy chegara indeksini hisoblaydi (auto yoki manual rejim bo'yicha). */
  async getGroupCeilingIndex(group: Group): Promise<number> {
    if (!group.autoAdvanceEnabled) return group.manualLessonCeiling ?? 0;

    const today = new Date().toISOString().split('T')[0];
    return this.sessionRepo
      .createQueryBuilder('s')
      .where('s.groupId = :groupId', { groupId: group.id })
      .andWhere('s.sessionDate <= :today', { today })
      .andWhere('s.status != :cancelled', { cancelled: SessionStatus.cancelled })
      .getCount();
  }

  /**
   * Talaba uchun samarali (effective) chegara indeksini hisoblaydi.
   * - Guruhsiz talaba -> cheklanmagan (null).
   * - "Erkin" (isFree) talaba -> cheklanmagan (null).
   * - Aks holda -> max(guruh chegarasi, talabaga berilgan individual ustama).
   */
  async computeEffectiveCeiling(userId: string): Promise<EffectiveCeiling> {
    const group = await this.findStudentGroup(userId);
    if (!group) return { ceilingIndex: null, groupId: null };

    const settings = await this.settingsRepo.findOne({ where: { groupId: group.id, userId } });
    if (settings?.isFree) return { ceilingIndex: null, groupId: group.id };

    const groupCeiling = await this.getGroupCeilingIndex(group);
    const effectiveCeiling = Math.max(groupCeiling, settings?.manualUnlockCeiling ?? -Infinity);
    return { ceilingIndex: effectiveCeiling, groupId: group.id };
  }
}

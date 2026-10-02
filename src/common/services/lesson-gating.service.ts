import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { GroupMemberSettings } from 'src/common/core/entitys/group-member-settings.entity';
import { ScheduleSession } from 'src/common/core/entitys/schedule.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
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

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,
  ) {}

  /**
   * Berilgan dars talaba uchun QACHON OCHILGAN (null — hali ochilmagan).
   *
   * Lug'at coinli sinovining muddati shundan hisoblanadi: "keyingi yangi dars
   * ochilgandan 24 soat o'tguncha". "Ochilgan" — SINFDA ochilgani, ya'ni
   * guruh jadvali bo'yicha:
   *
   *  - AUTO-ADVANCE guruh: `getGroupCeilingIndex` = o'tgan sessiyalar soni,
   *    dars `i` (global tartibdagi indeks) `i`-nchi sessiya kuni ochiladi.
   *    Vaqt = o'sha sessiyaning `sessionDate + startTime` (dars boshlanishi).
   *    Talaba oldingi darsni tugatmagan bo'lsa ham vaqt ketaveradi — bu
   *    "sinf bilan birga yurish" qoidasi. `i = 0` (birinchi dars) — talaba uni
   *    birinchi ochgan vaqt.
   *  - GURUHSIZ, ERKIN (isFree) yoki MANUAL chegarali guruh: jadval yo'q /
   *    ochilish vaqti saqlanmagan — talaba shu darsga BIRINCHI KIRGAN vaqt
   *    (`lesson_progress.created_at`); kirmagan bo'lsa null.
   */
  async getLessonUnlockTime(userId: string, lessonIndex: number): Promise<Date | null> {
    const firstOpenedAt = async (): Promise<Date | null> => {
      const order = await this.getPublishedLessonOrder();
      const lesson = order[lessonIndex];
      if (!lesson) return null;
      const progress = await this.progressRepo.findOne({ where: { userId, lessonId: lesson.id } });
      return progress?.createdAt ?? null;
    };

    if (lessonIndex <= 0) return firstOpenedAt();

    const group = await this.findStudentGroup(userId);
    if (!group || !group.autoAdvanceEnabled) return firstOpenedAt();

    const settings = await this.settingsRepo.findOne({ where: { groupId: group.id, userId } });
    if (settings?.isFree) return firstOpenedAt();

    // i-nchi (1 dan boshlab) bekor qilinmagan sessiya — `getGroupCeilingIndex`
    // bilan bir xil to'plam, faqat sanaga emas, tartibga qarab olinadi.
    const [session] = await this.sessionRepo.find({
      where: { groupId: group.id, status: Not(SessionStatus.cancelled) },
      order: { sessionDate: 'ASC', startTime: 'ASC' },
      skip: lessonIndex - 1,
      take: 1,
    });
    if (!session) return null;

    // 'YYYY-MM-DD' + 'HH:MM:SS' — server mahalliy vaqtida (home.service dagi
    // "bugun" hisobi bilan bir xil yondashuv)
    const at = new Date(`${session.sessionDate}T${session.startTime || '00:00:00'}`);
    if (Number.isNaN(at.getTime())) return null;
    // Kelajakdagi sessiya — dars hali ochilmagan
    return at.getTime() <= Date.now() ? at : null;
  }

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

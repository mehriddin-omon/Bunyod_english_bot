import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { GroupMemberSettings } from 'src/common/core/entitys/group-member-settings.entity';
import { ScheduleSession } from 'src/common/core/entitys/schedule.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { LessonProgressStatus, LessonStatus, Role, SessionStatus } from 'src/common/utils/enum';

/**
 * MEHMON CHEGARASI: login/parolsiz («Boshlash» bilan ochilgan) akkauntga kursning
 * faqat BIRINCHI N ta darsi ochiq (global tartib: bo'lim raqami, keyin dars tartibi).
 * Qolganini ko'rish uchun akkauntni saqlash kerak (`POST /auth/upgrade`) — ID
 * o'zgarmaydi, saqlangan zahoti hamma dars ochiladi.
 */
export const GUEST_LESSON_LIMIT = 3;
/** Ilova shu kod bo'yicha «Akkauntni saqlang» ekranini ko'rsatadi */
export const GUEST_LESSON_LIMIT_CODE = 'GUEST_LESSON_LIMIT';
export const GUEST_LESSON_LIMIT_MESSAGE =
  `Mehmon rejimida faqat dastlabki ${GUEST_LESSON_LIMIT} ta dars ochiq. Davom etish uchun akkauntingizni saqlang.`;

/**
 * KETMA-KET QULF: hamma darslar yopiq turadi — talaba oldingi darsni TUGATMASA
 * keyingisi ochilmaydi. Ilova shu kod bo'yicha «Oldingi darsni tugating» holatini ko'rsatadi.
 */
export const LESSON_LOCKED_CODE = 'LESSON_LOCKED';
export const LESSON_LOCKED_MESSAGE = "Oldingi darsni tugatmasdan bu darsga o'ta olmaysiz";

/**
 * Talabaning guruhdagi KIRISH REJIMI (teacher → guruh → «Dars ochilishi»):
 *  - `restricted` (Cheklangan) — guruh chegarasi + ketma-ket qulf;
 *  - `free` (Erkin)            — guruh chegarasi yo'q, ketma-ket qulf bor;
 *  - `independent` (Mustaqil)  — BARCHA darslar ochiq, oldingisini tugatmasa ham.
 */
export type StudentAccessMode = 'restricted' | 'free' | 'independent';

export function accessModeOf(s?: { isFree?: boolean | null; isIndependent?: boolean | null } | null): StudentAccessMode {
  if (s?.isIndependent) return 'independent';
  if (s?.isFree) return 'free';
  return 'restricted';
}

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

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Mehmon uchun OCHIQ darslar (birinchi GUEST_LESSON_LIMIT ta). Mehmon bo'lmasa — null
   * (cheklov yo'q). Ro'yxatda yo'q har qanday dars (keyingilari, nashr qilinmaganlari)
   * mehmonga yopiq.
   */
  async getGuestOpenLessonIds(userId?: string | null): Promise<Set<string> | null> {
    if (!userId) return null;
    const user = await this.userRepo.findOne({ where: { id: userId }, select: { id: true, isGuest: true } });
    if (!user?.isGuest) return null;
    const order = await this.getPublishedLessonOrder();
    return new Set(order.slice(0, GUEST_LESSON_LIMIT).map((l) => l.id));
  }

  /** Mehmon yopiq darsga kirsa 403 + `code: GUEST_LESSON_LIMIT` (ilova shundan «saqlash» ekranini ochadi) */
  async assertGuestLessonAccess(userId: string, lessonId: string): Promise<void> {
    const open = await this.getGuestOpenLessonIds(userId);
    if (open && !open.has(lessonId)) {
      throw new ForbiddenException({ code: GUEST_LESSON_LIMIT_CODE, message: GUEST_LESSON_LIMIT_MESSAGE });
    }
  }

  /**
   * KETMA-KET QULF (faqat talaba). Global tartibda (bo'lim raqami, keyin dars tartibi)
   * YOPIQ darslar id'lari. Qoida: birinchi tugatilmagan darsgacha hammasi ochiq, undan
   * keyingilari yopiq. Allaqachon tugatilgan dars doim ochiq qoladi (qayta ko'rish mumkin).
   * Talaba bo'lmasa (teacher/admin) — null (cheklov yo'q).
   */
  async getLockedLessonIds(userId?: string | null): Promise<Set<string> | null> {
    if (!userId) return null;
    const user = await this.userRepo.findOne({ where: { id: userId }, select: { id: true, role: true } });
    if (!user || user.role !== Role.student) return null;

    // Mustaqil talaba — hech qaysi dars ketma-ketlik bo'yicha yopilmaydi
    if (await this.isIndependent(userId)) return new Set();

    const order = await this.getPublishedLessonOrder();
    if (order.length === 0) return new Set();
    const completed = await this.getCompletedLessonIds(userId);

    const firstOpenIndex = order.findIndex((l) => !completed.has(l.id));
    const locked = new Set<string>();
    if (firstOpenIndex === -1) return locked; // hammasi tugatilgan
    for (let i = firstOpenIndex + 1; i < order.length; i++) {
      if (!completed.has(order[i].id)) locked.add(order[i].id);
    }
    return locked;
  }

  /**
   * Talaba YETIB KELGAN (ochiq) darslar: tugatilganlar + birinchi tugatilmagan dars
   * (`getLockedLessonIds` bilan aynan bir qoida); mehmonda — faqat birinchi
   * GUEST_LESSON_LIMIT ta ichidan. Lug'at bo'limi (ro'yxat, statistika, yodlash)
   * faqat shu darslar so'zlarini ko'rsatadi. Talaba bo'lmasa — null (cheklov yo'q).
   */
  async getReachedLessonIds(userId?: string | null): Promise<Set<string> | null> {
    if (!userId) return null;
    const user = await this.userRepo.findOne({ where: { id: userId }, select: { id: true, role: true, isGuest: true } });
    if (!user || user.role !== Role.student) return null;

    const [order, completed, independent] = await Promise.all([
      this.getPublishedLessonOrder(),
      this.getCompletedLessonIds(userId),
      this.isIndependent(userId),
    ]);
    // Mustaqil talaba — barcha darslar yetib kelgan (mehmon chegarasi baribir)
    if (independent) {
      return new Set((user.isGuest ? order.slice(0, GUEST_LESSON_LIMIT) : order).map((l) => l.id));
    }
    const reached = new Set<string>();
    let currentTaken = false;
    for (let i = 0; i < order.length; i++) {
      if (user.isGuest && i >= GUEST_LESSON_LIMIT) break;
      const id = order[i].id;
      if (completed.has(id)) reached.add(id);
      else if (!currentTaken) {
        reached.add(id);
        currentTaken = true;
      }
    }
    return reached;
  }

  /** Talaba yopiq darsga kirsa 403 + `code: LESSON_LOCKED` (kontent, javob yuborish, boshlash, yakunlash) */
  async assertSequentialAccess(userId: string, lessonId: string): Promise<void> {
    const locked = await this.getLockedLessonIds(userId);
    if (locked?.has(lessonId)) {
      throw new ForbiddenException({ code: LESSON_LOCKED_CODE, message: LESSON_LOCKED_MESSAGE });
    }
  }

  async getCompletedLessonIds(userId: string): Promise<Set<string>> {
    const rows = await this.progressRepo.find({
      where: { userId, status: LessonProgressStatus.completed },
      select: { id: true, lessonId: true },
    });
    return new Set(rows.map((r) => r.lessonId));
  }

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
    if (settings?.isFree || settings?.isIndependent) return firstOpenedAt();

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

  /**
   * Talaba joriy guruhida «Mustaqil» rejimdami (`group_member_settings.is_independent`).
   * Guruhdan chiqarilgan bo'lsa eski sozlama hisobga olinmaydi.
   */
  async isIndependent(userId: string): Promise<boolean> {
    // Talaba bir nechta guruhda bo'lishi mumkin — `findStudentGroup` ixtiyoriy BITTASINI qaytaradi,
    // teacher esa rejimni boshqa guruh sahifasida qo'ygan bo'lishi mumkin. Shuning uchun HAR QANDAY
    // joriy guruhidagi «Mustaqil» sozlama hisobga olinadi (guruhdan chiqarilgani — yo'q).
    const rows: unknown[] = await this.settingsRepo.query(
      `SELECT 1
         FROM group_member_settings s
         JOIN group_members gm ON gm.group_id = s.group_id AND gm.user_id = s.user_id
        WHERE s.user_id = $1 AND s.is_independent = true
        LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
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
   * - "Erkin" (isFree) yoki "Mustaqil" (isIndependent) talaba -> cheklanmagan (null).
   * - Aks holda -> max(guruh chegarasi, talabaga berilgan individual ustama).
   */
  async computeEffectiveCeiling(userId: string): Promise<EffectiveCeiling> {
    const group = await this.findStudentGroup(userId);
    if (!group) return { ceilingIndex: null, groupId: null };

    const settings = await this.settingsRepo.findOne({ where: { groupId: group.id, userId } });
    if (settings?.isFree || settings?.isIndependent) return { ceilingIndex: null, groupId: group.id };
    if (await this.isIndependent(userId)) return { ceilingIndex: null, groupId: group.id };

    const groupCeiling = await this.getGroupCeilingIndex(group);
    const effectiveCeiling = Math.max(groupCeiling, settings?.manualUnlockCeiling ?? -Infinity);
    return { ceilingIndex: effectiveCeiling, groupId: group.id };
  }
}

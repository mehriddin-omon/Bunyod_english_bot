import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Assignment, AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { UserGamification, UserSkill } from 'src/common/core/entitys/gamification.entity';
import { ActivityLog, DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { LessonProgressStatus, SubmissionStatus } from 'src/common/utils/enum';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Assignment)
    private readonly assignmentRepo: Repository<Assignment>,

    @InjectRepository(AssignmentSubmission)
    private readonly submissionRepo: Repository<AssignmentSubmission>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,

    @InjectRepository(UserSkill)
    private readonly skillRepo: Repository<UserSkill>,

    @InjectRepository(ActivityLog)
    private readonly activityRepo: Repository<ActivityLog>,

    @InjectRepository(DailyTracking)
    private readonly dailyRepo: Repository<DailyTracking>,
  ) {}

  /** Soniyani "Xs Ym" ko'rinishida formatlaydi (0 bo'lsa "0m"). */
  private fmtDuration(totalMinutes: number): string {
    const m = Math.max(0, Math.round(totalMinutes));
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}s ${rem}m` : `${h}s`;
  }

  async getGroupMonitoring(groupId: string, period: string = 'month'): Promise<any> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const memberIds = group.members.map((m) => m.id);

    const students = await Promise.all(
      group.members.map(async (member) => {
        const userId = member.id;
        const gamification = await this.gamificationRepo.findOne({ where: { userId } });
        const progressRows = await this.progressRepo.find({ where: { userId } });

        // Davomat = ilovadan foydalanish vaqti. usageMinutes = jami sarflangan
        // vaqt (barcha darslar timeSpentSec yig'indisi), dailyAvgMinutes = faol
        // kunlar bo'yicha o'rtacha kunlik vaqt (daily_tracking'dan).
        const usageMinutes = Math.round(
          progressRows.reduce((s, p) => s + (p.timeSpentSec ?? 0), 0) / 60,
        );
        const dailyRows = await this.dailyRepo.find({ where: { userId } });
        const activeDays = dailyRows.filter((d) => d.minutesSpent > 0).length;
        const dailyTotal = dailyRows.reduce((s, d) => s + d.minutesSpent, 0);
        const dailyAvgMinutes = activeDays ? Math.round(dailyTotal / activeDays) : 0;

        // O'zlashtirish (mastery) = ishlangan (ball qo'yilgan) darslar bo'yicha
        // o'rtacha ball — talabaning material o'zlashtirish darajasi.
        const scored = progressRows.filter((p) => p.score != null);
        const mastery = scored.length
          ? Math.round(scored.reduce((s, p) => s + (p.score ?? 0), 0) / scored.length)
          : 0;

        const submissions = await this.submissionRepo.find({ where: { studentId: userId } });
        const lateAssignments = submissions.filter((s) => s.status === SubmissionStatus.late).length;

        // Oxirgi faollik = dars progressi eng so'nggi yangilangan vaqti (aniq
        // timestamp), gamification sanasi (kun aniqligida) esa zaxira.
        const lastActivityAt = this.resolveLastActivity(
          progressRows,
          gamification?.lastActivityDate ?? null,
        );
        const daysSinceActive = lastActivityAt
          ? Math.floor((Date.now() - lastActivityAt.getTime()) / 86400000)
          : 999;

        // Holat faqat faollik (kunlar) bo'yicha aniqlanadi — topshiriq berilmagan
        // faol talaba endi noto'g'ri "Xavf ostida" bo'lmaydi.
        const status = daysSinceActive > 7 ? 'risk' : daysSinceActive > 3 ? 'watch' : 'good';

        const reason =
          status === 'risk' || status === 'watch'
            ? daysSinceActive >= 999
              ? "Hali faol bo'lmagan"
              : `${daysSinceActive} kundan beri kirmagan`
            : null;

        return {
          id: userId,
          firstName: member.firstName ?? '',
          lastName: member.lastName ?? '',
          usageMinutes,
          dailyAvgMinutes,
          usageLabel: this.fmtDuration(usageMinutes),
          mastery,
          lastActiveAt: lastActivityAt ? lastActivityAt.toISOString() : null,
          status,
          daysSinceActive,
          lateAssignments,
          reason,
        };
      }),
    );

    const avgDailyMinutes = students.length
      ? Math.round(students.reduce((s, st) => s + st.dailyAvgMinutes, 0) / students.length)
      : 0;
    const avgMastery = students.length
      ? Math.round(students.reduce((s, st) => s + st.mastery, 0) / students.length)
      : 0;
    const atRiskCount = students.filter((s) => s.status === 'risk').length;
    const avgScore = await this.computeGroupAvgScore(memberIds);
    const weeklyActivity = await this.computeWeeklyActivity(memberIds);
    const avgScoreChangePercent = await this.computeGroupAvgScoreChange(memberIds);

    return {
      period,
      kpi: {
        avgDailyMinutes,
        avgDailyLabel: this.fmtDuration(avgDailyMinutes),
        avgMastery,
        avgScore,
        atRiskCount,
        avgScoreChangePercent,
      },
      weeklyActivity,
      students: students.map(({ daysSinceActive, ...rest }) => rest),
      atRiskStudents: students
        .filter((s) => s.status === 'risk' || s.status === 'watch')
        .map((s) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          status: s.status,
          reason: s.reason,
        })),
    };
  }

  /** Dars progressi timestamp'laridan (updatedAt/completedAt) eng so'nggi faollik
   *  vaqtini aniqlaydi; hech biri bo'lmasa gamification sanasiga (kun aniqligi)
   *  qaytadi. Bu "18 soat oldin"/"999 kun" kabi noto'g'ri ko'rsatishlarni bartaraf etadi. */
  private resolveLastActivity(
    rows: LessonProgress[],
    gamificationDate: string | null,
  ): Date | null {
    let latest: number | null = null;
    for (const p of rows) {
      for (const c of [p.updatedAt, p.completedAt]) {
        if (!c) continue;
        const t = new Date(c).getTime();
        if (!isNaN(t) && (latest === null || t > latest)) latest = t;
      }
    }
    if (latest !== null) return new Date(latest);
    if (gamificationDate) {
      const t = new Date(gamificationDate).getTime();
      if (!isNaN(t)) return new Date(t);
    }
    return null;
  }

  /** Guruh uchun haftalik faollik: har bir kun uchun kamida bitta dars/mashq
   *  yakunlagan o'quvchilar foizi (0-100), dushanbadan boshlab. */
  private async computeWeeklyActivity(
    memberIds: string[],
  ): Promise<Array<{ day: string; activeStudents: number }>> {
    const dayLabels = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    if (!memberIds.length) {
      return dayLabels.map((day) => ({ day, activeStudents: 0 }));
    }

    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0=Monday
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - dayOfWeek);

    const results: Array<{ day: string; activeStudents: number }> = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(monday);
      dayStart.setDate(monday.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      if (dayStart > now) {
        results.push({ day: dayLabels[i], activeStudents: 0 });
        continue;
      }

      // Kunlik faollik = shu kuni dars progressi yangilangan (quiz/listening ishlangan
      // yoki dars yakunlangan) o'quvchilar. Avval faqat yakunlangan darslar sanalardi.
      const activeCount = await this.progressRepo
        .createQueryBuilder('p')
        .select('COUNT(DISTINCT p.user_id)', 'count')
        .where('p.user_id IN (:...memberIds)', { memberIds })
        .andWhere('p.status <> :notStarted', { notStarted: LessonProgressStatus.not_started })
        .andWhere('p.updated_at >= :dayStart AND p.updated_at < :dayEnd', { dayStart, dayEnd })
        .getRawOne<{ count: string }>();

      const count = Number(activeCount?.count ?? 0);
      const pct = memberIds.length ? Math.round((count / memberIds.length) * 100) : 0;
      results.push({ day: dayLabels[i], activeStudents: pct });
    }

    return results;
  }

  /** Guruh a'zolarining haqiqiy topshiriq/dars bali asosida o'rtacha ball. */
  private async computeGroupAvgScore(memberIds: string[]): Promise<number> {
    if (!memberIds.length) return 0;

    const submissionAvg = await this.submissionRepo
      .createQueryBuilder('s')
      .select('AVG(s.score)', 'avg')
      .where('s.student_id IN (:...memberIds)', { memberIds })
      .andWhere('s.score IS NOT NULL')
      .getRawOne<{ avg: string | null }>();

    if (submissionAvg?.avg) {
      return Math.round(Number(submissionAvg.avg));
    }

    // Fallback: topshiriq bahosi bo'lmasa, dars progressidagi ballardan foydalanamiz
    const progressAvg = await this.progressRepo
      .createQueryBuilder('p')
      .select('AVG(p.score)', 'avg')
      .where('p.user_id IN (:...memberIds)', { memberIds })
      .andWhere('p.score IS NOT NULL')
      .getRawOne<{ avg: string | null }>();

    return progressAvg?.avg ? Math.round(Number(progressAvg.avg)) : 0;
  }

  /** Joriy va o'tgan haftadagi baholangan/topshirilgan submission bali o'zgarishi
   *  (mavjud submitted_at/graded_at tamg'alaridan, yangi snapshot infratuzilmasiz). */
  private async computeGroupAvgScoreChange(memberIds: string[]): Promise<number> {
    if (!memberIds.length) return 0;
    const now = new Date();
    const weekMs = 7 * 86400000;
    const thisWeekStart = new Date(now.getTime() - weekMs);
    const lastWeekStart = new Date(now.getTime() - 2 * weekMs);

    const thisWeekAvg = await this.submissionRepo
      .createQueryBuilder('s')
      .select('AVG(s.score)', 'avg')
      .where('s.student_id IN (:...memberIds)', { memberIds })
      .andWhere('s.score IS NOT NULL')
      .andWhere('s.graded_at >= :thisWeekStart', { thisWeekStart })
      .getRawOne<{ avg: string | null }>();

    const lastWeekAvg = await this.submissionRepo
      .createQueryBuilder('s')
      .select('AVG(s.score)', 'avg')
      .where('s.student_id IN (:...memberIds)', { memberIds })
      .andWhere('s.score IS NOT NULL')
      .andWhere('s.graded_at >= :lastWeekStart AND s.graded_at < :thisWeekStart', {
        lastWeekStart,
        thisWeekStart,
      })
      .getRawOne<{ avg: string | null }>();

    if (!thisWeekAvg?.avg || !lastWeekAvg?.avg) return 0;
    return Math.round(Number(thisWeekAvg.avg) - Number(lastWeekAvg.avg));
  }

  /** O'tgan haftadagi topshiriq bajarilish foizini joriy holat bilan solishtiradi. */
  private async computeAssignmentCompletionChange(
    memberIds: string[],
    currentAvgCompletion: number,
  ): Promise<number> {
    if (!memberIds.length) return 0;
    const now = new Date();
    const lastWeekEnd = new Date(now.getTime() - 7 * 86400000);

    const completedByLastWeek = await this.submissionRepo
      .createQueryBuilder('s')
      .where('s.student_id IN (:...memberIds)', { memberIds })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [SubmissionStatus.graded, SubmissionStatus.submitted],
      })
      .andWhere('s.submitted_at < :lastWeekEnd', { lastWeekEnd })
      .getCount();

    const totalAssignmentsAtStart = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.created_at < :lastWeekEnd', { lastWeekEnd })
      .getCount();

    if (!totalAssignmentsAtStart) return 0;

    const lastWeekCompletionPct = Math.round(
      (completedByLastWeek / (totalAssignmentsAtStart * memberIds.length)) * 100,
    );

    return currentAvgCompletion - lastWeekCompletionPct;
  }

  async getStudentMonitoring(studentId: string): Promise<any> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException("O'quvchi topilmadi");

    const gamification = await this.gamificationRepo.findOne({ where: { userId: studentId } });
    const skills = await this.skillRepo.find({ where: { userId: studentId } });

    // Barcha dars progressi (faqat yakunlangan emas) — boshlangan darslardagi
    // quiz/listening ishlari ham ko'rinishi uchun.
    const progressRows = await this.progressRepo.find({
      where: { userId: studentId },
      relations: ['lesson'],
    });
    const engagedLessons = progressRows.filter(
      (p) => p.status !== LessonProgressStatus.not_started,
    );
    const totalLessons = await this.lessonRepo.count();

    const allSubmissions = await this.submissionRepo.find({ where: { studentId } });

    const skillsMap: Record<string, any> = {};
    for (const skill of skills) {
      skillsMap[skill.skill] = { level: skill.cefrLevel, pct: skill.score };
    }

    const activityLogs = await this.activityRepo.find({ where: { userId: studentId } });
    const heatmap = activityLogs.map((log) => ({
      dayOfWeek: log.dayOfWeek,
      hour: log.hourOfDay,
      intensity: Math.min(4, log.durationMinutes),
    }));

    const studentGroup = await this.groupRepo.findOne({
      where: { members: { id: studentId } },
      relations: ['members'],
    });

    const scoredLessons = progressRows.filter((p) => p.score != null);
    const avgScore = scoredLessons.length
      ? Math.round(scoredLessons.reduce((s, p) => s + (p.score ?? 0), 0) / scoredLessons.length)
      : 0;
    const groupAvgScore = studentGroup
      ? await this.computeGroupAvgScore(studentGroup.members.map((m) => m.id))
      : 0;

    const attendance = totalLessons
      ? Math.min(100, Math.round((engagedLessons.length / totalLessons) * 100))
      : 0;

    // Foydalanish vaqti (Davomat) va o'zlashtirish (mastery) — guruh monitoringi
    // bilan bir xil ma'no.
    const usageMinutes = Math.round(
      progressRows.reduce((s, p) => s + (p.timeSpentSec ?? 0), 0) / 60,
    );
    const dailyRows = await this.dailyRepo.find({ where: { userId: studentId } });
    const activeDays = dailyRows.filter((d) => d.minutesSpent > 0).length;
    const dailyAvgMinutes = activeDays
      ? Math.round(dailyRows.reduce((s, d) => s + d.minutesSpent, 0) / activeDays)
      : 0;
    const mastery = avgScore;

    const lastActivityAt = this.resolveLastActivity(
      progressRows,
      gamification?.lastActivityDate ?? null,
    );
    const daysSinceActive = lastActivityAt
      ? Math.floor((Date.now() - lastActivityAt.getTime()) / 86400000)
      : 999;
    const studentStatus = daysSinceActive > 7 ? 'risk' : daysSinceActive > 3 ? 'watch' : 'good';

    // Joriy hafta o'rtacha ballini o'tgan hafta bilan solishtirish (mavjud completedAt
    // vaqt tamg'alari asosida, alohida tarixiy jadval talab qilinmaydi)
    const weeklyChangePercent = this.computeWeeklyScoreChange(scoredLessons);

    return {
      student: {
        id: student.id,
        firstName: student.firstName ?? '',
        lastName: student.lastName ?? '',
        email: student.email ?? null,
        group: studentGroup ? { id: studentGroup.id, name: studentGroup.name } : null,
        joinedAt: student.createdAt,
        lastActiveAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        status: studentStatus,
      },
      summary: {
        streak: gamification?.streakCurrent ?? 0,
        totalTime: `${Math.round(progressRows.reduce((s, p) => s + p.timeSpentSec, 0) / 60)}m`,
        rankInGroup: gamification?.rankWeekly ?? null,
      },
      kpi: {
        avgScore,
        groupAvgScore,
        attendance,
        usageMinutes,
        usageLabel: this.fmtDuration(usageMinutes),
        dailyAvgMinutes,
        dailyAvgLabel: this.fmtDuration(dailyAvgMinutes),
        mastery,
        completedAssignments: allSubmissions.filter((s) => s.status !== SubmissionStatus.pending).length,
        totalAssignments: allSubmissions.length,
        lateAssignments: allSubmissions.filter((s) => s.status === SubmissionStatus.late).length,
        weeklyActiveTime: `${Math.round((gamification?.xpWeekly ?? 0) / 10)}m`,
        weeklyChangePercent,
      },
      skills: skillsMap,
      vocabulary: { total: 0, retention: 0, weeklyGain: 0 },
      activityHeatmap: heatmap,
      weeklyMinutes: [],
      // Boshlangan darslar (faqat yakunlangan emas) — quiz/listening ishlari ko'rinadi
      topicStats: engagedLessons.map((p) => ({
        lessonCode: p.lesson?.orderIndex,
        title: p.lesson?.lessonName,
        score: p.score != null ? `${p.score}%` : '—',
        timeSpent: `${Math.round(p.timeSpentSec / 60)}m`,
        attempts: p.attempts,
      })),
      recentAssignments: allSubmissions.slice(0, 5).map((s) => ({
        status: s.status,
        score: s.score,
        submittedAt: s.submittedAt,
      })),
    };
  }

  /** completedAt vaqt tamg'asi mavjud bo'lgan darslar asosida joriy va o'tgan
   *  haftalik o'rtacha ball farqini foizda hisoblaydi (yangi tarixiy jadvalsiz). */
  private computeWeeklyScoreChange(completedLessons: LessonProgress[]): number {
    const now = Date.now();
    const weekMs = 7 * 86400000;
    const thisWeekStart = now - weekMs;
    const lastWeekStart = now - 2 * weekMs;

    const scored = completedLessons.filter((p) => p.completedAt && p.score != null);
    const thisWeek = scored.filter((p) => new Date(p.completedAt!).getTime() >= thisWeekStart);
    const lastWeek = scored.filter(
      (p) =>
        new Date(p.completedAt!).getTime() >= lastWeekStart &&
        new Date(p.completedAt!).getTime() < thisWeekStart,
    );

    if (!thisWeek.length || !lastWeek.length) return 0;

    const thisAvg = thisWeek.reduce((s, p) => s + (p.score ?? 0), 0) / thisWeek.length;
    const lastAvg = lastWeek.reduce((s, p) => s + (p.score ?? 0), 0) / lastWeek.length;

    return Math.round(thisAvg - lastAvg);
  }

  /** Berilgan topshiriq uchun submission statuslari bo'yicha agregat
   *  (Topshirildi/Kutilmoqda/Kechikkan) — mavjud AssignmentSubmission jadvalidan. */
  async getAssignmentStatusBreakdown(assignmentId: string): Promise<any> {
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Topshiriq topilmadi');

    const submissions = await this.submissionRepo.find({ where: { assignmentId } });
    const group = assignment.groupId
      ? await this.groupRepo.findOne({ where: { id: assignment.groupId }, relations: ['members'] })
      : null;
    const total = group?.members?.length ?? submissions.length;

    const submitted = submissions.filter(
      (s) => s.status === SubmissionStatus.submitted || s.status === SubmissionStatus.graded,
    ).length;
    const late = submissions.filter((s) => s.status === SubmissionStatus.late).length;
    const pending = Math.max(0, total - submitted - late);

    return {
      assignmentId,
      title: assignment.title,
      total,
      breakdown: {
        submitted,
        pending,
        late,
      },
    };
  }
}

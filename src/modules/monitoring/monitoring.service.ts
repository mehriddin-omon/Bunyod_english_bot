import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Assignment, AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { UserGamification, UserSkill } from 'src/common/core/entitys/gamification.entity';
import { ActivityLog, DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { LessonProgressStatus, Role, SubmissionStatus } from 'src/common/utils/enum';

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

    // Yig'ma so'rovlar xom SQL bilan — group-panels.service.ts uslubida
    @InjectDataSource()
    private readonly ds: DataSource,
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

  /**
   * O'quvchi detali — `/teacher/students/[id]` sahifasi uchun.
   *
   * Har bir blok bitta yig'ma SQL so'rov bilan olinadi (N+1 yo'q, CLAUDE.md qoidasi).
   * Manbalar: davomat -> `attendance`, ko'nikmalar -> `lesson_progress.*_score`
   * (writing -> `assignment_submissions`, chunki `writing_score` ustuni yo'q),
   * heatmap -> `student_answers.answered_at`, haftalik daqiqa -> `daily_tracking`.
   */
  async getStudentMonitoring(
    studentId: string,
    viewer?: { sub: string; role: string },
  ): Promise<any> {
    const [profile] = await this.ds.query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.email, u.avatar_url,
              u.created_at, u.is_active,
              sp.cefr_level,
              ug.streak_current, ug.streak_max, ug.xp_total, ug.xp_weekly,
              ug.league, ug.last_activity_date
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         LEFT JOIN user_gamification ug ON ug.user_id = u.id
        WHERE u.id = $1`,
      [studentId],
    );
    if (!profile) throw new NotFoundException("O'quvchi topilmadi");

    const [group] = await this.ds.query(
      `SELECT g.id, g.name, g.teacher_id
         FROM groups g
         JOIN group_members m ON m.group_id = g.id
        WHERE m.user_id = $1
        ORDER BY g.created_at DESC
        LIMIT 1`,
      [studentId],
    );

    // Teacher/subTeacher faqat o'z guruhidagi o'quvchini ko'radi
    if (viewer && viewer.role !== Role.admin && viewer.role !== Role.superAdmin) {
      const [own] = await this.ds.query(
        `SELECT 1
           FROM group_members m
           JOIN groups g ON g.id = m.group_id
          WHERE m.user_id = $1 AND g.teacher_id = $2
          LIMIT 1`,
        [studentId, viewer.sub],
      );
      if (!own) throw new ForbiddenException("Bu o'quvchi sizning guruhingizda emas");
    }

    const groupId: string | null = group?.id ?? null;
    const weekStart = this.startOfWeek(new Date());
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000);

    const [
      [progressAgg],
      [attendanceAgg],
      [writingAgg],
      [assignmentAgg],
      [vocabAgg],
      vocabByLevel,
      heatmapRows,
      dailyRows,
      topicRows,
      assignmentRows,
      [groupAgg],
    ] = await Promise.all([
      // 1. Dars progressi + ko'nikma ballari
      this.ds.query(
        `SELECT count(*) FILTER (WHERE lp.status <> 'not_started')::int AS engaged,
                count(*) FILTER (WHERE lp.status = 'completed')::int AS completed,
                avg(lp.score) AS avg_score,
                COALESCE(sum(lp.time_spent_sec), 0)::bigint AS total_sec,
                avg(lp.grammar_score) AS grammar,
                avg(lp.reading_score) AS reading,
                avg(lp.listening_score) AS listening,
                avg(lp.speaking_score) AS speaking,
                avg(lp.vocabulary_score) AS vocabulary,
                max(lp.updated_at) AS last_progress_at
           FROM lesson_progress lp
          WHERE lp.user_id = $1`,
        [studentId],
      ),

      // 2. Davomat — `attendance` jadvalidan (progressdan emas)
      this.ds.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE a.status IN ('present','late'))::int AS attended,
                count(*) FILTER (WHERE a.status = 'late')::int AS late,
                count(*) FILTER (WHERE a.status = 'absent')::int AS absent,
                count(*) FILTER (WHERE s.session_date >= (now() - interval '30 days'))::int AS total_30,
                count(*) FILTER (WHERE s.session_date >= (now() - interval '30 days')
                                   AND a.status IN ('present','late'))::int AS attended_30
           FROM attendance a
           JOIN schedule_sessions s ON s.id = a.session_id
          WHERE a.user_id = $1`,
        [studentId],
      ),

      // 3. Writing ko'nikmasi — writing turidagi baholangan topshiriqlar o'rtachasi
      this.ds.query(
        `SELECT avg(s.score::float / NULLIF(a.max_score, 0) * 100) AS pct,
                count(*)::int AS graded
           FROM assignment_submissions s
           JOIN assignments a ON a.id = s.assignment_id
          WHERE s.student_id = $1 AND a.type = 'writing' AND s.score IS NOT NULL`,
        [studentId],
      ),

      // 4. Topshiriqlar KPI si — jami guruhga berilganidan, bajarilgani submissionlardan
      this.ds.query(
        `SELECT (SELECT count(*)::int FROM assignments a
                  WHERE a.status <> 'draft' AND a.group_id = $2::uuid) AS total,
                count(*) FILTER (WHERE s.status IN ('submitted','graded','late'))::int AS completed,
                count(*) FILTER (WHERE s.status = 'late')::int AS late,
                count(*) FILTER (WHERE s.status IN ('pending','revision_needed'))::int AS pending
           FROM assignment_submissions s
          WHERE s.student_id = $1`,
        [studentId, groupId],
      ),

      // 5. Lug'at: o'zlashtirilgan / o'rganilayotgan / shu hafta qo'shilgani
      this.ds.query(
        `SELECT count(*) FILTER (WHERE uvp.status = 'mastered')::int AS mastered,
                count(*) FILTER (WHERE uvp.status = 'learning')::int AS learning,
                count(*) FILTER (WHERE uvp.status = 'mastered'
                                   AND uvp.updated_at >= $2::timestamptz)::int AS weekly_gain
           FROM user_vocabulary_progress uvp
          WHERE uvp.user_id = $1`,
        [studentId, weekStart.toISOString()],
      ),

      // 6. Lug'at CEFR kesimida — so'z darsi orqali (vocabularys da cefr ustuni yo'q)
      this.ds.query(
        `SELECT COALESCE(l.cefr_level, '?') AS level, count(*)::int AS count
           FROM user_vocabulary_progress uvp
           JOIN vocabulary_relations vr ON vr.id = uvp.pair_id
           JOIN vocabularys v ON v.id = vr.vocabulary_id
           LEFT JOIN lessons l ON l.id = v.lesson_id
          WHERE uvp.user_id = $1 AND uvp.status = 'mastered'
          GROUP BY 1
          ORDER BY 1`,
        [studentId],
      ),

      // 7. Faollik heatmapi — javob berilgan payt (hafta kuni x soat), mahalliy vaqtda
      this.ds.query(
        `SELECT (EXTRACT(ISODOW FROM sa.answered_at AT TIME ZONE 'Asia/Tashkent')::int - 1) AS dow,
                EXTRACT(HOUR FROM sa.answered_at AT TIME ZONE 'Asia/Tashkent')::int AS hour,
                count(*)::int AS count
           FROM student_answers sa
          WHERE sa.user_id = $1
            AND sa.answered_at >= now() - interval '90 days'
          GROUP BY 1, 2`,
        [studentId],
      ),

      // 8. Kunlik daqiqalar (joriy va o'tgan hafta)
      this.ds.query(
        `SELECT d.date::text AS date, d.minutes_spent::int AS minutes
           FROM daily_tracking d
          WHERE d.user_id = $1 AND d.date >= $2::date
          ORDER BY d.date`,
        [studentId, prevWeekStart.toISOString().slice(0, 10)],
      ),

      // 9. Mavzular bo'yicha statistika
      this.ds.query(
        `SELECT l.order_index, l.lesson_name, l.cefr_level,
                u.number AS unit_number, u.title AS unit_title,
                lp.status, lp.score, lp.time_spent_sec::int AS time_spent_sec,
                lp.attempts::int AS attempts, lp.completed_at
           FROM lesson_progress lp
           JOIN lessons l ON l.id = lp.lesson_id
           LEFT JOIN units u ON u.id = l.unit_id
          WHERE lp.user_id = $1 AND lp.status <> 'not_started'
          ORDER BY l.order_index
          LIMIT 30`,
        [studentId],
      ),

      // 10. So'nggi topshiriqlar
      this.ds.query(
        `SELECT a.id, a.title, a.type, a.due_date, a.max_score,
                s.status, s.score, s.submitted_at, s.graded_at
           FROM assignment_submissions s
           JOIN assignments a ON a.id = s.assignment_id
          WHERE s.student_id = $1
          ORDER BY COALESCE(s.submitted_at, s.updated_at) DESC
          LIMIT 5`,
        [studentId],
      ),

      // 11. Guruh o'rtachasi va o'quvchining guruhdagi o'rni
      groupId
        ? this.ds.query(
            `SELECT (SELECT avg(lp.score)
                       FROM lesson_progress lp
                       JOIN group_members m ON m.user_id = lp.user_id
                      WHERE m.group_id = $1 AND lp.score IS NOT NULL) AS avg_score,
                    (SELECT count(*)::int FROM group_members m WHERE m.group_id = $1) AS size,
                    (SELECT count(*)::int + 1
                       FROM group_members m
                       LEFT JOIN user_gamification ug ON ug.user_id = m.user_id
                      WHERE m.group_id = $1
                        AND COALESCE(ug.xp_total, 0) >
                            COALESCE((SELECT xp_total FROM user_gamification WHERE user_id = $2), 0)
                    ) AS rank`,
            [groupId, studentId],
          )
        : Promise.resolve([undefined]),
    ]);

    // ── Ko'nikmalar ───────────────────────────────────────────────────────────
    const vocabTotal = vocabAgg?.mastered ?? 0;
    const skills = [
      { key: 'grammar', label: 'Grammar', pct: this.roundOrNull(progressAgg?.grammar) },
      { key: 'reading', label: 'Reading', pct: this.roundOrNull(progressAgg?.reading) },
      { key: 'listening', label: 'Listening', pct: this.roundOrNull(progressAgg?.listening) },
      { key: 'speaking', label: 'Speaking', pct: this.roundOrNull(progressAgg?.speaking) },
      {
        key: 'writing',
        label: 'Writing',
        pct: writingAgg?.graded ? this.roundOrNull(writingAgg.pct) : null,
        note: writingAgg?.graded ? null : 'baholangan ish yo\'q',
      },
      {
        key: 'vocabulary',
        label: "Lug'at boyligi",
        pct: this.roundOrNull(progressAgg?.vocabulary),
        note: vocabTotal ? `${vocabTotal} so'z` : null,
      },
    ].map((s) => ({
      ...s,
      note: (s as any).note ?? null,
      // CEFR yorlig'i foizdan chiqariladi — `user_skills` jadvaliga runtime'da hech kim yozmaydi
      level: this.cefrFromPct(s.pct),
    }));

    // ── Heatmap ───────────────────────────────────────────────────────────────
    const maxBucket = heatmapRows.reduce((m: number, r: any) => Math.max(m, r.count), 0);
    const heatmap = heatmapRows.map((r: any) => ({
      dayOfWeek: r.dow,
      hour: r.hour,
      count: r.count,
      intensity: maxBucket ? Math.max(1, Math.ceil((r.count / maxBucket) * 4)) : 0,
    }));
    const peakLabel = this.resolvePeakHours(heatmapRows);

    // ── Haftalik daqiqalar ────────────────────────────────────────────────────
    const dailyMap = new Map<string, number>(
      dailyRows.map((d: any) => [d.date, d.minutes]),
    );
    const DAY_LABELS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const weeklyActivity = DAY_LABELS.map((label, i) => {
      const date = new Date(weekStart.getTime() + i * 86400000).toISOString().slice(0, 10);
      return { day: label, date, minutes: dailyMap.get(date) ?? 0 };
    });
    const weeklyMinutes = weeklyActivity.reduce((sum, d) => sum + d.minutes, 0);
    const prevWeekMinutes = dailyRows
      .filter((d: any) => d.date < weeklyActivity[0].date)
      .reduce((sum: number, d: any) => sum + d.minutes, 0);
    const weeklyChangePercent = prevWeekMinutes
      ? Math.round(((weeklyMinutes - prevWeekMinutes) / prevWeekMinutes) * 100)
      : null;

    // ── Holat ─────────────────────────────────────────────────────────────────
    const lastActiveAt: Date | null =
      progressAgg?.last_progress_at ??
      (profile.last_activity_date ? new Date(profile.last_activity_date) : null);
    const daysSinceActive = lastActiveAt
      ? Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 86400000)
      : null;
    const avgScore = this.roundOrNull(progressAgg?.avg_score) ?? 0;
    const attendanceRate = this.pct(attendanceAgg?.attended, attendanceAgg?.total);
    const status =
      daysSinceActive == null || daysSinceActive > 7 || attendanceRate < 60 || avgScore < 60
        ? 'risk'
        : daysSinceActive > 3 || attendanceRate < 75 || avgScore < 75
          ? 'watch'
          : 'good';

    const totalMinutes = Math.round(Number(progressAgg?.total_sec ?? 0) / 60);

    return {
      student: {
        id: profile.id,
        firstName: profile.first_name ?? '',
        lastName: profile.last_name ?? '',
        username: profile.username ?? null,
        email: profile.email ?? null,
        avatarUrl: profile.avatar_url ?? null,
        cefrLevel: profile.cefr_level ?? null,
        isActive: profile.is_active,
        joinedAt: profile.created_at,
        lastActiveAt,
        daysSinceActive,
        status,
        group: group ? { id: group.id, name: group.name } : null,
      },
      summary: {
        streak: profile.streak_current ?? 0,
        streakMax: profile.streak_max ?? 0,
        xpTotal: profile.xp_total ?? 0,
        league: profile.league ?? null,
        totalMinutes,
        totalLabel: this.fmtDuration(totalMinutes),
        rankInGroup: groupAgg?.rank ?? null,
        groupSize: groupAgg?.size ?? null,
      },
      kpi: {
        avgScore,
        groupAvgScore: this.roundOrNull(groupAgg?.avg_score) ?? 0,
        attendanceRate: this.pct(attendanceAgg?.attended_30, attendanceAgg?.total_30),
        attendedSessions: attendanceAgg?.attended_30 ?? 0,
        totalSessions: attendanceAgg?.total_30 ?? 0,
        attendanceRateAllTime: attendanceRate,
        lateSessions: attendanceAgg?.late ?? 0,
        completedAssignments: assignmentAgg?.completed ?? 0,
        // Guruhsiz o'quvchida `total` 0 chiqadi — bajarilganidan kichik bo'lib qolmasin
        totalAssignments: Math.max(assignmentAgg?.total ?? 0, assignmentAgg?.completed ?? 0),
        lateAssignments: assignmentAgg?.late ?? 0,
        completedLessons: progressAgg?.completed ?? 0,
        weeklyMinutes,
        weeklyLabel: this.fmtDuration(weeklyMinutes),
        weeklyChangePercent,
      },
      skills,
      vocabulary: {
        total: vocabTotal,
        learning: vocabAgg?.learning ?? 0,
        weeklyGain: vocabAgg?.weekly_gain ?? 0,
        retention: this.pct(vocabAgg?.mastered, (vocabAgg?.mastered ?? 0) + (vocabAgg?.learning ?? 0)),
        byLevel: vocabByLevel.map((r: any) => ({ level: r.level, count: r.count })),
      },
      activity: { heatmap, peakLabel },
      weeklyActivity,
      topicStats: topicRows.map((r: any) => ({
        lessonCode:
          r.unit_number != null ? `${r.unit_number}.${r.order_index}` : `${r.order_index}`,
        unitTitle: r.unit_title ?? null,
        title: r.lesson_name,
        cefrLevel: r.cefr_level ?? null,
        status: r.status,
        // Alohida "bajarildi %" ustuni yo'q — status dan chiqariladi
        completion: r.status === 'completed' ? 100 : r.status === 'in_progress' ? 50 : 0,
        score: r.score,
        timeSpentSec: r.time_spent_sec,
        timeLabel: r.time_spent_sec ? this.fmtDuration(Math.round(r.time_spent_sec / 60)) : null,
        attempts: r.attempts,
        completedAt: r.completed_at,
      })),
      recentAssignments: assignmentRows.map((r: any) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        score: r.score,
        maxScore: r.max_score,
        dueDate: r.due_date,
        submittedAt: r.submitted_at,
        gradedAt: r.graded_at,
      })),
    };
  }

  /** Dushanba 00:00 (mahalliy) */
  private startOfWeek(d: Date): Date {
    const day = (d.getDay() + 6) % 7; // 0 = Dushanba
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day);
    return start;
  }

  private pct(part?: number | null, total?: number | null): number {
    if (!total) return 0;
    return Math.round(((part ?? 0) / total) * 100);
  }

  private roundOrNull(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  /** Foizdan CEFR yorlig'i (`user_skills` jadvaliga runtime'da yozilmagani uchun) */
  private cefrFromPct(pct: number | null): string | null {
    if (pct == null) return null;
    if (pct < 40) return 'A1';
    if (pct < 55) return 'A2';
    if (pct < 70) return 'B1';
    if (pct < 85) return 'B2';
    if (pct < 95) return 'C1';
    return 'C2';
  }

  /** Eng faol 2 soatlik oraliq, masalan "16:00–18:00" */
  private resolvePeakHours(rows: Array<{ hour: number; count: number }>): string | null {
    if (!rows.length) return null;
    const byHour = new Array(24).fill(0);
    for (const r of rows) byHour[r.hour] += r.count;

    let bestStart = 0;
    let best = -1;
    for (let h = 0; h < 23; h++) {
      const sum = byHour[h] + byHour[h + 1];
      if (sum > best) {
        best = sum;
        bestStart = h;
      }
    }
    if (best <= 0) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(bestStart)}:00–${pad(bestStart + 2)}:00`;
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

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { Role } from 'src/common/utils/enum';
import { LessonGatingService } from 'src/common/services/lesson-gating.service';

/**
 * Guruhni boshqarish sahifasi uchun panel endpointlari.
 *
 * CLAUDE.md qoidasi: har bir panel o'z endpointidan o'qiydi — bitta katta
 * "hamma narsa" so'rovi yasalmaydi. Shu sababli bu servisdagi har bir metod
 * mustaqil ishlaydi va faqat o'ziga kerakli ma'lumotni oladi.
 *
 * Barcha yig'indi ko'rsatkichlar bitta `GROUP BY` so'rovi bilan olinadi —
 * har bir o'quvchi uchun alohida so'rov yuborilmaydi (N+1 yo'q).
 */

/** Du=0 … Ya=6 (schedules.days_of_week shu formatda saqlanadi) */
const DAY_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function hhmm(time: string | null): string {
  return time ? time.slice(0, 5) : '';
}

/** "16:30" + 90 daqiqa → "18:00" */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = hhmm(time).split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseDays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d) => typeof d === 'number') : [];
  } catch {
    return [];
  }
}

/** "2026-08-17" → "17.08.2026" */
function dateLabel(value: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** JS getDay() (0=Yakshanba) → loyiha formati (0=Dushanba) */
function projDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

@Injectable()
export class GroupPanelsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
    private readonly gating: LessonGatingService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Umumiy yordamchilar
  // ──────────────────────────────────────────────────────────────────────────

  /** Guruhni topadi va foydalanuvchining ko'rish huquqini tekshiradi */
  private async loadGroup(groupId: string, userId: string, role: string): Promise<Group> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const privileged = role === Role.admin || role === Role.superAdmin;
    if (!privileged && group.teacherId !== userId) {
      throw new ForbiddenException('Bu guruh sizga tegishli emas');
    }
    return group;
  }

  private async memberIds(groupId: string): Promise<string[]> {
    const rows: { user_id: string }[] = await this.ds.query(
      `SELECT user_id FROM group_members WHERE group_id = $1`,
      [groupId],
    );
    return rows.map((r) => r.user_id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  GET /groups/:id/overview — sarlavha + KPI kartochkalari
  // ──────────────────────────────────────────────────────────────────────────
  async getOverview(groupId: string, userId: string, role: string) {
    const group = await this.loadGroup(groupId, userId, role);
    const members = await this.memberIds(groupId);

    const [teacherRows, scheduleRows, sessionAgg, nextRows, lastRows, progressAgg, attendanceAgg, dailyAgg, gamAgg, pendingRows, blockedRows, activityRows] =
      await Promise.all([
        group.teacherId
          ? this.ds.query(
              `SELECT id, first_name AS "firstName", last_name AS "lastName", role, avatar_url AS "avatarUrl"
                 FROM users WHERE id = $1`,
              [group.teacherId],
            )
          : Promise.resolve([]),

        this.ds.query(
          `SELECT id, days_of_week AS "daysOfWeek", start_time AS "startTime",
                  duration_minutes AS "durationMinutes", topic,
                  valid_from AS "validFrom", valid_until AS "validUntil", is_recurring AS "isRecurring"
             FROM schedules WHERE group_id = $1 ORDER BY created_at ASC`,
          [groupId],
        ),

        this.ds.query(
          `SELECT count(*) FILTER (WHERE status = 'completed') AS completed,
                  count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                  count(*) FILTER (WHERE status = 'scheduled') AS scheduled,
                  count(*) AS total
             FROM schedule_sessions WHERE group_id = $1`,
          [groupId],
        ),

        this.ds.query(
          `SELECT id, session_date AS "date", start_time AS "startTime",
                  duration_minutes AS "durationMinutes", topic, status
             FROM schedule_sessions
            WHERE group_id = $1 AND session_date >= CURRENT_DATE AND status <> 'cancelled'
         ORDER BY session_date ASC, start_time ASC LIMIT 1`,
          [groupId],
        ),

        this.ds.query(
          `SELECT id, session_date AS "date", start_time AS "startTime", topic, status
             FROM schedule_sessions
            WHERE group_id = $1 AND session_date < CURRENT_DATE AND status = 'completed'
         ORDER BY session_date DESC LIMIT 1`,
          [groupId],
        ),

        members.length
          ? this.ds.query(
              `SELECT count(*) FILTER (WHERE status = 'completed') AS completed,
                      count(*) FILTER (WHERE status = 'in_progress') AS in_progress,
                      round(avg(score) FILTER (WHERE score IS NOT NULL)) AS avg_score,
                      coalesce(sum(time_spent_sec), 0) AS time_spent
                 FROM lesson_progress WHERE user_id = ANY($1)`,
              [members],
            )
          : Promise.resolve([]),

        this.ds.query(
          `SELECT count(*) FILTER (WHERE a.status IN ('present','late')) AS attended,
                  count(*) FILTER (WHERE a.status = 'present') AS present,
                  count(*) FILTER (WHERE a.status = 'late') AS late,
                  count(*) FILTER (WHERE a.status = 'absent') AS absent,
                  count(*) FILTER (WHERE a.status = 'excused') AS excused,
                  count(*) AS total
             FROM attendance a
             JOIN schedule_sessions s ON s.id = a.session_id
            WHERE s.group_id = $1`,
          [groupId],
        ),

        members.length
          ? this.ds.query(
              `SELECT round(avg(minutes_spent)) AS avg_min
                 FROM daily_tracking WHERE user_id = ANY($1) AND minutes_spent > 0`,
              [members],
            )
          : Promise.resolve([]),

        members.length
          ? this.ds.query(
              `SELECT round(avg(xp_total)) AS avg_xp, round(avg(streak_current)) AS avg_streak,
                      max(streak_current) AS max_streak
                 FROM user_gamification WHERE user_id = ANY($1)`,
              [members],
            )
          : Promise.resolve([]),

        this.ds.query(
          `SELECT count(*) AS pending
             FROM assignment_submissions sub
             JOIN assignments a ON a.id = sub.assignment_id
            WHERE a.group_id = $1 AND sub.status = 'submitted' AND sub.graded_at IS NULL`,
          [groupId],
        ),

        members.length
          ? this.ds.query(
              `SELECT count(*) FILTER (WHERE is_active = false) AS blocked FROM users WHERE id = ANY($1)`,
              [members],
            )
          : Promise.resolve([]),

        members.length
          ? this.ds.query(
              `SELECT count(*) FILTER (WHERE last_seen > now() - interval '3 days') AS active_3d,
                      count(*) FILTER (WHERE last_seen IS NULL OR last_seen < now() - interval '7 days') AS risk
                 FROM (
                   SELECT u.id,
                          GREATEST(
                            (SELECT max(lp.updated_at) FROM lesson_progress lp WHERE lp.user_id = u.id),
                            (SELECT max(g.last_activity_date)::timestamptz FROM user_gamification g WHERE g.user_id = u.id)
                          ) AS last_seen
                     FROM users u WHERE u.id = ANY($1)
                 ) t`,
              [members],
            )
          : Promise.resolve([]),
      ]);

    const schedule = scheduleRows[0] ?? null;
    const days = schedule ? parseDays(schedule.daysOfWeek) : [];
    const duration = schedule ? num(schedule.durationMinutes) || 90 : 0;
    const startTime = schedule ? hhmm(schedule.startTime) : '';

    const att = attendanceAgg[0] ?? {};
    const prog = progressAgg[0] ?? {};
    const ceilingIndex = await this.gating.getGroupCeilingIndex(group);

    const totalProgressRows = num(prog.completed) + num(prog.in_progress);

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      description: group.description,
      status: group.status,
      createdAtLabel: dateLabel(group.createdAt),
      teacher: teacherRows[0]
        ? {
            id: teacherRows[0].id,
            firstName: teacherRows[0].firstName,
            lastName: teacherRows[0].lastName,
            role: teacherRows[0].role,
            avatarUrl: teacherRows[0].avatarUrl,
          }
        : null,

      autoAdvanceEnabled: group.autoAdvanceEnabled,
      manualLessonCeiling: group.manualLessonCeiling,
      ceilingIndex,

      studentCount: members.length,
      blockedStudents: num(blockedRows[0]?.blocked),
      activeStudents: num(activityRows[0]?.active_3d),
      riskStudents: num(activityRows[0]?.risk),

      schedule: schedule
        ? {
            days,
            daysLabel: days.map((d) => DAY_SHORT[d] ?? '').filter(Boolean).join('/'),
            startTime,
            endTime: addMinutes(startTime, duration),
            durationMinutes: duration,
            topic: schedule.topic ?? null,
            validFrom: schedule.validFrom ?? null,
            validUntil: schedule.validUntil ?? null,
            isRecurring: schedule.isRecurring ?? true,
          }
        : null,

      sessions: {
        total: num(sessionAgg[0]?.total),
        completed: num(sessionAgg[0]?.completed),
        cancelled: num(sessionAgg[0]?.cancelled),
        scheduled: num(sessionAgg[0]?.scheduled),
      },
      nextSession: nextRows[0]
        ? {
            id: nextRows[0].id,
            date: nextRows[0].date,
            dateLabel: dateLabel(nextRows[0].date),
            startTime: hhmm(nextRows[0].startTime),
            topic: nextRows[0].topic ?? null,
            status: nextRows[0].status,
          }
        : null,
      lastSession: lastRows[0]
        ? {
            id: lastRows[0].id,
            date: lastRows[0].date,
            dateLabel: dateLabel(lastRows[0].date),
            topic: lastRows[0].topic ?? null,
          }
        : null,

      kpi: {
        // Davomat = haqiqiy `attendance` jadvalidan (dars progressidan emas)
        attendanceRate: pct(num(att.attended), num(att.total)),
        attendanceBreakdown: {
          present: num(att.present),
          late: num(att.late),
          absent: num(att.absent),
          excused: num(att.excused),
          total: num(att.total),
        },
        avgScore: num(prog.avg_score),
        completedLessons: num(prog.completed),
        inProgressLessons: num(prog.in_progress),
        avgProgressPerStudent: members.length ? Math.round(num(prog.completed) / members.length) : 0,
        lessonCompletionRate: pct(num(prog.completed), totalProgressRows),
        totalHours: Math.round(num(prog.time_spent) / 3600),
        avgDailyMinutes: num(dailyAgg[0]?.avg_min),
        avgXp: num(gamAgg[0]?.avg_xp),
        avgStreak: num(gamAgg[0]?.avg_streak),
        maxStreak: num(gamAgg[0]?.max_streak),
        pendingReviews: num(pendingRows[0]?.pending),
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  GET /groups/:id/students — o'quvchilar ko'rsatkichlari jadvali
  // ──────────────────────────────────────────────────────────────────────────
  async getStudents(groupId: string, userId: string, role: string) {
    await this.loadGroup(groupId, userId, role);
    const members = await this.memberIds(groupId);
    if (!members.length) return { total: 0, students: [] };

    const [users, progress, attendance, submissions, daily, settings] = await Promise.all([
      this.ds.query(
        `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.username,
                u.avatar_url AS "avatarUrl", u.phone_number AS "phone", u.is_active AS "isActive",
                sp.cefr_level AS "cefrLevel",
                g.xp_total AS "xpTotal", g.level, g.league,
                g.streak_current AS "streakCurrent", g.rank_weekly AS "rankWeekly",
                g.xp_weekly AS "xpWeekly", g.last_activity_date AS "lastActivityDate"
           FROM users u
      LEFT JOIN student_profiles sp ON sp.user_id = u.id
      LEFT JOIN user_gamification g ON g.user_id = u.id
          WHERE u.id = ANY($1)`,
        [members],
      ),

      this.ds.query(
        `SELECT user_id,
                count(*) FILTER (WHERE status = 'completed') AS completed,
                count(*) FILTER (WHERE status = 'in_progress') AS in_progress,
                round(avg(score) FILTER (WHERE score IS NOT NULL)) AS avg_score,
                coalesce(sum(time_spent_sec), 0) AS time_spent,
                max(updated_at) AS last_progress_at
           FROM lesson_progress WHERE user_id = ANY($1) GROUP BY user_id`,
        [members],
      ),

      this.ds.query(
        `SELECT a.user_id,
                count(*) FILTER (WHERE a.status IN ('present','late')) AS attended,
                count(*) FILTER (WHERE a.status = 'late') AS late,
                count(*) FILTER (WHERE a.status = 'absent') AS absent,
                count(*) FILTER (WHERE a.status = 'excused') AS excused,
                count(*) AS total
           FROM attendance a
           JOIN schedule_sessions s ON s.id = a.session_id
          WHERE s.group_id = $1
       GROUP BY a.user_id`,
        [groupId],
      ),

      this.ds.query(
        `SELECT sub.student_id,
                count(*) AS total,
                count(*) FILTER (WHERE sub.status IN ('submitted','graded','late')) AS submitted,
                count(*) FILTER (WHERE sub.status = 'graded') AS graded,
                count(*) FILTER (WHERE sub.status = 'late') AS late,
                round(avg(sub.score) FILTER (WHERE sub.score IS NOT NULL)) AS avg_score
           FROM assignment_submissions sub
           JOIN assignments a ON a.id = sub.assignment_id
          WHERE a.group_id = $1
       GROUP BY sub.student_id`,
        [groupId],
      ),

      this.ds.query(
        `SELECT user_id, round(avg(minutes_spent)) AS avg_min, count(*) AS active_days,
                max(date) AS last_day
           FROM daily_tracking WHERE user_id = ANY($1) AND minutes_spent > 0 GROUP BY user_id`,
        [members],
      ),

      this.ds.query(
        `SELECT user_id, is_free AS "isFree", manual_unlock_ceiling AS "manualUnlockCeiling"
           FROM group_member_settings WHERE group_id = $1`,
        [groupId],
      ),
    ]);

    const progMap = new Map(progress.map((r: any) => [r.user_id, r]));
    const attMap = new Map(attendance.map((r: any) => [r.user_id, r]));
    const subMap = new Map(submissions.map((r: any) => [r.student_id, r]));
    const dailyMap = new Map(daily.map((r: any) => [r.user_id, r]));
    const setMap = new Map(settings.map((r: any) => [r.user_id, r]));

    // Guruhga berilgan (draft bo'lmagan) topshiriqlar soni — "3/6 topshirdi" uchun
    const assignmentTotalRows = await this.ds.query(
      `SELECT count(*) AS total FROM assignments WHERE group_id = $1 AND status <> 'draft'`,
      [groupId],
    );
    const assignmentTotal = num(assignmentTotalRows[0]?.total);

    const students = users.map((u: any) => {
      const p: any = progMap.get(u.id) ?? {};
      const a: any = attMap.get(u.id) ?? {};
      const s: any = subMap.get(u.id) ?? {};
      const d: any = dailyMap.get(u.id) ?? {};
      const set: any = setMap.get(u.id) ?? {};

      const lastActivityAt: Date | null =
        p.last_progress_at
          ? new Date(p.last_progress_at)
          : u.lastActivityDate
          ? new Date(u.lastActivityDate)
          : d.last_day
          ? new Date(d.last_day)
          : null;

      const daysSince = lastActivityAt
        ? Math.floor((Date.now() - lastActivityAt.getTime()) / 86400000)
        : null;

      const attendanceRate = pct(num(a.attended), num(a.total));

      // Holat: faollik + davomat birgalikda
      let status: 'good' | 'watch' | 'risk';
      if (daysSince === null || daysSince > 7 || (num(a.total) >= 4 && attendanceRate < 50)) status = 'risk';
      else if (daysSince > 3 || (num(a.total) >= 4 && attendanceRate < 75)) status = 'watch';
      else status = 'good';

      return {
        id: u.id,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        username: u.username,
        avatarUrl: u.avatarUrl,
        phone: u.phone,
        isActive: u.isActive !== false,
        cefrLevel: u.cefrLevel ?? null,

        completedLessons: num(p.completed),
        inProgressLessons: num(p.in_progress),
        avgScore: num(p.avg_score),
        totalMinutes: Math.round(num(p.time_spent) / 60),

        attendanceRate,
        attendedSessions: num(a.attended),
        totalSessions: num(a.total),
        lateCount: num(a.late),
        absentCount: num(a.absent),
        excusedCount: num(a.excused),

        assignmentsTotal: assignmentTotal,
        assignmentsSubmitted: num(s.submitted),
        assignmentsGraded: num(s.graded),
        assignmentsLate: num(s.late),
        assignmentAvgScore: num(s.avg_score),

        xpTotal: num(u.xpTotal),
        level: num(u.level) || 1,
        league: u.league ?? 'bronze',
        streakCurrent: num(u.streakCurrent),
        xpWeekly: num(u.xpWeekly),
        rankWeekly: u.rankWeekly ?? null,

        avgDailyMinutes: num(d.avg_min),
        activeDays: num(d.active_days),

        isFree: set.isFree ?? false,
        manualUnlockCeiling: set.manualUnlockCeiling ?? null,

        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        daysSinceActive: daysSince,
        status,
      };
    });

    students.sort((a: any, b: any) => a.firstName.localeCompare(b.firstName));
    return { total: students.length, students };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  GET /groups/:id/attendance — sessiya × o'quvchi matritsasi
  // ──────────────────────────────────────────────────────────────────────────
  async getAttendance(groupId: string, userId: string, role: string, limit = 10) {
    await this.loadGroup(groupId, userId, role);
    const take = Math.min(30, Math.max(1, Number(limit) || 10));

    // Oxirgi N o'tgan sessiya (eng yangisidan boshlab olib, keyin sanaga qarab tartiblanadi)
    const sessions = await this.ds.query(
      `SELECT id, session_date AS "date", start_time AS "startTime", topic, status
         FROM schedule_sessions
        WHERE group_id = $1 AND session_date <= CURRENT_DATE AND status <> 'cancelled'
     ORDER BY session_date DESC, start_time DESC
        LIMIT $2`,
      [groupId, take],
    );
    sessions.reverse();

    const members = await this.ds.query(
      `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName",
              u.avatar_url AS "avatarUrl"
         FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
     ORDER BY u.first_name ASC`,
      [groupId],
    );

    if (!sessions.length || !members.length) {
      return {
        sessions: [],
        students: members.map((m: any) => ({
          id: m.id,
          firstName: m.firstName ?? '',
          lastName: m.lastName ?? '',
          avatarUrl: m.avatarUrl,
          cells: {},
          attendedCount: 0,
          totalCount: 0,
          rate: 0,
        })),
        totals: { present: 0, late: 0, absent: 0, excused: 0, total: 0, rate: 0 },
      };
    }

    const sessionIds = sessions.map((s: any) => s.id);
    const rows = await this.ds.query(
      `SELECT session_id, user_id, status, joined_at AS "joinedAt"
         FROM attendance WHERE session_id = ANY($1)`,
      [sessionIds],
    );

    const byUser = new Map<string, Record<string, string>>();
    const perSession = new Map<string, { present: number; late: number; absent: number; excused: number }>();
    const totals = { present: 0, late: 0, absent: 0, excused: 0 };

    for (const r of rows as any[]) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, {});
      byUser.get(r.user_id)![r.session_id] = r.status;

      if (!perSession.has(r.session_id)) {
        perSession.set(r.session_id, { present: 0, late: 0, absent: 0, excused: 0 });
      }
      const bucket = perSession.get(r.session_id)! as any;
      if (bucket[r.status] !== undefined) bucket[r.status] += 1;
      if ((totals as any)[r.status] !== undefined) (totals as any)[r.status] += 1;
    }

    const sessionOut = sessions.map((s: any) => {
      const b = perSession.get(s.id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
      const total = b.present + b.late + b.absent + b.excused;
      const d = new Date(s.date);
      return {
        id: s.id,
        date: s.date,
        dateLabel: dateLabel(s.date),
        shortLabel: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        dayLabel: DAY_SHORT[projDay(d)] ?? '',
        startTime: hhmm(s.startTime),
        topic: s.topic ?? null,
        status: s.status,
        present: b.present,
        late: b.late,
        absent: b.absent,
        excused: b.excused,
        total,
        rate: pct(b.present + b.late, total),
      };
    });

    const students = members.map((m: any) => {
      const cells = byUser.get(m.id) ?? {};
      const values = Object.values(cells);
      const attended = values.filter((v) => v === 'present' || v === 'late').length;
      return {
        id: m.id,
        firstName: m.firstName ?? '',
        lastName: m.lastName ?? '',
        avatarUrl: m.avatarUrl,
        cells,
        attendedCount: attended,
        totalCount: values.length,
        rate: pct(attended, values.length),
      };
    });

    const grandTotal = totals.present + totals.late + totals.absent + totals.excused;

    return {
      sessions: sessionOut,
      students,
      totals: {
        ...totals,
        total: grandTotal,
        rate: pct(totals.present + totals.late, grandTotal),
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  GET /groups/:id/sessions — o'tgan va kelgusi darslar
  // ──────────────────────────────────────────────────────────────────────────
  async getSessions(groupId: string, userId: string, role: string, past = 10, future = 6) {
    await this.loadGroup(groupId, userId, role);
    const pastTake = Math.min(50, Math.max(0, Number(past) || 0));
    const futureTake = Math.min(50, Math.max(0, Number(future) || 0));

    const [pastRows, futureRows] = await Promise.all([
      pastTake
        ? this.ds.query(
            `SELECT id, session_date AS "date", start_time AS "startTime",
                    duration_minutes AS "durationMinutes", topic, status, notes
               FROM schedule_sessions
              WHERE group_id = $1 AND session_date < CURRENT_DATE
           ORDER BY session_date DESC LIMIT $2`,
            [groupId, pastTake],
          )
        : Promise.resolve([]),
      futureTake
        ? this.ds.query(
            `SELECT id, session_date AS "date", start_time AS "startTime",
                    duration_minutes AS "durationMinutes", topic, status, notes
               FROM schedule_sessions
              WHERE group_id = $1 AND session_date >= CURRENT_DATE
           ORDER BY session_date ASC LIMIT $2`,
            [groupId, futureTake],
          )
        : Promise.resolve([]),
    ]);

    const allIds = [...pastRows, ...futureRows].map((s: any) => s.id);
    const attRows = allIds.length
      ? await this.ds.query(
          `SELECT session_id,
                  count(*) FILTER (WHERE status = 'present') AS present,
                  count(*) FILTER (WHERE status = 'late') AS late,
                  count(*) FILTER (WHERE status = 'absent') AS absent,
                  count(*) FILTER (WHERE status = 'excused') AS excused,
                  count(*) AS total
             FROM attendance WHERE session_id = ANY($1) GROUP BY session_id`,
          [allIds],
        )
      : [];
    const attMap = new Map(attRows.map((r: any) => [r.session_id, r]));

    const shape = (s: any) => {
      const a: any = attMap.get(s.id) ?? {};
      const duration = num(s.durationMinutes) || 90;
      const start = hhmm(s.startTime);
      const d = new Date(s.date);
      const total = num(a.total);
      return {
        id: s.id,
        date: s.date,
        dateLabel: dateLabel(s.date),
        dayLabel: DAY_SHORT[projDay(d)] ?? '',
        startTime: start,
        endTime: addMinutes(start, duration),
        durationMinutes: duration,
        topic: s.topic ?? null,
        status: s.status,
        notes: s.notes ?? null,
        attendance: total
          ? {
              present: num(a.present),
              late: num(a.late),
              absent: num(a.absent),
              excused: num(a.excused),
              total,
              rate: pct(num(a.present) + num(a.late), total),
            }
          : null,
      };
    };

    return {
      past: pastRows.map(shape),
      upcoming: futureRows.map(shape),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  GET /groups/:id/assignments — guruh topshiriqlari holati
  // ──────────────────────────────────────────────────────────────────────────
  async getAssignments(groupId: string, userId: string, role: string) {
    await this.loadGroup(groupId, userId, role);
    const memberCountRows = await this.ds.query(
      `SELECT count(*) AS total FROM group_members WHERE group_id = $1`,
      [groupId],
    );
    const memberCount = num(memberCountRows[0]?.total);

    const rows = await this.ds.query(
      `SELECT a.id, a.title, a.type, a.status, a.due_date AS "dueDate",
              a.max_score AS "maxScore", a.created_at AS "createdAt",
              l.lesson_name AS "lessonName",
              count(sub.id) AS sub_total,
              count(sub.id) FILTER (WHERE sub.status IN ('submitted','graded','late')) AS submitted,
              count(sub.id) FILTER (WHERE sub.status = 'graded') AS graded,
              count(sub.id) FILTER (WHERE sub.status = 'submitted' AND sub.graded_at IS NULL) AS pending,
              count(sub.id) FILTER (WHERE sub.status = 'late') AS late,
              count(sub.id) FILTER (WHERE sub.status = 'revision_needed') AS revision,
              round(avg(sub.score) FILTER (WHERE sub.score IS NOT NULL)) AS avg_score
         FROM assignments a
    LEFT JOIN lessons l ON l.id = a.lesson_id
    LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
        WHERE a.group_id = $1
     GROUP BY a.id, l.lesson_name
     ORDER BY a.created_at DESC`,
      [groupId],
    );

    const items = rows.map((r: any) => {
      const due = r.dueDate ? new Date(r.dueDate) : null;
      return {
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        lessonName: r.lessonName ?? null,
        dueDate: due ? due.toISOString() : null,
        dueLabel: dateLabel(due),
        isOverdue: !!due && due.getTime() < Date.now() && r.status === 'active',
        maxScore: num(r.maxScore),
        memberCount,
        submitted: num(r.submitted),
        graded: num(r.graded),
        pending: num(r.pending),
        late: num(r.late),
        revision: num(r.revision),
        notSubmitted: Math.max(0, memberCount - num(r.submitted)),
        submitRate: pct(num(r.submitted), memberCount),
        avgScore: num(r.avg_score),
      };
    });

    return {
      total: items.length,
      pendingReviews: items.reduce((s: number, i: any) => s + i.pending, 0),
      items,
    };
  }
}

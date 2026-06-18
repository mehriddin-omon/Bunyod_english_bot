import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Assignment, AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { UserGamification, UserSkill } from 'src/common/core/entitys/gamification.entity';
import { ActivityLog } from 'src/common/core/entitys/daily-tracking.entity';
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
  ) {}

  async getGroupMonitoring(groupId: string, period: string = 'month'): Promise<any> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const students = await Promise.all(
      group.members.map(async (member) => {
        const userId = member.id;
        const gamification = await this.gamificationRepo.findOne({ where: { userId } });
        const completedLessons = await this.progressRepo.count({
          where: { userId, status: LessonProgressStatus.completed },
        });

        const submissions = await this.submissionRepo.find({ where: { studentId: userId } });
        const totalAssignments = await this.assignmentRepo.count({ where: { groupId } });
        const completedAssignments = submissions.filter(
          (s) => s.status === SubmissionStatus.graded || s.status === SubmissionStatus.submitted,
        ).length;

        const assignmentCompletion = totalAssignments
          ? Math.round((completedAssignments / totalAssignments) * 100)
          : 0;

        const lastActivity = gamification?.lastActivityDate ? new Date(gamification.lastActivityDate) : null;
        const daysSinceActive = lastActivity
          ? Math.floor((Date.now() - lastActivity.getTime()) / 86400000)
          : 999;

        const status =
          daysSinceActive > 7 || assignmentCompletion < 50
            ? 'risk'
            : daysSinceActive > 3 || assignmentCompletion < 70
            ? 'watch'
            : 'good';

        return {
          id: userId,
          first_name: member.firstName ?? '',
          last_name: member.lastName ?? '',
          attendance: Math.min(100, completedLessons * 5),
          assignment_completion: assignmentCompletion,
          last_active_at: gamification?.lastActivityDate ?? null,
          status,
        };
      }),
    );

    const avg_attendance = students.length
      ? Math.round(students.reduce((s, st) => s + st.attendance, 0) / students.length)
      : 0;
    const avg_assignment_completion = students.length
      ? Math.round(students.reduce((s, st) => s + st.assignment_completion, 0) / students.length)
      : 0;
    const at_risk_count = students.filter((s) => s.status === 'risk').length;

    return {
      period,
      kpi: {
        avg_attendance,
        avg_assignment_completion,
        avg_score: 84,
        at_risk_count,
      },
      weekly_activity: [],
      students,
    };
  }

  async getStudentMonitoring(studentId: string): Promise<any> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException("O'quvchi topilmadi");

    const gamification = await this.gamificationRepo.findOne({ where: { userId: studentId } });
    const skills = await this.skillRepo.find({ where: { userId: studentId } });

    const completedLessons = await this.progressRepo.find({
      where: { userId: studentId, status: LessonProgressStatus.completed },
      relations: ['lesson'],
    });

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

    return {
      student: {
        id: student.id,
        first_name: student.firstName ?? '',
        last_name: student.lastName ?? '',
        group: null,
        joined_at: student.createdAt,
        status: 'good',
      },
      summary: {
        streak: gamification?.streakCurrent ?? 0,
        total_time: `${Math.round(completedLessons.reduce((s, p) => s + p.timeSpentSec, 0) / 60)}m`,
        rank_in_group: gamification?.rankWeekly ?? null,
      },
      kpi: {
        avg_score: completedLessons.length
          ? Math.round(completedLessons.reduce((s, p) => s + (p.score ?? 0), 0) / completedLessons.length)
          : 0,
        attendance: Math.min(100, completedLessons.length * 5),
        completed_assignments: allSubmissions.filter((s) => s.status !== SubmissionStatus.pending).length,
        total_assignments: allSubmissions.length,
        late_assignments: allSubmissions.filter((s) => s.status === SubmissionStatus.late).length,
        weekly_active_time: `${Math.round((gamification?.xpWeekly ?? 0) / 10)}m`,
      },
      skills: skillsMap,
      vocabulary: { total: 0, retention: 0, weekly_gain: 0 },
      activity_heatmap: heatmap,
      weekly_minutes: [],
      topic_stats: completedLessons.map((p) => ({
        lesson_code: p.lesson?.orderIndex,
        title: p.lesson?.lessonName,
        score: p.score ? `${p.score}%` : '—',
        time_spent: `${Math.round(p.timeSpentSec / 60)}m`,
        attempts: p.attempts,
      })),
      recent_assignments: allSubmissions.slice(0, 5).map((s) => ({
        status: s.status,
        score: s.score,
        submitted_at: s.submittedAt,
      })),
    };
  }
}

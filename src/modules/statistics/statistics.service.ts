import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { LessonProgressStatus } from 'src/common/utils/enum';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
  ) {}

  async getStudentStatistics(userId: string, lessonId: string) {
    const progress = await this.progressRepo.findOne({ where: { userId, lessonId } });

    return {
      lesson_id: lessonId,
      user_id: userId,
      status: progress?.status ?? LessonProgressStatus.not_started,
      score: progress?.score ?? 0,
      completed_at: progress?.completedAt ?? null,
    };
  }

  async getGroupStatistics(groupId: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) return null;

    const memberIds = group.members.map((m) => m.id);
    const progressData = memberIds.length
      ? await this.progressRepo
          .createQueryBuilder('p')
          .where('p.userId IN (:...memberIds)', { memberIds })
          .getMany()
      : [];

    const statisticsByStudent: Record<string, any> = {};
    group.members.forEach((member) => {
      const memberProgress = progressData.filter((p) => p.userId === member.id);
      const completedCount = memberProgress.filter((p) => p.status === LessonProgressStatus.completed).length;
      const avgScore =
        completedCount > 0
          ? (memberProgress.filter((p) => p.score != null).reduce((acc, p) => acc + (p.score ?? 0), 0) / completedCount).toFixed(1)
          : 0;

      statisticsByStudent[member.id] = {
        username: member.username ?? member.id,
        lessons_completed: completedCount,
        average_score: avgScore,
      };
    });

    const totalCompleted = progressData.filter((p) => p.status === LessonProgressStatus.completed).length;
    const classAverageScore =
      totalCompleted > 0
        ? (progressData.filter((p) => p.score != null).reduce((acc, p) => acc + (p.score ?? 0), 0) / totalCompleted).toFixed(1)
        : 0;

    return {
      group_id: groupId,
      group_name: group.name,
      member_count: group.members.length,
      completed_count: totalCompleted,
      class_average_score: classAverageScore,
      statistics_by_student: statisticsByStudent,
    };
  }

  async getLessonStatistics(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) return null;

    const progressData = await this.progressRepo.find({ where: { lessonId } });
    const completedCount = progressData.filter((p) => p.status === LessonProgressStatus.completed).length;
    const averageScore =
      completedCount > 0
        ? (progressData.filter((p) => p.score != null).reduce((acc, p) => acc + (p.score ?? 0), 0) / completedCount).toFixed(1)
        : 0;

    return {
      lesson_id: lessonId,
      lessonName: lesson.lessonName,
      total_students: progressData.length,
      completed_students: completedCount,
      average_score: averageScore,
    };
  }

  async getUserOverallStatistics(userId: string) {
    const allProgress = await this.progressRepo.find({ where: { userId } });
    if (allProgress.length === 0) {
      return {
        user_id: userId,
        total_lessons: 0,
        completed_lessons: 0,
        average_score: 0,
      };
    }

    const completedCount = allProgress.filter((p) => p.status === LessonProgressStatus.completed).length;
    const scored = allProgress.filter((p) => p.score != null);
    const averageScore = scored.length
      ? (scored.reduce((acc, p) => acc + (p.score ?? 0), 0) / scored.length).toFixed(1)
      : 0;

    return {
      user_id: userId,
      total_lessons: allProgress.length,
      completed_lessons: completedCount,
      average_score: averageScore,
    };
  }

  async getMyStats(userId: string) {
    const allProgress = await this.progressRepo.find({ where: { userId } });
    const completedCount = allProgress.filter((p) => p.status === LessonProgressStatus.completed).length;
    const avgScore = allProgress.length
      ? Math.round(allProgress.reduce((s, p) => s + (p.score ?? 0), 0) / allProgress.length)
      : 0;

    return {
      cefr_level: 'B1',
      cefr_progress: 32,
      skills: {
        reading: { level: 'B1', pct: 88 },
        grammar: { level: 'B1', pct: 84 },
        writing: { level: 'B1', pct: 79 },
        vocabulary: { level: 'B1', pct: 76, word_count: 1240 },
        listening: { level: 'A2', pct: 68 },
        speaking: { level: 'A2', pct: 62 },
      },
      vocabulary: {
        total: 1240,
        retention: 91,
        by_level: [
          { level: 'A1', count: 320 },
          { level: 'A2', count: 410 },
          { level: 'B1', count: 380 },
          { level: 'B2', count: 130 },
        ],
      },
      activity_heatmap: [],
      weekly_minutes: [],
      gamification: null,
      completed_lessons: completedCount,
      avg_score: avgScore,
    };
  }

  async updateProgress(userId: string, lessonId: string, data: Partial<LessonProgress>) {
    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });

    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId, ...data });
    } else {
      Object.assign(progress, data);
    }

    return this.progressRepo.save(progress);
  }
}

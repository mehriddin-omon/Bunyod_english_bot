import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { CurriculumLesson } from 'src/common/core/entitys/lesson.entity';
import { Group } from 'src/common/core/entitys/group.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(CurriculumLesson)
    private readonly lessonRepo: Repository<CurriculumLesson>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
  ) {}

  /**
   * O'quvchi uchun shaxsiy statistika
   */
  async getStudentStatistics(userId: string, lessonId: string) {
    const progress = await this.progressRepo.findOne({
      where: { userId, lessonId },
    });

    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
    });

    return {
      lesson_id: lessonId,
      user_id: userId,
      progress: progress?.progress || 0,
      score: progress?.score || 0,
      total_questions: progress?.totalQuestions || 0,
      correct_answers: progress?.correctAnswers || 0,
      vocabulary_count: 0,
      completed_at: progress?.completedAt || null,
    };
  }

  /**
   * O'qituvchi uchun sinf statistikasi
   */
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

    const statisticsByStudent = {};
    group.members.forEach((member) => {
      const memberProgress = progressData.filter((p) => p.userId === member.id);
      const avgProgress = memberProgress.length > 0 ? memberProgress.reduce((acc, p) => acc + p.progress, 0) / memberProgress.length : 0;
      statisticsByStudent[member.id] = {
        username: member.username ?? member.id,
        average_progress: Math.round(avgProgress),
        lessons_completed: memberProgress.filter((p) => p.progress === 100).length,
        average_score: memberProgress.length > 0 ? (memberProgress.reduce((acc, p) => acc + (p.score || 0), 0) / memberProgress.length).toFixed(1) : 0,
      };
    });

    const allProgress = progressData.map((p) => p.progress);
    const classAverageProgress = allProgress.length > 0 ? Math.round(allProgress.reduce((a, b) => a + b) / allProgress.length) : 0;
    const classAverageScore =
      progressData.length > 0
        ? (progressData.reduce((acc, p) => acc + (p.score || 0), 0) / progressData.length).toFixed(1)
        : 0;

    return {
      group_id: groupId,
      group_name: group.name,
      member_count: group.members.length,
      class_average_progress: classAverageProgress,
      class_average_score: classAverageScore,
      completed_count: progressData.filter((p) => p.progress === 100).length,
      statistics_by_student: statisticsByStudent,
    };
  }

  /**
   * Darsi uchun umum statistika
   */
  async getLessonStatistics(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
    });

    if (!lesson) return null;

    const progressData = await this.progressRepo.find({
      where: { lessonId },
    });

    const allProgress = progressData.map((p) => p.progress);
    const averageProgress = allProgress.length > 0 ? Math.round(allProgress.reduce((a, b) => a + b) / allProgress.length) : 0;
    const averageScore =
      progressData.length > 0 ? (progressData.reduce((acc, p) => acc + (p.score || 0), 0) / progressData.length).toFixed(1) : 0;
    const completedCount = progressData.filter((p) => p.progress === 100).length;

    return {
      lesson_id: lessonId,
      lessonName: lesson.lessonName,
      total_vocabulary: 0,
      total_students: progressData.length,
      completed_students: completedCount,
      average_progress: averageProgress,
      average_score: averageScore,
    };
  }

  /**
   * Foydalanuvchining umumiy statistikasi
   */
  async getUserOverallStatistics(userId: string) {
    const allProgress = await this.progressRepo.find({
      where: { userId },
      relations: ['lesson'],
    });

    if (allProgress.length === 0) {
      return {
        user_id: userId,
        total_lessons: 0,
        completed_lessons: 0,
        average_progress: 0,
        average_score: 0,
        total_vocabulary_learned: 0,
      };
    }

    const totalProgress = allProgress.map((p) => p.progress);
    const averageProgress = Math.round(totalProgress.reduce((a, b) => a + b) / totalProgress.length);
    const averageScore = (allProgress.reduce((acc, p) => acc + (p.score || 0), 0) / allProgress.length).toFixed(1);
    const completedCount = allProgress.filter((p) => p.progress === 100).length;

    return {
      user_id: userId,
      total_lessons: allProgress.length,
      completed_lessons: completedCount,
      average_progress: averageProgress,
      average_score: averageScore,
      total_vocabulary_learned: allProgress.reduce((acc, p) => acc + (p.correctAnswers || 0), 0),
    };
  }

  /**
   * Student o'z statistikasi (GET /stats/my)
   */
  async getMyStats(userId: string) {
    const allProgress = await this.progressRepo.find({
      where: { userId },
      relations: ['lesson'],
    });
    const completedCount = allProgress.filter((p) => p.progress === 100).length;
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

  /**
   * Darsi uchun progress yangilash
   */
  async updateProgress(userId: string, lessonId: string, data: Partial<LessonProgress>) {
    let progress = await this.progressRepo.findOne({
      where: { userId, lessonId },
    });

    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        lessonId,
        ...data,
      });
    } else {
      Object.assign(progress, data);
    }

    return this.progressRepo.save(progress);
  }
}

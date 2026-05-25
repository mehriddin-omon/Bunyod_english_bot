import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Group } from 'src/common/core/entitys/group.entity';

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

  /**
   * O'quvchi uchun shaxsiy statistika
   */
  async getStudentStatistics(userId: string, lessonId: string) {
    const progress = await this.progressRepo.findOne({
      where: { userId, lessonId },
    });

    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['vocabulary'],
    });

    return {
      lessonId,
      userId,
      progress: progress?.progress || 0,
      score: progress?.score || 0,
      totalQuestions: progress?.totalQuestions || 0,
      correctAnswers: progress?.correctAnswers || 0,
      vocabularyCount: lesson?.vocabulary?.length || 0,
      completedAt: progress?.completedAt || null,
    };
  }

  /**
   * O'qituvchi uchun sinf statistikasi
   */
  async getGroupStatistics(groupId: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members', 'lessons'],
    });

    if (!group) return null;

    const progressData = await this.progressRepo
      .createQueryBuilder('p')
      .where('p.userId IN (:...memberIds)', { memberIds: group.members.map((m) => m.id) })
      .andWhere('p.lessonId IN (:...lessonIds)', { lessonIds: group.lessons.map((l) => l.id) })
      .getMany();

    const statisticsByStudent = {};
    group.members.forEach((member) => {
      const memberProgress = progressData.filter((p) => p.userId === member.id);
      const avgProgress = memberProgress.length > 0 ? memberProgress.reduce((acc, p) => acc + p.progress, 0) / memberProgress.length : 0;
      statisticsByStudent[member.id] = {
        username: member.username,
        averageProgress: Math.round(avgProgress),
        lessonsCompleted: memberProgress.filter((p) => p.progress === 100).length,
        averageScore: memberProgress.length > 0 ? (memberProgress.reduce((acc, p) => acc + (p.score || 0), 0) / memberProgress.length).toFixed(1) : 0,
      };
    });

    const allProgress = progressData.map((p) => p.progress);
    const classAverageProgress = allProgress.length > 0 ? Math.round(allProgress.reduce((a, b) => a + b) / allProgress.length) : 0;
    const classAverageScore =
      progressData.length > 0
        ? (progressData.reduce((acc, p) => acc + (p.score || 0), 0) / progressData.length).toFixed(1)
        : 0;

    return {
      groupId,
      groupName: group.name,
      memberCount: group.members.length,
      classAverageProgress,
      classAverageScore,
      completedCount: progressData.filter((p) => p.progress === 100).length,
      statisticsByStudent,
    };
  }

  /**
   * Darsi uchun umum statistika
   */
  async getLessonStatistics(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['vocabulary'],
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
      lessonId,
      lessonName: lesson.lesson_name,
      totalVocabulary: lesson.vocabulary?.length || 0,
      totalStudents: progressData.length,
      completedStudents: completedCount,
      averageProgress,
      averageScore,
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
        userId,
        totalLessons: 0,
        completedLessons: 0,
        averageProgress: 0,
        averageScore: 0,
        totalVocabularyLearned: 0,
      };
    }

    const totalProgress = allProgress.map((p) => p.progress);
    const averageProgress = Math.round(totalProgress.reduce((a, b) => a + b) / totalProgress.length);
    const averageScore = (allProgress.reduce((acc, p) => acc + (p.score || 0), 0) / allProgress.length).toFixed(1);
    const completedCount = allProgress.filter((p) => p.progress === 100).length;

    return {
      userId,
      totalLessons: allProgress.length,
      completedLessons: completedCount,
      averageProgress,
      averageScore,
      totalVocabularyLearned: allProgress.reduce((acc, p) => acc + (p.correctAnswers || 0), 0),
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

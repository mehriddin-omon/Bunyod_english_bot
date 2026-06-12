import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { LessonProgressStatus, LessonStatus } from 'src/common/utils/enum';

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,

    @InjectRepository(DailyTracking)
    private readonly dailyRepo: Repository<DailyTracking>,

    @InjectRepository(Vocabulary)
    private readonly vocabRepo: Repository<Vocabulary>,
  ) {}

  async getStats(userId: string) {
    const [totalLessons, completedRecords, gamification] = await Promise.all([
      this.lessonRepo.count({ where: { status: LessonStatus.published } }),
      this.progressRepo.find({ where: { userId, status: LessonProgressStatus.completed } }),
      this.gamificationRepo.findOne({ where: { userId } }),
    ]);

    const completedCount = completedRecords.length;
    const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const avgScore = completedCount
      ? Math.round(completedRecords.reduce((s, p) => s + (p.score ?? 0), 0) / completedCount)
      : 0;

    const today = new Date().toISOString().split('T')[0];
    const daily = await this.dailyRepo.findOne({ where: { userId, date: today } });

    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const weeklyCompleted = completedRecords.filter(
      (p) => p.completedAt && p.completedAt.toISOString().split('T')[0] >= oneWeekAgo,
    ).length;

    const totalWords = await this.vocabRepo.count();
    const prevAvgScore = Math.max(0, avgScore - (gamification?.xpWeekly ? 3 : 0));

    return {
      lessons: {
        completed: completedCount,
        total: totalLessons,
        percentage,
      },
      words: {
        total: totalWords,
        weeklyNew: weeklyCompleted * 2,
      },
      averageScore: {
        score: avgScore,
        change: avgScore - prevAvgScore,
      },
      dailyGoal: {
        targetMinutes: daily?.goalMinutes ?? 20,
        completedMinutes: daily?.minutesSpent ?? 0,
      },
    };
  }

  async getStreak(userId: string) {
    const gamification = await this.gamificationRepo.findOne({ where: { userId } });

    return {
      currentStreak: gamification?.streakCurrent ?? 0,
      longestStreak: gamification?.streakMax ?? 0,
      lastActivity: gamification?.lastActivityDate
        ? new Date(gamification.lastActivityDate).toISOString()
        : null,
    };
  }

  async getCurrentLesson(userId: string) {
    const units = await this.unitRepo.find({
      where: { status: LessonStatus.published as any },
      order: { number: 'ASC' },
    });

    const allLessons = await this.lessonRepo.find({
      where: { status: LessonStatus.published },
      order: { unitId: 'ASC', orderIndex: 'ASC' },
    });

    const completedSet = new Set<string>();
    const records = await this.progressRepo.find({ where: { userId, status: LessonProgressStatus.completed } });
    records.forEach((p) => completedSet.add(p.lessonId));

    const totalLessons = allLessons.length;
    const completedCount = completedSet.size;
    const totalSections = units.length;
    const completedSections = units.filter((u) => {
      const unitLessons = allLessons.filter((l) => l.unitId === u.id);
      return unitLessons.length > 0 && unitLessons.every((l) => completedSet.has(l.id));
    }).length;

    const nextLesson = allLessons.find((l) => !completedSet.has(l.id));
    if (!nextLesson) return null;

    const unit = units.find((u) => u.id === nextLesson.unitId);
    const progress = completedCount > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    return {
      lessonId: nextLesson.id,
      title: nextLesson.lessonName,
      sectionNumber: unit?.number ?? null,
      totalSections,
      completedSections,
      progress,
    };
  }

  async getDailyGoals(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const daily = await this.dailyRepo.findOne({ where: { userId, date: today } });

    const vocabReviewed = daily?.vocabularyReviewed ?? 0;
    const listeningDone = daily?.listeningDone ?? false;

    const completedRecords = await this.progressRepo.find({
      where: { userId, status: LessonProgressStatus.completed },
    });

    const todayCompleted = completedRecords.some((p) => {
      if (!p.completedAt) return false;
      return new Date(p.completedAt).toISOString().split('T')[0] === today;
    });

    return [
      {
        id: 'lesson',
        label: 'Dars tugatish',
        completed: todayCompleted,
      },
      {
        id: 'vocab',
        label: "10 ta yangi so'z",
        completed: vocabReviewed >= 10,
      },
      {
        id: 'listening',
        label: 'Listening mashqi',
        completed: listeningDone,
      },
    ];
  }
}

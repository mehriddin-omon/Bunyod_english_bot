import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { CurriculumLesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { LessonProgressStatus } from 'src/common/utils/enum';
import { CompleteLessonDto } from './dto/progress.dto';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(CurriculumLesson)
    private readonly lessonRepo: Repository<CurriculumLesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,

    @InjectRepository(DailyTracking)
    private readonly dailyRepo: Repository<DailyTracking>,
  ) {}

  async startLesson(userId: string, lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        lessonId,
        status: LessonProgressStatus.in_progress,
        attempts: 1,
        timeSpentSec: 0,
      });
    } else {
      progress.status = LessonProgressStatus.in_progress;
      progress.attempts += 1;
    }
    await this.progressRepo.save(progress);

    return { progress_id: progress.id, started_at: new Date() };
  }

  async completeLesson(userId: string, lessonId: string, dto: CompleteLessonDto) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['unit'],
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId, attempts: 1 });
    }

    progress.status = LessonProgressStatus.completed;
    progress.score = dto.score;
    progress.timeSpentSec = (progress.timeSpentSec ?? 0) + dto.timeSpent;
    progress.completedAt = new Date();
    await this.progressRepo.save(progress);

    // XP hisoblash
    const xpEarned = Math.round(10 + (dto.score / 100) * 40);

    // Gamification yangilash
    await this.updateGamification(userId, xpEarned, dto.timeSpent);

    // Keyingi darsni topish
    const nextLesson = await this.lessonRepo.findOne({
      where: { unitId: lesson.unitId, orderIndex: lesson.orderIndex + 1 },
    });

    // Streak yangilash
    const gamification = await this.gamificationRepo.findOne({ where: { userId } });

    return {
      progress: {
        status: progress.status,
        score: progress.score,
        time_spent: progress.timeSpentSec,
        completed_at: progress.completedAt,
      },
      xp_earned: xpEarned,
      next_lesson: nextLesson
        ? { id: nextLesson.id, lesson_code: nextLesson.lessonNumber, title: nextLesson.lessonName }
        : null,
      streak_updated: true,
      new_streak: gamification?.streakCurrent ?? 1,
    };
  }

  async getOverview(userId: string) {
    const allProgress = await this.progressRepo.find({ where: { userId }, relations: ['lesson'] });
    const completed = allProgress.filter((p) => p.status === LessonProgressStatus.completed);

    const gamification = await this.gamificationRepo.findOne({ where: { userId } });

    // Joriy dars
    const inProgress = allProgress.find((p) => p.status === LessonProgressStatus.in_progress);

    // Bugungi takrloash
    const today = new Date().toISOString().split('T')[0];
    const daily = await this.dailyRepo.findOne({ where: { userId, date: today } });

    const totalLessons = await this.lessonRepo.count();
    const avgScore = completed.length
      ? Math.round(completed.reduce((s, p) => s + (p.score ?? 0), 0) / completed.length)
      : 0;

    return {
      streak: gamification?.streakCurrent ?? 0,
      total_lessons: totalLessons,
      completed_lessons: completed.length,
      completed_percent: totalLessons ? Math.round((completed.length / totalLessons) * 100) : 0,
      learned_words: gamification?.xpTotal ?? 0,
      avg_score: avgScore,
      today_goal: {
        target_minutes: daily?.goalMinutes ?? 30,
        spent_minutes: daily?.minutesSpent ?? 0,
        percent: daily ? Math.round((daily.minutesSpent / daily.goalMinutes) * 100) : 0,
        tasks: [
          { label: '1 ta dars yakunlash', done: (daily?.lessonsCompleted ?? 0) >= 1 },
          { label: '15 ta so\'z takrorlash', done: (daily?.vocabularyReviewed ?? 0) >= 15 },
          { label: '1 ta listening', done: daily?.listeningDone ?? false },
        ],
      },
      current_lesson: inProgress?.lesson
        ? {
            unit_number: null,
            lesson_code: inProgress.lesson.lessonNumber,
            lesson_title: inProgress.lesson.lessonName,
          }
        : null,
    };
  }

  private async updateGamification(userId: string, xpEarned: number, timeSpentSec: number) {
    let gamification = await this.gamificationRepo.findOne({ where: { userId } });
    if (!gamification) {
      gamification = this.gamificationRepo.create({ userId, level: 1, xpTotal: 0, xpWeekly: 0, streakCurrent: 0 });
    }
    gamification.xpTotal += xpEarned;
    gamification.xpWeekly += xpEarned;

    // Level hisoblash (har 100 XP = 1 level)
    gamification.level = Math.floor(gamification.xpTotal / 100) + 1;

    // Streak yangilash
    const today = new Date().toISOString().split('T')[0];
    if (gamification.lastActivityDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (gamification.lastActivityDate === yesterday) {
        gamification.streakCurrent += 1;
      } else {
        gamification.streakCurrent = 1;
      }
      gamification.lastActivityDate = today;
      if (gamification.streakCurrent > gamification.streakMax) {
        gamification.streakMax = gamification.streakCurrent;
      }
    }
    await this.gamificationRepo.save(gamification);

    // Daily tracking
    let daily = await this.dailyRepo.findOne({ where: { userId, date: today } });
    if (!daily) {
      daily = this.dailyRepo.create({ userId, date: today, goalMinutes: 30 });
    }
    daily.minutesSpent += Math.round(timeSpentSec / 60);
    daily.lessonsCompleted += 1;
    await this.dailyRepo.save(daily);
  }
}

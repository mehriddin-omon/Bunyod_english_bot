import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { LessonProgressStatus } from 'src/common/utils/enum';
import { VocabStatus } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { CompleteLessonDto, UpsertProgressDto } from './dto/progress.dto';
import { LessonGatingService } from 'src/common/services/lesson-gating.service';

@Injectable()
export class ProgressService {
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

    @InjectRepository(UserVocabularyProgress)
    private readonly vocabProgressRepo: Repository<UserVocabularyProgress>,

    private readonly lessonGatingService: LessonGatingService,
  ) {}

  /**
   * Talaba shu darsga (ketma-ketlik + guruh chegarasi bo'yicha) kira olishini tekshiradi.
   * Rad etilsa ForbiddenException tashlaydi — dashboard'dagi ko'rsatishdan tashqari,
   * bu haqiqiy server-side to'siq (client so'rovni to'g'ridan-to'g'ri chaqirsa ham).
   */
  private async assertLessonAccessible(userId: string, lessonId: string): Promise<void> {
    const order = await this.lessonGatingService.getPublishedLessonOrder();
    const lessonIndex = order.findIndex((l) => l.id === lessonId);
    if (lessonIndex === -1) return; // nashr etilmagan/topilmagan dars — mavjud NotFoundException logikasi bunga ta'sir qilmaydi

    const completedRecords = await this.progressRepo.find({
      where: { userId, status: LessonProgressStatus.completed },
    });
    const completedSet = new Set(completedRecords.map((p) => p.lessonId));

    const allPriorCompleted = order.slice(0, lessonIndex).every((l) => completedSet.has(l.id));
    if (!allPriorCompleted) {
      throw new ForbiddenException('Oldingi darsni tugatmasdan bu darsga o\'ta olmaysiz');
    }

    const { ceilingIndex } = await this.lessonGatingService.computeEffectiveCeiling(userId);
    if (ceilingIndex !== null && lessonIndex > ceilingIndex) {
      throw new ForbiddenException('Bu dars hali guruhingiz uchun ochilmagan');
    }
  }

  async startLesson(userId: string, lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await this.assertLessonAccessible(userId, lessonId);

    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId, status: LessonProgressStatus.in_progress, attempts: 1, timeSpentSec: 0 });
    } else {
      progress.status = LessonProgressStatus.in_progress;
      progress.attempts += 1;
    }
    await this.progressRepo.save(progress);
    return { progress_id: progress.id, started_at: new Date() };
  }

  async completeLesson(userId: string, lessonId: string, dto: CompleteLessonDto) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await this.assertLessonAccessible(userId, lessonId);

    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId, attempts: 1 });
    }

    progress.status = LessonProgressStatus.completed;
    progress.score = dto.score;
    progress.timeSpentSec = (progress.timeSpentSec ?? 0) + dto.timeSpent;
    progress.completedAt = new Date();
    await this.progressRepo.save(progress);

    const xpEarned = Math.round(10 + (dto.score / 100) * 40);
    await this.updateGamification(userId, xpEarned, dto.timeSpent);

    const nextLesson = lesson.unitId
      ? await this.lessonRepo.findOne({ where: { unitId: lesson.unitId, orderIndex: lesson.orderIndex + 1 } })
      : null;

    const gamification = await this.gamificationRepo.findOne({ where: { userId } });

    return {
      progress: { status: progress.status, score: progress.score, time_spent: progress.timeSpentSec, completed_at: progress.completedAt },
      xp_earned: xpEarned,
      next_lesson: nextLesson
        ? { id: nextLesson.id, lesson_code: nextLesson.orderIndex, title: nextLesson.lessonName }
        : null,
      streak_updated: true,
      new_streak: gamification?.streakCurrent ?? 1,
    };
  }

  /**
   * Talaba darsda o'tkazgan vaqtni (soniya) qo'shadi — dars yakunlanmagan
   * bo'lsa ham. Teacher paneldagi "Davomat" (foydalanish vaqti) shu ma'lumotdan
   * hisoblanadi. lesson_progress.timeSpentSec, daily_tracking.minutesSpent va
   * gamification.lastActivityDate yangilanadi.
   */
  async addTimeSpent(userId: string, lessonId: string, seconds: number) {
    if (!seconds || seconds <= 0) return { added: 0 };
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        lessonId,
        status: LessonProgressStatus.in_progress,
        attempts: 1,
      });
    } else if (progress.status === LessonProgressStatus.not_started) {
      progress.status = LessonProgressStatus.in_progress;
    }
    progress.timeSpentSec = (progress.timeSpentSec ?? 0) + seconds;
    await this.progressRepo.save(progress);

    const today = new Date().toISOString().split('T')[0];
    let daily = await this.dailyRepo.findOne({ where: { userId, date: today } });
    if (!daily) daily = this.dailyRepo.create({ userId, date: today, goalMinutes: 30 });
    daily.minutesSpent += Math.round(seconds / 60);
    await this.dailyRepo.save(daily);

    let gamification = await this.gamificationRepo.findOne({ where: { userId } });
    if (!gamification) {
      gamification = this.gamificationRepo.create({ userId, level: 1, xpTotal: 0, xpWeekly: 0, streakCurrent: 0 });
    }
    gamification.lastActivityDate = today;
    await this.gamificationRepo.save(gamification);

    return { added: seconds, totalSec: progress.timeSpentSec };
  }

  async getOverview(userId: string) {
    const allProgress = await this.progressRepo.find({ where: { userId }, relations: ['lesson'] });
    const completed = allProgress.filter((p) => p.status === LessonProgressStatus.completed);
    const gamification = await this.gamificationRepo.findOne({ where: { userId } });
    const inProgress = allProgress.find((p) => p.status === LessonProgressStatus.in_progress);

    const today = new Date().toISOString().split('T')[0];
    const daily = await this.dailyRepo.findOne({ where: { userId, date: today } });
    const [totalLessons, learnedWords] = await Promise.all([
      this.lessonRepo.count(),
      this.vocabProgressRepo.count({
        where: [
          { userId, status: VocabStatus.learning },
          { userId, status: VocabStatus.mastered },
        ],
      }),
    ]);
    const avgScore = completed.length
      ? Math.round(completed.reduce((s, p) => s + (p.score ?? 0), 0) / completed.length)
      : 0;

    return {
      streak: gamification?.streakCurrent ?? 0,
      total_lessons: totalLessons,
      completed_lessons: completed.length,
      completed_percent: totalLessons ? Math.round((completed.length / totalLessons) * 100) : 0,
      learned_words: learnedWords,
      avg_score: avgScore,
      today_goal: {
        target_minutes: daily?.goalMinutes ?? 30,
        spent_minutes: daily?.minutesSpent ?? 0,
        percent: daily ? Math.round((daily.minutesSpent / daily.goalMinutes) * 100) : 0,
        tasks: [
          { label: '1 ta dars yakunlash', done: (daily?.lessonsCompleted ?? 0) >= 1 },
          { label: "15 ta so'z takrorlash", done: (daily?.vocabularyReviewed ?? 0) >= 15 },
          { label: '1 ta listening', done: daily?.listeningDone ?? false },
        ],
      },
      current_lesson: inProgress?.lesson
        ? { id: inProgress.lesson.id, lesson_code: inProgress.lesson.orderIndex, lesson_title: inProgress.lesson.lessonName }
        : null,
    };
  }

  async getMyProgress(userId: string) {
    const records = await this.progressRepo.find({
      where: { userId, status: LessonProgressStatus.completed },
      order: { completedAt: 'DESC' },
    });
    return records.map((p) => ({ lessonId: p.lessonId, userId: p.userId, score: p.score ?? 0, completedAt: p.completedAt }));
  }

  async upsertProgress(userId: string, dto: UpsertProgressDto) {
    const lesson = await this.lessonRepo.findOne({ where: { id: dto.lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await this.assertLessonAccessible(userId, dto.lessonId);

    let progress = await this.progressRepo.findOne({ where: { userId, lessonId: dto.lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId: dto.lessonId, attempts: 1 });
    } else {
      progress.attempts += 1;
    }

    progress.status = LessonProgressStatus.completed;
    progress.score = dto.score;
    progress.completedAt = new Date();
    await this.progressRepo.save(progress);

    const xpEarned = Math.round(10 + (dto.score / 100) * 40);
    await this.updateGamification(userId, xpEarned, 0);

    return { lessonId: progress.lessonId, userId: progress.userId, score: progress.score, completedAt: progress.completedAt };
  }

  private async updateGamification(userId: string, xpEarned: number, timeSpentSec: number) {
    let gamification = await this.gamificationRepo.findOne({ where: { userId } });
    if (!gamification) {
      gamification = this.gamificationRepo.create({ userId, level: 1, xpTotal: 0, xpWeekly: 0, streakCurrent: 0 });
    }
    gamification.xpTotal += xpEarned;
    gamification.xpWeekly += xpEarned;
    gamification.level = Math.floor(gamification.xpTotal / 100) + 1;

    const today = new Date().toISOString().split('T')[0];
    if (gamification.lastActivityDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      gamification.streakCurrent = gamification.lastActivityDate === yesterday ? gamification.streakCurrent + 1 : 1;
      gamification.lastActivityDate = today;
      if (gamification.streakCurrent > gamification.streakMax) gamification.streakMax = gamification.streakCurrent;
    }
    await this.gamificationRepo.save(gamification);

    let daily = await this.dailyRepo.findOne({ where: { userId, date: today } });
    if (!daily) daily = this.dailyRepo.create({ userId, date: today, goalMinutes: 30 });
    daily.minutesSpent += Math.round(timeSpentSec / 60);
    daily.lessonsCompleted += 1;
    await this.dailyRepo.save(daily);
  }
}

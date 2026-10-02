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
import { XpService } from '../gamification/xp.service';

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

    // Coin/XP faqat shu servis orqali beriladi — daftar bilan yig'ma
    // ko'rsatkichlar hech qachon bir-biridan ajralib qolmaydi
    private readonly xpService: XpService,
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

    const progress = await this.updateProgress(userId, lessonId, (p) => {
      p.status = LessonProgressStatus.in_progress;
      p.attempts += 1;
    });
    return { progress_id: progress.id, started_at: new Date() };
  }

  /**
   * Darsni "tugallangan" deb belgilaydi.
   *
   * IDEMPOTENT: ilova endi darsni AVTOMATIK yakunlaydi (hamma bo'lim 100%
   * bo'lganda), shuning uchun bir dars uchun bu so'rov takror kelishi tabiiy
   * (ikki manba ketma-ket yangilandi, tarmoq qayta urinishi, boshqa qurilma).
   * Allaqachon yakunlangan dars uchun hech narsa o'zgarmaydi — kunlik
   * "yakunlangan darslar" soni va urinishlar qayta oshmaydi, faqat faollik
   * qayd etiladi (streak kuniga bir marta o'sadi, bu o'zi idempotent).
   */
  async completeLesson(userId: string, lessonId: string, dto: CompleteLessonDto) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await this.assertLessonAccessible(userId, lessonId);

    const existing = await this.progressRepo.findOne({ where: { userId, lessonId } });
    const alreadyCompleted = existing?.status === LessonProgressStatus.completed;

    const progress = alreadyCompleted
      ? existing!
      : await this.updateProgress(userId, lessonId, (p) => {
          p.status = LessonProgressStatus.completed;
          p.score = dto.score;
          p.timeSpentSec = (p.timeSpentSec ?? 0) + dto.timeSpent;
          p.completedAt = new Date();
          if (!p.attempts) p.attempts = 1;
        });

    // COIN BERILMAYDI. Foydalanuvchi qarori: coin faqat mashq ishlanganda va
    // so'z yodlanganda beriladi — darsni yakunlashning o'zi mukofot emas.
    // Faollik esa qayd etiladi, streak uzilmasligi kerak.
    await this.xpService.touchActivity(userId);
    if (!alreadyCompleted) await this.bumpDaily(userId, Math.round(dto.timeSpent / 60), 1);

    const nextLesson = lesson.unitId
      ? await this.lessonRepo.findOne({ where: { unitId: lesson.unitId, orderIndex: lesson.orderIndex + 1 } })
      : null;

    const gamification = await this.gamificationRepo.findOne({ where: { userId } });

    return {
      progress: { status: progress.status, score: progress.score, time_spent: progress.timeSpentSec, completed_at: progress.completedAt },
      // Dars yakuni coin bermaydi — maydon eski mijozlar uchun qoldirilgan
      xp_earned: 0,
      next_lesson: nextLesson
        ? { id: nextLesson.id, lesson_code: nextLesson.orderIndex, title: nextLesson.lessonName }
        : null,
      streak_updated: !alreadyCompleted,
      new_streak: gamification?.streakCurrent ?? 1,
      /** dars ilgari ham yakunlangan edi — bu chaqiruv hech narsani o'zgartirmadi */
      already_completed: alreadyCompleted,
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

    const progress = await this.updateProgress(userId, lessonId, (p) => {
      if (p.status === LessonProgressStatus.not_started) {
        p.status = LessonProgressStatus.in_progress;
      }
      if (!p.attempts) p.attempts = 1;
      p.timeSpentSec = (p.timeSpentSec ?? 0) + seconds;
    });

    await this.bumpDaily(userId, Math.round(seconds / 60), 0);
    // Faollik sanasi va streak — YAGONA joyda (XpService). Ilgari bu yerda
    // faqat `lastActivityDate = today` qo'yilardi, natijada keyingi
    // `touchActivity` "bugun allaqachon belgilangan" deb streakni oshirmasdi.
    await this.xpService.touchActivity(userId);

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

  /**
   * `POST /progress` — ilova (React Native) darsni shu orqali yakunlaydi.
   *
   * IDEMPOTENT (qarang: `completeLesson`): ilova avto-yakunlashni takror
   * yuborsa, allaqachon yakunlangan dars uchun hech narsa o'zgarmaydi —
   * urinishlar, ball, kunlik "yakunlangan darslar" soni o'z joyida qoladi.
   * Javobdagi `alreadyCompleted` ilovaga "banner ko'rsatma" deydi.
   */
  async upsertProgress(userId: string, dto: UpsertProgressDto) {
    const lesson = await this.lessonRepo.findOne({ where: { id: dto.lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await this.assertLessonAccessible(userId, dto.lessonId);

    const existing = await this.progressRepo.findOne({ where: { userId, lessonId: dto.lessonId } });

    if (existing?.status === LessonProgressStatus.completed) {
      await this.xpService.touchActivity(userId);
      return {
        lessonId: existing.lessonId,
        userId: existing.userId,
        score: existing.score,
        completedAt: existing.completedAt,
        alreadyCompleted: true,
      };
    }

    const progress = await this.updateProgress(userId, dto.lessonId, (p) => {
      p.attempts = (p.attempts ?? 0) + 1;
      p.status = LessonProgressStatus.completed;
      p.score = dto.score;
      p.completedAt = new Date();
    });

    await this.xpService.touchActivity(userId);
    await this.bumpDaily(userId, 0, 1);

    return {
      lessonId: progress.lessonId,
      userId: progress.userId,
      score: progress.score,
      completedAt: progress.completedAt,
      alreadyCompleted: false,
    };
  }

  // ─── Ichki yordamchilar ────────────────────────────────────────────────────

  /**
   * MUHIM: `repository.create()` ustunlarning BAZADAGI `default` qiymatini
   * QO'YMAYDI — berilmagan maydon `undefined` bo'lib qoladi. Shuning uchun
   * yangi yozuvda `daily.lessonsCompleted += 1` → `undefined + 1` → `NaN`
   * bo'lardi va INSERT `int` ustunga "NaN" yuborib, Postgres xatosi bilan
   * tugardi (`invalid input syntax for type integer`) → ilovada 500. Ya'ni
   * kunning BIRINCHI avto-yakunlashi har doim yiqilardi. Endi sanoqchilar
   * ochiq 0 bilan boshlanadi.
   */
  private newDaily(userId: string, date: string): DailyTracking {
    return this.dailyRepo.create({
      userId,
      date,
      goalMinutes: 30,
      minutesSpent: 0,
      lessonsCompleted: 0,
      vocabularyReviewed: 0,
      listeningDone: false,
    });
  }

  /** Bugungi kunlik hisobga vaqt (daqiqa) va yakunlangan dars sonini qo'shadi */
  private async bumpDaily(userId: string, minutesDelta: number, lessonsDelta: number) {
    const today = new Date().toISOString().split('T')[0];
    await this.withUniqueRetry(async () => {
      const daily =
        (await this.dailyRepo.findOne({ where: { userId, date: today } })) ??
        this.newDaily(userId, today);
      daily.minutesSpent += Number.isFinite(minutesDelta) ? minutesDelta : 0;
      daily.lessonsCompleted += lessonsDelta;
      return this.dailyRepo.save(daily);
    });
  }

  /**
   * `lesson_progress` yozuvini topib (yo'q bo'lsa — hamma maydoni to'ldirilgan
   * holda yaratib) o'zgartiradi va saqlaydi.
   */
  private async updateProgress(
    userId: string,
    lessonId: string,
    mutate: (p: LessonProgress) => void,
  ): Promise<LessonProgress> {
    return this.withUniqueRetry(async () => {
      const progress =
        (await this.progressRepo.findOne({ where: { userId, lessonId } })) ??
        this.progressRepo.create({
          userId,
          lessonId,
          status: LessonProgressStatus.not_started,
          score: null,
          timeSpentSec: 0,
          attempts: 0,
          completedAt: null,
        });
      mutate(progress);
      return this.progressRepo.save(progress);
    });
  }

  /**
   * Unique konflikt (Postgres 23505) — ikki so'rov bir vaqtda BIR XIL yangi
   * yozuvni yaratmoqchi bo'lgan hol. Avto-yakunlashda bu odatiy: ilova
   * yakunlash bilan birga "sarflangan vaqt"ni ham yuboradi. Konfliktdan keyin
   * qayta o'qib bir marta takrorlanadi — ikkinchi urinish endi mavjud yozuv
   * ustiga yozadi.
   */
  private async withUniqueRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      const code = (e as any)?.code ?? (e as any)?.driverError?.code;
      if (code !== '23505') throw e;
      return fn();
    }
  }
}

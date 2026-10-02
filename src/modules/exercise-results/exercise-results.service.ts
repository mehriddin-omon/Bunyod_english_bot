import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseResult } from 'src/common/core/entitys/exercise-result.entity';
import { SubmitExerciseResultsDto } from './dto/exercise-results.dto';
import { XpService } from '../gamification/xp.service';
import { XpSource } from 'src/common/utils/enum';

@Injectable()
export class ExerciseResultsService {
  constructor(
    @InjectRepository(ExerciseResult)
    private readonly resultRepo: Repository<ExerciseResult>,

    private readonly xpService: XpService,
  ) {}

  /**
   * Ilovadan kelgan natijalar to'plamini saqlaydi (offline navbat sync).
   * (userId, clientAttemptId) bo'yicha ON CONFLICT DO NOTHING — bir xil
   * urinish ikki marta yuborilsa dublikat yozilmaydi.
   *
   * Saqlangandan keyin coin beriladi (pastdagi izohga qarang).
   */
  async submitBatch(userId: string, dto: SubmitExerciseResultsDto) {
    if (!dto.results.length) return { saved: 0, skipped: 0, coinsEarned: 0 };

    const rows = dto.results.map((r) => ({
      userId,
      lessonId: r.lessonId,
      exerciseKey: r.exerciseKey,
      attemptNumber: r.attemptNumber,
      percent: r.percent,
      correctCount: r.correctCount ?? null,
      totalCount: r.totalCount ?? null,
      sectionTotal: r.sectionTotal ?? null,
      answeredAt: new Date(r.answeredAt),
      clientAttemptId: r.clientAttemptId,
    }));

    const res = await this.resultRepo
      .createQueryBuilder()
      .insert()
      .into(ExerciseResult)
      .values(rows)
      .orIgnore()
      .execute();

    // Postgres'da RETURNING faqat haqiqatda INSERT bo'lgan qatorlarni qaytaradi
    const saved = Array.isArray(res.raw) ? res.raw.length : 0;

    const coinsEarned = await this.awardFirstAttemptCoins(
      userId,
      Array.from(new Set(dto.results.map((r) => r.exerciseKey))),
    );

    return { saved, skipped: rows.length - saved, coinsEarned };
  }

  /**
   * MASHQ COINI: 1 to'g'ri javob = 1 coin, faqat BIRINCHI urinish uchun.
   *
   * Nega birinchi urinish: variantlardan tanlab javob berish oson, shuning
   * uchun har urinishga coin bersak mashqni qayta-qayta bosib coin yig'ish
   * mumkin bo'lardi. Birinchi urinishga bog'lash taxmin qilib bosishni
   * to'xtatadi — bola javobni o'ylab beradi.
   *
   * Nega hisob BAZADAN olinadi, kelgan paketdan emas: offline navbat bir
   * necha urinishni birga olib kelishi mumkin va tartib kafolatlangan emas.
   * `DISTINCT ON … ORDER BY attempt_number` esa doim eng birinchi urinishni
   * beradi — natija paket qanday bo'laklarga bo'linib kelganiga bog'liq emas.
   *
   * Takror berilmasligini `xp_transactions` dagi (user_id, source,
   * reference_key) unique indeksi kafolatlaydi — bu yerdagi tekshiruv
   * shunchaki ortiqcha so'rov qilmaslik uchun.
   */
  private async awardFirstAttemptCoins(userId: string, exerciseKeys: string[]): Promise<number> {
    if (!exerciseKeys.length) return 0;

    const alreadyPaid = await this.xpService.alreadyAwarded(
      userId,
      XpSource.exercise_complete,
      exerciseKeys,
    );
    const pending = exerciseKeys.filter((k) => !alreadyPaid.has(k));
    if (!pending.length) return 0;

    const firstAttempts: {
      exercise_key: string;
      lesson_id: string;
      correct_count: number | null;
      total_count: number | null;
    }[] = await this.resultRepo.query(
      `SELECT DISTINCT ON (exercise_key)
              exercise_key, lesson_id, correct_count, total_count
         FROM exercise_results
        WHERE user_id = $1 AND exercise_key = ANY($2::varchar[])
        ORDER BY exercise_key, attempt_number ASC`,
      [userId, pending],
    );

    const awards = firstAttempts
      // Eski ilova versiyasidan kelgan yozuvda hisob yo'q — coin berilmaydi.
      // Foizdan chiqarib olish noto'g'ri bo'lardi (85% — 20 tada 17, 13 tada 11).
      .filter((f) => f.correct_count != null && f.total_count != null)
      .map((f) => ({
        amount: Math.min(Number(f.correct_count), Number(f.total_count)),
        source: XpSource.exercise_complete,
        referenceId: f.lesson_id,
        referenceKey: f.exercise_key,
      }))
      .filter((a) => a.amount > 0);

    return this.xpService.awardMany(userId, awards);
  }

  /** O'quvchining o'z natijalari (ixtiyoriy: bitta dars bo'yicha) */
  async getMy(userId: string, lessonId?: string) {
    const qb = this.resultRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .orderBy('r.answeredAt', 'ASC');

    if (lessonId) qb.andWhere('r.lessonId = :lessonId', { lessonId });

    const rows = await qb.getMany();
    return rows.map((r) => ({
      lessonId: r.lessonId,
      exerciseKey: r.exerciseKey,
      attemptNumber: r.attemptNumber,
      percent: r.percent,
      answeredAt: r.answeredAt,
    }));
  }

  /**
   * Teacher panel uchun: dars bo'yicha yig'ma — har o'quvchi + mashq
   * kesimida urinishlar soni, oxirgi va eng yaxshi foiz.
   * N+1 emas — bitta GROUP BY so'rov.
   */
  async getLessonSummary(lessonId: string) {
    return this.resultRepo
      .createQueryBuilder('r')
      .select('r.user_id', 'userId')
      .addSelect('r.exercise_key', 'exerciseKey')
      .addSelect('COUNT(*)::int', 'attempts')
      .addSelect('MAX(r.percent)::int', 'bestPercent')
      .addSelect(
        '(ARRAY_AGG(r.percent ORDER BY r.answered_at DESC))[1]::int',
        'lastPercent',
      )
      .addSelect('MAX(r.answered_at)', 'lastAnsweredAt')
      .where('r.lesson_id = :lessonId', { lessonId })
      .groupBy('r.user_id')
      .addGroupBy('r.exercise_key')
      .getRawMany();
  }
}

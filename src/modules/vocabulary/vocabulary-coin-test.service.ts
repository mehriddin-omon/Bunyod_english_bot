import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyRelation } from 'src/common/core/entitys/vocabulary-relation.entity';
import { UserVocabularyProgress, VocabStatus } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { VocabularyPracticeLog } from 'src/common/core/entitys/vocabulary-practice-log.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import {
  CoinTestCard,
  CoinTestCardMode,
  CoinTestStatus,
  VocabularyCoinTest,
} from 'src/common/core/entitys/vocabulary-coin-test.entity';
import { XpSource } from 'src/common/utils/enum';
import { LessonGatingService } from 'src/common/services/lesson-gating.service';
import { XpService } from '../gamification/xp.service';

/**
 * LUG'AT COINLI SINOVI — QOIDALAR (2026-09, foydalanuvchi qarori).
 *
 *  1. Dars lug'atidagi HAMMA so'z so'raladi (4 variantli, har so'zga 10 s;
 *     ulgurmasa — xato).
 *  2. So'z "mustahkam" (mastered) holatiga FAQAT shu sinov orqali o'tadi:
 *     to'g'ri topilgan so'z — mustahkam, xato — o'rganilmoqda.
 *  3. Coin:
 *       1-urinish: har to'g'ri so'z +3; 100% → +10, 90%+ → +5;
 *       2-urinish: hamma so'z qayta so'raladi, lekin coin faqat OLDINGI
 *                  urinishda xato bo'lgan so'zlar uchun (+2);
 *       3-urinish: xuddi shunday, +1;
 *       4-urinishdan boshlab so'z coini yo'q.
 *       60% dan past natija — HAR urinishda −20 (xp_total 0 dan pastga
 *       tushmaydi, qarang XpService.penalize).
 *  4. Muddat: keyingi yangi dars sinfda ochilganidan 24 soat o'tguncha
 *     topshirilsagina coin hisoblanadi (LessonGatingService.getLessonUnlockTime);
 *     muddat o'tgach sinov faqat mustahkamlash uchun — na coin, na jarima.
 *  5. Chala qoldirilgan sinov (✕ / ilova yopildi) — urinish sarflanadi,
 *     javob berilmagan so'zlar xato hisoblanadi.
 */
export const COIN_TEST_RULES = {
  /** har so'zga beriladigan vaqt (ilovadagi taymer) */
  timeLimitSec: 10,
  /** server tekshiruvida tarmoq kechikishi uchun qo'shimcha */
  serverSlackSec: 4,
  /** urinish raqamiga qarab so'z coini: 1→3, 2→2, 3→1, 4+→0 */
  perWordByAttempt: [3, 2, 1] as const,
  bonusFull: 10,
  bonusHigh: 5,
  bonusHighThreshold: 90,
  penalty: 20,
  penaltyThreshold: 60,
  deadlineHoursAfterNextLesson: 24,
  /** eng ko'pi bilan nechta urinish coin beradi */
  maxCoinAttempts: 3,
  /** shuncha soniya javobsiz turgan in_progress sinov tashlab ketilgan deb finallanadi */
  staleAfterSec: 30,
} as const;

export interface CoinTestOutcome {
  /** shu urinishda coin oladigan so'zlar soni (1-urinish — hammasi, keyin — oldin xato bo'lganlar) */
  eligibleWords: number;
  /** har to'g'ri so'z uchun coin */
  perWord: number;
  words: number;
  bonus: number;
  /** so'raladigan jarima (manfiy yoki 0); haqiqatda ayirilgani XpService da aniqlanadi */
  penalty: number;
  total: number;
}

/** Foiz — yaxlitlangan, 0 so'zda 0 */
export function coinTestPercent(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/**
 * Coin hisobi — SOF funksiya (test qilish oson). Faqat qoidalarni
 * ifodalaydi, bazaga tegmaydi.
 */
export function computeCoinTestCoins(input: {
  attemptNumber: number;
  cards: Pick<CoinTestCard, 'correct' | 'prevWrong'>[];
  /** muddat ichida topshirildimi */
  eligible: boolean;
}): CoinTestOutcome {
  const total = input.cards.length;
  const correct = input.cards.filter((c) => c.correct === true).length;
  const percent = coinTestPercent(correct, total);

  if (!input.eligible || total === 0) {
    return { eligibleWords: 0, perWord: 0, words: 0, bonus: 0, penalty: 0, total: 0 };
  }

  const attempt = Math.max(1, input.attemptNumber);
  const perWord = attempt <= COIN_TEST_RULES.maxCoinAttempts
    ? COIN_TEST_RULES.perWordByAttempt[attempt - 1]
    : 0;

  const eligibleCards = attempt === 1 ? input.cards : input.cards.filter((c) => c.prevWrong);
  const words = perWord * eligibleCards.filter((c) => c.correct === true).length;

  const bonus = attempt === 1
    ? percent === 100
      ? COIN_TEST_RULES.bonusFull
      : percent >= COIN_TEST_RULES.bonusHighThreshold
        ? COIN_TEST_RULES.bonusHigh
        : 0
    : 0;

  const penalty = percent < COIN_TEST_RULES.penaltyThreshold ? -COIN_TEST_RULES.penalty : 0;

  return { eligibleWords: eligibleCards.length, perWord, words, bonus, penalty, total: words + bonus + penalty };
}

/**
 * Sinovda ishlatiladigan savol turlari — oddiy flashcard YO'Q (u o'z-o'zini
 * baholaydi, obyektiv tekshirib bo'lmaydi). Turlar har karta uchun serverda
 * tasodifiy tanlanadi, ya'ni bitta sinovda aralash keladi.
 */
const COIN_TEST_MODES: CoinTestCardMode[] = ['multiple_choice', 'audio', 'typing'];

/** Shu karta uchun kutilayotgan javob: typing'da inglizcha so'z, qolganda tarjima */
function expectedAnswerOf(card: Pick<CoinTestCard, 'mode' | 'word' | 'translation'>): string {
  return card.mode === 'typing' ? card.word : card.translation;
}

const normalizeAnswer = (s: string | null | undefined) =>
  (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .replace(/\s+/g, ' ');

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// SRS oraliqlari — vocabulary.service.ts bilan bir xil
const REVIEW_MS_GOOD = 7 * 86_400_000;
const REVIEW_MS_OK = 3 * 86_400_000;
const REVIEW_MS_FAIL = 1 * 86_400_000;

@Injectable()
export class VocabularyCoinTestService {
  constructor(
    @InjectRepository(VocabularyCoinTest)
    private readonly testRepo: Repository<VocabularyCoinTest>,

    @InjectRepository(Vocabulary)
    private readonly wordRepo: Repository<Vocabulary>,

    @InjectRepository(VocabularyRelation)
    private readonly pairRepo: Repository<VocabularyRelation>,

    @InjectRepository(UserVocabularyProgress)
    private readonly progressRepo: Repository<UserVocabularyProgress>,

    @InjectRepository(VocabularyPracticeLog)
    private readonly logRepo: Repository<VocabularyPracticeLog>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    private readonly xpService: XpService,
    private readonly lessonGatingService: LessonGatingService,
  ) {}

  // ─── Ochiq API ────────────────────────────────────────────────────────────

  /** "Coinli sinov" kartasi uchun holat: urinishlar, muddat, oxirgi natija. */
  async getStatus(userId: string, lessonId: string) {
    await this.finalizeStale(userId, lessonId);

    const [tests, pairs, deadlineAt] = await Promise.all([
      this.testRepo.find({ where: { userId, lessonId }, order: { attemptNumber: 'ASC' } }),
      this.loadLessonPairs(lessonId),
      this.computeDeadline(userId, lessonId),
    ]);

    const finished = tests.filter((t) => t.status !== CoinTestStatus.in_progress);
    const last = finished.length ? finished[finished.length - 1] : null;
    const nextAttempt = finished.length + 1;
    const perWord = nextAttempt <= COIN_TEST_RULES.maxCoinAttempts
      ? COIN_TEST_RULES.perWordByAttempt[nextAttempt - 1]
      : 0;
    const deadlinePassed = !!deadlineAt && Date.now() > deadlineAt.getTime();

    const pairIds = pairs.map((p) => p.id);
    const mastered = pairIds.length
      ? await this.progressRepo.count({ where: { userId, pairId: In(pairIds), status: VocabStatus.mastered } })
      : 0;

    return {
      lessonId,
      totalWords: pairs.length,
      attemptsUsed: finished.length,
      nextAttempt,
      /** keyingi urinishda har to'g'ri so'z uchun coin (0 — coin yo'q) */
      perWord,
      /** keyingi urinishda coin oladigan so'zlar soni */
      eligibleWords: nextAttempt === 1
        ? pairs.length
        : last
          ? last.cards.filter((c) => c.correct !== true).length
          : pairs.length,
      bonusEligible: nextAttempt === 1,
      coinsAvailable: !deadlinePassed && perWord > 0,
      deadlineAt: deadlineAt?.toISOString() ?? null,
      deadlinePassed,
      rules: {
        timeLimitSec: COIN_TEST_RULES.timeLimitSec,
        bonusFull: COIN_TEST_RULES.bonusFull,
        bonusHigh: COIN_TEST_RULES.bonusHigh,
        bonusHighThreshold: COIN_TEST_RULES.bonusHighThreshold,
        penalty: COIN_TEST_RULES.penalty,
        penaltyThreshold: COIN_TEST_RULES.penaltyThreshold,
        maxCoinAttempts: COIN_TEST_RULES.maxCoinAttempts,
      },
      totalCoins: finished.reduce((sum, t) => sum + (t.coinsEarned ?? 0), 0),
      mastered,
      lastResult: last ? this.buildResult(last) : null,
    };
  }

  /** Yangi urinish: hamma so'z, aralashtirilgan, 4 variant. Javoblar serverda. */
  async start(userId: string, lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    // Tugallanmagan sinov bo'lsa — urinish sarflanadi (qolgan so'zlar xato)
    await this.finalizeStale(userId, lessonId, true);

    const pairs = await this.loadLessonPairs(lessonId);
    if (!pairs.length) throw new BadRequestException("Bu darsda lug'at so'zlari yo'q");

    const [previous, deadlineAt, globalPool] = await Promise.all([
      this.testRepo.findOne({
        where: { userId, lessonId, status: In([CoinTestStatus.completed, CoinTestStatus.abandoned]) },
        order: { attemptNumber: 'DESC' },
      }),
      this.computeDeadline(userId, lessonId),
      // Chalg'ituvchi variantlar: avval shu darsning tarjimalari, yetmasa umumiy hovuz
      this.wordRepo
        .createQueryBuilder('w')
        .select('w.word', 'word')
        .where('w.lang = :lang', { lang: 'uz' })
        .orderBy('RANDOM()')
        .limit(100)
        .getRawMany<{ word: string }>(),
    ]);

    const attemptNumber = (previous?.attemptNumber ?? 0) + 1;
    const prevWrong = new Set(
      previous ? previous.cards.filter((c) => c.correct !== true).map((c) => c.pairId) : [],
    );
    const lessonTranslations = pairs.map((p) => p.translation.word);
    const pool = globalPool.map((d) => d.word);

    const cards: CoinTestCard[] = shuffle(pairs).map((pair) => {
      // Savol turi aralash: multiple_choice / audio / typing. Audio faqat
      // talaffuz fayli bor so'zlarda — yo'q bo'lsa variantli savolga tushadi.
      let mode = COIN_TEST_MODES[Math.floor(Math.random() * COIN_TEST_MODES.length)];
      if (mode === 'audio' && !pair.vocabulary.voiceFileId) mode = 'multiple_choice';

      return {
        pairId: pair.id,
        word: pair.vocabulary.word,
        ipa: pair.vocabulary.ipa ?? null,
        pos: pair.vocabulary.pos ?? null,
        imageUrl: pair.vocabulary.imageUrl ?? null,
        voiceFileId: pair.vocabulary.voiceFileId ?? null,
        translation: pair.translation.word,
        mode,
        // Yozib javob berishda variant kerak emas
        options: mode === 'typing' ? [] : this.buildOptions(pair.translation.word, lessonTranslations, pool),
        prevWrong: prevWrong.has(pair.id),
        answer: null,
        correct: null,
        answeredAt: null,
        timedOut: false,
      };
    });

    const now = new Date();
    const test = await this.testRepo.save(
      this.testRepo.create({
        userId,
        lessonId,
        attemptNumber,
        status: CoinTestStatus.in_progress,
        cards,
        currentIndex: 0,
        lastServedAt: now,
        deadlineAt,
        totalWords: cards.length,
      }),
    );

    const perWord = attemptNumber <= COIN_TEST_RULES.maxCoinAttempts
      ? COIN_TEST_RULES.perWordByAttempt[attemptNumber - 1]
      : 0;
    const deadlinePassed = !!deadlineAt && now.getTime() > deadlineAt.getTime();

    return {
      testId: test.id,
      attemptNumber,
      totalWords: cards.length,
      timeLimitSec: COIN_TEST_RULES.timeLimitSec,
      perWord,
      eligibleWords: attemptNumber === 1 ? cards.length : cards.filter((c) => c.prevWrong).length,
      bonusEligible: attemptNumber === 1,
      coinsAvailable: !deadlinePassed && perWord > 0,
      deadlineAt: deadlineAt?.toISOString() ?? null,
      // To'g'ri javob YUBORILMAYDI — u har javobdan keyin qaytariladi.
      // Typing savolida inglizcha so'z ham yuborilmaydi (javobning o'zi), faqat
      // tarjima ko'rsatiladi; audio savolida esa so'z yozuvi yashiriladi.
      cards: cards.map((c) => ({
        pairId: c.pairId,
        mode: c.mode,
        word: c.mode === 'multiple_choice' ? c.word : null,
        ipa: c.mode === 'multiple_choice' ? c.ipa : null,
        pos: c.pos,
        imageUrl: c.imageUrl,
        // Typing'da talaffuz javobni oshkor qiladi — audio berilmaydi
        voiceFileId: c.mode === 'typing' ? null : c.voiceFileId,
        // Typing'da tarjima savol bo'lib ko'rsatiladi
        prompt: c.mode === 'typing' ? c.translation : null,
        options: c.options,
      })),
    };
  }

  /**
   * Bitta so'zga javob. Vaqt SERVERDA tekshiriladi: karta berilganidan
   * (`lastServedAt`) 10 s + tarmoq zaxirasi o'tgan bo'lsa — xato.
   * `answer = null` — ilovadagi taymer tugadi.
   */
  async answer(userId: string, testId: string, pairId: string, answer: string | null) {
    const test = await this.testRepo.findOne({ where: { id: testId, userId } });
    if (!test) throw new NotFoundException('Sinov topilmadi');
    if (test.status !== CoinTestStatus.in_progress) {
      throw new BadRequestException('Bu sinov allaqachon tugagan');
    }

    const card = test.cards[test.currentIndex];
    if (!card) throw new BadRequestException("Sinovda navbatdagi so'z qolmagan");
    if (card.pairId !== pairId) {
      throw new BadRequestException("Navbatdagi so'z boshqa — ilova sinov bilan mos emas");
    }

    const now = new Date();
    const servedAt = test.lastServedAt ? new Date(test.lastServedAt).getTime() : test.createdAt.getTime();
    const elapsedSec = (now.getTime() - servedAt) / 1000;
    const lateOnServer = elapsedSec > COIN_TEST_RULES.timeLimitSec + COIN_TEST_RULES.serverSlackSec;
    const expected = expectedAnswerOf(card);
    const timedOut = answer == null || (typeof answer === 'string' && answer.trim() === '') || lateOnServer;
    const correct = !timedOut && normalizeAnswer(answer) === normalizeAnswer(expected);

    card.answer = answer ?? null;
    card.correct = correct;
    card.timedOut = timedOut;
    card.answeredAt = now.toISOString();

    test.currentIndex += 1;
    test.lastServedAt = now;
    const done = test.currentIndex >= test.cards.length;

    let result: ReturnType<VocabularyCoinTestService['buildResult']> | null = null;
    if (done) {
      result = await this.finalize(test, CoinTestStatus.completed, now);
    } else {
      await this.testRepo.save(test);
    }

    return {
      correct,
      timedOut,
      /** shu savol turi uchun kutilgan javob (typing — inglizcha so'z) */
      correctAnswer: expected,
      /** to'liq juftlik — natijani ko'rsatishda ikkalasi ham kerak */
      word: card.word,
      translation: card.translation,
      index: test.currentIndex - 1,
      answered: test.currentIndex,
      total: test.cards.length,
      done,
      result,
    };
  }

  /** ✕ — sinov tashlab ketildi: urinish sarflanadi, qolgan so'zlar xato. */
  async abandon(userId: string, testId: string) {
    const test = await this.testRepo.findOne({ where: { id: testId, userId } });
    if (!test) throw new NotFoundException('Sinov topilmadi');
    if (test.status !== CoinTestStatus.in_progress) return this.buildResult(test);
    return this.finalize(test, CoinTestStatus.abandoned, new Date());
  }

  // ─── Ichki ────────────────────────────────────────────────────────────────

  /**
   * Natijani yakunlaydi: javobsiz so'zlar xato, coin hisobi, so'z holatlari
   * (to'g'ri → mustahkam, xato → o'rganilmoqda), daftar, faollik.
   */
  private async finalize(test: VocabularyCoinTest, status: CoinTestStatus, now: Date) {
    for (const card of test.cards) {
      if (card.correct === null) {
        card.correct = false;
        card.timedOut = true;
        card.answer = null;
      }
    }

    const total = test.cards.length;
    const correctCount = test.cards.filter((c) => c.correct === true).length;
    const percent = coinTestPercent(correctCount, total);
    const eligible = !test.deadlineAt || now.getTime() <= new Date(test.deadlineAt).getTime();
    const outcome = computeCoinTestCoins({ attemptNumber: test.attemptNumber, cards: test.cards, eligible });

    // ── Coin daftari (har yozuv referenceKey bilan — takror finalize hech narsa qo'shmaydi)
    let coinsWords = 0;
    let coinsBonus = 0;
    let coinsPenalty = 0;
    if (outcome.words > 0) {
      coinsWords = await this.xpService.award({
        userId: test.userId,
        amount: outcome.words,
        source: XpSource.vocabulary_test,
        referenceId: test.lessonId,
        referenceKey: `vtest:${test.id}:words`,
      });
    }
    if (outcome.bonus > 0) {
      coinsBonus = await this.xpService.award({
        userId: test.userId,
        amount: outcome.bonus,
        source: XpSource.vocabulary_test,
        referenceId: test.lessonId,
        referenceKey: `vtest:${test.id}:bonus`,
      });
    }
    if (outcome.penalty < 0) {
      const applied = await this.xpService.penalize({
        userId: test.userId,
        amount: -outcome.penalty,
        source: XpSource.vocabulary_test,
        referenceId: test.lessonId,
        referenceKey: `vtest:${test.id}:penalty`,
      });
      coinsPenalty = -applied;
    }

    // ── So'z holatlari: faqat shu sinov "mustahkam" beradi
    const pairIds = test.cards.map((c) => c.pairId);
    const [pairs, progressList] = await Promise.all([
      this.pairRepo.find({ where: { id: In(pairIds) } }),
      this.progressRepo.find({ where: { userId: test.userId, pairId: In(pairIds) } }),
    ]);
    const pairMap = new Map(pairs.map((p) => [p.id, p]));
    const progressMap = new Map(progressList.map((p) => [p.pairId, p]));

    const updatedProgress: UserVocabularyProgress[] = [];
    const updatedPairs: VocabularyRelation[] = [];
    const logs: VocabularyPracticeLog[] = [];

    for (const card of test.cards) {
      const pair = pairMap.get(card.pairId);
      if (!pair) continue;
      const correct = card.correct === true;

      let progress = progressMap.get(card.pairId);
      if (!progress) {
        progress = this.progressRepo.create({
          userId: test.userId, pairId: card.pairId, status: VocabStatus.new, attempts: 0, wrongAttempts: 0,
        });
      }
      progress.attempts += 1;
      if (!correct) progress.wrongAttempts += 1;
      const errorRate = progress.wrongAttempts / progress.attempts;
      progress.nextReviewAt = new Date(
        now.getTime() + (correct ? (errorRate < 0.2 ? REVIEW_MS_GOOD : REVIEW_MS_OK) : REVIEW_MS_FAIL),
      );
      progress.status = correct ? VocabStatus.mastered : VocabStatus.learning;
      updatedProgress.push(progress);

      pair.attempts += 1;
      if (!correct) pair.wrongAttempts += 1;
      pair.difficulty = pair.attempts > 0 ? pair.wrongAttempts / pair.attempts : 0;
      updatedPairs.push(pair);

      logs.push(this.logRepo.create({ sessionId: null, pairId: card.pairId, mode: 'multiple_choice', correct }));
    }

    test.status = status;
    test.finishedAt = now;
    test.totalWords = total;
    test.correctCount = correctCount;
    test.percent = percent;
    test.coinsEligible = eligible;
    test.coinsWords = coinsWords;
    test.coinsBonus = coinsBonus;
    test.coinsPenalty = coinsPenalty;
    test.coinsEarned = coinsWords + coinsBonus + coinsPenalty;
    test.timeSpentSec = Math.max(0, Math.round((now.getTime() - test.createdAt.getTime()) / 1000));

    await Promise.all([
      this.testRepo.save(test),
      this.progressRepo.save(updatedProgress),
      this.pairRepo.save(updatedPairs),
      this.logRepo.save(logs),
    ]);
    await this.xpService.touchActivity(test.userId);

    return this.buildResult(test);
  }

  /** Ilovaga qaytariladigan natija (kartadagi "oxirgi natija" ham shu). */
  private buildResult(test: VocabularyCoinTest) {
    const wrongWords = test.cards
      .filter((c) => c.correct !== true)
      .map((c) => ({
        pairId: c.pairId,
        word: c.word,
        translation: c.translation,
        mode: c.mode,
        answer: c.answer,
        timedOut: !!c.timedOut,
      }));
    return {
      testId: test.id,
      attemptNumber: test.attemptNumber,
      status: test.status,
      totalWords: test.totalWords,
      correct: test.correctCount,
      wrong: test.totalWords - test.correctCount,
      percent: test.percent,
      coins: {
        words: test.coinsWords,
        bonus: test.coinsBonus,
        penalty: test.coinsPenalty,
        total: test.coinsEarned,
      },
      coinsEligible: test.coinsEligible,
      deadlineAt: test.deadlineAt ? new Date(test.deadlineAt).toISOString() : null,
      /** shu sinovda mustahkam bo'lgan so'zlar (= to'g'ri javoblar) */
      mastered: test.correctCount,
      wrongWords,
      finishedAt: test.finishedAt ? new Date(test.finishedAt).toISOString() : null,
    };
  }

  /**
   * Muddat = keyingi dars sinfda ochilgan vaqt + 24 soat.
   * Keyingi dars yo'q (oxirgi dars) yoki hali ochilmagan — muddat yo'q (null).
   */
  private async computeDeadline(userId: string, lessonId: string): Promise<Date | null> {
    const order = await this.lessonGatingService.getPublishedLessonOrder();
    const index = order.findIndex((l) => l.id === lessonId);
    if (index === -1 || index + 1 >= order.length) return null;
    const openedAt = await this.lessonGatingService.getLessonUnlockTime(userId, index + 1);
    if (!openedAt) return null;
    return new Date(openedAt.getTime() + COIN_TEST_RULES.deadlineHoursAfterNextLesson * 3_600_000);
  }

  /**
   * Tashlab ketilgan (in_progress, lekin javob kelmay qolgan) sinovlarni
   * yakunlaydi — urinish sarflanadi. `force` — yangi sinov boshlanayotganda
   * hali yangi bo'lsa ham yopiladi.
   */
  private async finalizeStale(userId: string, lessonId: string, force = false): Promise<void> {
    const cutoff = new Date(Date.now() - COIN_TEST_RULES.staleAfterSec * 1000);
    const stale = await this.testRepo.find({
      where: force
        ? { userId, lessonId, status: CoinTestStatus.in_progress }
        : { userId, lessonId, status: CoinTestStatus.in_progress, lastServedAt: LessThan(cutoff) },
    });
    for (const test of stale) {
      // Sinov aslida oxirgi javob paytida uzilgan — muddat tekshiruvi va
      // sarflangan vaqt o'sha paytga qarab hisoblanadi (hozirgi vaqtga emas)
      const endedAt = test.lastServedAt ? new Date(test.lastServedAt) : new Date(test.createdAt);
      await this.finalize(test, CoinTestStatus.abandoned, endedAt);
    }
  }

  /** Darsning juftliklari (inglizcha so'z + tarjima), o'qituvchi tartibida. */
  private async loadLessonPairs(lessonId: string): Promise<VocabularyRelation[]> {
    return this.pairRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.vocabulary', 'src')
      .innerJoinAndSelect('r.translation', 'trg')
      .where('src.lessonId = :lessonId', { lessonId })
      .andWhere('src.lang = :lang', { lang: 'en' })
      .orderBy('src.orderIndex', 'ASC')
      .getMany();
  }

  /** 3 ta chalg'ituvchi (avval shu dars tarjimalaridan) + to'g'ri javob, aralash. */
  private buildOptions(correct: string, lessonTranslations: string[], pool: string[]): string[] {
    const seen = new Set<string>([normalizeAnswer(correct)]);
    const distractors: string[] = [];
    const take = (candidates: string[]) => {
      for (const w of shuffle(candidates)) {
        if (distractors.length >= 3) break;
        const key = normalizeAnswer(w);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        distractors.push(w);
      }
    };
    take(lessonTranslations);
    if (distractors.length < 3) take(pool);
    return shuffle([...distractors, correct]);
  }
}

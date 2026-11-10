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
import { XpService } from '../gamification/xp.service';
import { LessonScoreService } from 'src/common/services/lesson-score.service';

/**
 * LUG'AT COINLI SINOVI — QOIDALAR (2026-11, foydalanuvchi qarori).
 *
 *  1. Dars lug'ati 35 tadan QISMLARGA bo'linadi (o'qituvchi tartibida):
 *     1-qism 1–35, 2-qism 36–70. Har qism alohida sinov.
 *  2. Faqat YOZISH: o'zbekcha tarjima ko'rsatiladi, inglizcha so'z yoziladi
 *     (har so'zga 15 s; ulgurmasa — xato). Variantli / audio savol yo'q.
 *  3. Sinov ERKIN: oldin mashq qilmasdan ham ishlash mumkin.
 *  4. So'z "mustahkam" (mastered) holatiga FAQAT shu sinov orqali o'tadi:
 *     to'g'ri — mustahkam, xato — o'rganilmoqda.
 *  5. Coin SO'Z BO'YICHA: so'z coinli sinovda 1-marta so'ralganda to'g'ri → +2,
 *     2-marta → +1, 3-martadan boshlab 0. 100% → +5 (qismning 1–2-urinishida).
 *     60% dan past — HAR urinishda −10 (xp_total 0 dan pastga tushmaydi).
 *  6. Muddat YO'Q. API'dagi `deadlineAt`/`deadlinePassed` eski ilova
 *     versiyalari uchun qoldirilgan — doim `null`/`false`.
 *  7. Chala qoldirilgan sinov (✕ / ilova yopildi) — urinish sarflanadi,
 *     javob berilmagan so'zlar xato hisoblanadi.
 *  8. SRS: to'g'ri → kamida 2-pog'ona (keyingi takror +7 kun), xato → 0 (+1 kun).
 */
export const COIN_TEST_RULES = {
  /** qism hajmi — bitta sinovda nechta so'z */
  partSize: 35,
  /** har so'zga beriladigan vaqt (ilovadagi taymer) */
  timeLimitSec: 15,
  /** server tekshiruvida tarmoq kechikishi uchun qo'shimcha */
  serverSlackSec: 4,
  /** so'z nechinchi marta so'ralayotganiga qarab coin: 1→2, 2→1, 3+→0 */
  perWordByAttempt: [2, 1] as const,
  /** 100% → +5 */
  bonusFull: 5,
  /** eskirgan (90% bonusi olib tashlandi) — eski ilovalar uchun 0 */
  bonusHigh: 0,
  bonusHighThreshold: 90,
  penalty: 10,
  penaltyThreshold: 60,
  /** bonus qismning shu urinishigacha beriladi; so'z coini ham shu songacha */
  maxCoinAttempts: 2,
  /** shuncha soniya javobsiz turgan in_progress sinov tashlab ketilgan deb finallanadi */
  staleAfterSec: 40,
} as const;

/** SRS oraliqlari (kun): pog'ona 0 → 1, 1 → 3, 2 → 7, 3 → 30; 4 — uzoq muddat */
export const SRS_DAYS = [1, 3, 7, 30] as const;
export const SRS_LONG_TERM_STEP = SRS_DAYS.length;
const DAY_MS = 86_400_000;

/** Pog'onaga qarab keyingi takror sanasi (uzoq muddatda null) */
export function srsNextReview(step: number, now: Date): Date | null {
  if (step >= SRS_LONG_TERM_STEP) return null;
  return new Date(now.getTime() + SRS_DAYS[Math.max(0, step)] * DAY_MS);
}

/** So'z nechinchi marta so'ralayotganiga qarab coin */
export function perWordCoin(wordAttempt: number): number {
  return wordAttempt >= 1 && wordAttempt <= COIN_TEST_RULES.perWordByAttempt.length
    ? COIN_TEST_RULES.perWordByAttempt[wordAttempt - 1]
    : 0;
}

export interface CoinTestOutcome {
  /** shu urinishda coin oladigan so'zlar soni */
  eligibleWords: number;
  /** eng katta so'z coini (ko'rsatish uchun) */
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

/** Karta uchun so'z urinishi: yangi sinovlarda `wordAttempt`, eskilarida taxminiy */
function wordAttemptOf(card: Pick<CoinTestCard, 'prevWrong' | 'wordAttempt'>, attemptNumber: number): number {
  if (card.wordAttempt) return card.wordAttempt;
  if (attemptNumber <= 1) return 1;
  return card.prevWrong ? 2 : 3;
}

/**
 * Coin hisobi — SOF funksiya (test qilish oson). Faqat qoidalarni
 * ifodalaydi, bazaga tegmaydi.
 */
export function computeCoinTestCoins(input: {
  attemptNumber: number;
  cards: Pick<CoinTestCard, 'correct' | 'prevWrong' | 'wordAttempt'>[];
  /** coin hisoblanadimi (muddat yo'q — doim true) */
  eligible: boolean;
}): CoinTestOutcome {
  const total = input.cards.length;
  const correct = input.cards.filter((c) => c.correct === true).length;
  const percent = coinTestPercent(correct, total);

  if (!input.eligible || total === 0) {
    return { eligibleWords: 0, perWord: 0, words: 0, bonus: 0, penalty: 0, total: 0 };
  }

  const attempt = Math.max(1, input.attemptNumber);
  const coinOf = input.cards.map((c) => perWordCoin(wordAttemptOf(c, attempt)));
  const words = input.cards.reduce((sum, c, i) => sum + (c.correct === true ? coinOf[i] : 0), 0);
  const eligibleWords = coinOf.filter((v) => v > 0).length;
  const perWord = coinOf.length ? Math.max(...coinOf) : 0;

  const bonus = percent === 100 && attempt <= COIN_TEST_RULES.maxCoinAttempts ? COIN_TEST_RULES.bonusFull : 0;
  const penalty = percent < COIN_TEST_RULES.penaltyThreshold ? -COIN_TEST_RULES.penalty : 0;

  return { eligibleWords, perWord, words, bonus, penalty, total: words + bonus + penalty };
}

/**
 * Sinovda ishlatiladigan savol turlari — oddiy flashcard YO'Q (u o'z-o'zini
 * baholaydi, obyektiv tekshirib bo'lmaydi). Turlar har karta uchun serverda
 * tasodifiy tanlanadi, ya'ni bitta sinovda aralash keladi.
 */
// 2026-11: coinli sinov faqat yozish (typing). Turlar ro'yxati eski sinovlar uchun.
export const COIN_TEST_MODES: CoinTestCardMode[] = ['typing'];

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
    private readonly lessonScore: LessonScoreService,
  ) {}

  // ─── Ochiq API ────────────────────────────────────────────────────────────

  /**
   * "Coinli sinov" kartasi uchun holat: qismlar (35 tadan), urinishlar,
   * mavjud coin, oxirgi natija. Yuqori darajadagi maydonlar — 1-qism
   * (eski ilova versiyalari uchun).
   */
  async getStatus(userId: string, lessonId: string) {
    await this.finalizeStale(userId, lessonId);

    const [tests, pairs] = await Promise.all([
      this.testRepo.find({ where: { userId, lessonId }, order: { createdAt: 'ASC' } }),
      this.loadLessonPairs(userId, lessonId),
    ]);

    const finished = tests.filter((t) => t.status !== CoinTestStatus.in_progress);
    const asked = this.wordAttemptCounts(finished);
    const pairIds = pairs.map((p) => p.id);
    const masteredSet = new Set(
      pairIds.length
        ? (await this.progressRepo.find({
            where: { userId, pairId: In(pairIds), status: VocabStatus.mastered },
            select: { pairId: true },
          })).map((p) => p.pairId)
        : [],
    );

    const partCount = Math.ceil(pairs.length / COIN_TEST_RULES.partSize);
    const parts = Array.from({ length: partCount }, (_, i) => {
      const part = i + 1;
      const slice = this.slicePart(pairs, part);
      const partTests = finished.filter((t) => (t.part ?? 1) === part);
      const last = partTests.length ? partTests[partTests.length - 1] : null;
      const best = partTests.reduce((m, t) => Math.max(m, t.percent ?? 0), 0);
      const coinsLeft = slice.reduce((sum, p) => sum + perWordCoin((asked.get(p.id) ?? 0) + 1), 0);
      return {
        part,
        from: i * COIN_TEST_RULES.partSize + 1,
        to: i * COIN_TEST_RULES.partSize + slice.length,
        totalWords: slice.length,
        attemptsUsed: partTests.length,
        nextAttempt: partTests.length + 1,
        /** keyingi urinishda olish mumkin bo'lgan eng ko'p so'z coini */
        coinsAvailable: coinsLeft,
        bonusEligible: partTests.length + 1 <= COIN_TEST_RULES.maxCoinAttempts,
        mastered: slice.filter((p) => masteredSet.has(p.id)).length,
        bestPercent: partTests.length ? best : null,
        totalCoins: partTests.reduce((sum, t) => sum + (t.coinsEarned ?? 0), 0),
        lastResult: last ? this.buildResult(last) : null,
      };
    });

    const first = parts[0] ?? null;
    const last = finished.length ? finished[finished.length - 1] : null;
    const firstNext = first?.nextAttempt ?? 1;
    return {
      lessonId,
      totalWords: pairs.length,
      partSize: COIN_TEST_RULES.partSize,
      parts,
      // ── eski ilova versiyalari uchun (1-qism bo'yicha)
      attemptsUsed: first?.attemptsUsed ?? 0,
      nextAttempt: firstNext,
      perWord: perWordCoin(firstNext),
      eligibleWords: first ? this.slicePart(pairs, 1).filter((p) => perWordCoin((asked.get(p.id) ?? 0) + 1) > 0).length : 0,
      bonusEligible: firstNext <= COIN_TEST_RULES.maxCoinAttempts,
      coinsAvailable: parts.some((p) => p.coinsAvailable > 0),
      deadlineAt: null,
      deadlinePassed: false,
      rules: {
        partSize: COIN_TEST_RULES.partSize,
        timeLimitSec: COIN_TEST_RULES.timeLimitSec,
        perWordByAttempt: COIN_TEST_RULES.perWordByAttempt,
        bonusFull: COIN_TEST_RULES.bonusFull,
        bonusHigh: COIN_TEST_RULES.bonusHigh,
        bonusHighThreshold: COIN_TEST_RULES.bonusHighThreshold,
        penalty: COIN_TEST_RULES.penalty,
        penaltyThreshold: COIN_TEST_RULES.penaltyThreshold,
        maxCoinAttempts: COIN_TEST_RULES.maxCoinAttempts,
      },
      totalCoins: finished.reduce((sum, t) => sum + (t.coinsEarned ?? 0), 0),
      mastered: masteredSet.size,
      lastResult: last ? this.buildResult(last) : null,
    };
  }

  /** Yangi urinish: qismdagi so'zlar (35 ta), aralashtirilgan, faqat yozish. Javoblar serverda. */
  async start(userId: string, lessonId: string, part = 1) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    // Tugallanmagan sinov bo'lsa — urinish sarflanadi (qolgan so'zlar xato)
    await this.finalizeStale(userId, lessonId, true);

    const allPairs = await this.loadLessonPairs(userId, lessonId);
    if (!allPairs.length) throw new BadRequestException("Bu darsda lug'at so'zlari yo'q");
    const partCount = Math.ceil(allPairs.length / COIN_TEST_RULES.partSize);
    if (!Number.isInteger(part) || part < 1 || part > partCount) {
      throw new BadRequestException(`Qism 1–${partCount} oralig'ida bo'lishi kerak`);
    }
    const pairs = this.slicePart(allPairs, part);

    const finished = await this.testRepo.find({
      where: { userId, lessonId, status: In([CoinTestStatus.completed, CoinTestStatus.abandoned]) },
      order: { createdAt: 'ASC' },
    });
    const asked = this.wordAttemptCounts(finished);
    const partTests = finished.filter((t) => (t.part ?? 1) === part);
    const previous = partTests.length ? partTests[partTests.length - 1] : null;
    const attemptNumber = partTests.length + 1;
    const prevWrong = new Set(
      previous ? previous.cards.filter((c) => c.correct !== true).map((c) => c.pairId) : [],
    );

    const cards: CoinTestCard[] = shuffle(pairs).map((pair) => ({
      pairId: pair.id,
      word: pair.vocabulary.word,
      ipa: pair.vocabulary.ipa ?? null,
      pos: pair.vocabulary.pos ?? null,
      imageUrl: pair.vocabulary.imageUrl ?? null,
      voiceFileId: pair.vocabulary.voiceFileId ?? null,
      translation: pair.translation.word,
      mode: 'typing' as CoinTestCardMode,
      options: [],
      prevWrong: prevWrong.has(pair.id),
      wordAttempt: (asked.get(pair.id) ?? 0) + 1,
      answer: null,
      correct: null,
      answeredAt: null,
      timedOut: false,
    }));

    const now = new Date();
    const test = await this.testRepo.save(
      this.testRepo.create({
        userId,
        lessonId,
        part,
        attemptNumber,
        status: CoinTestStatus.in_progress,
        cards,
        currentIndex: 0,
        lastServedAt: now,
        deadlineAt: null,
        totalWords: cards.length,
      }),
    );

    const coinsAvailable = cards.reduce((sum, c) => sum + perWordCoin(c.wordAttempt ?? 1), 0);
    return {
      testId: test.id,
      part,
      partCount,
      attemptNumber,
      totalWords: cards.length,
      timeLimitSec: COIN_TEST_RULES.timeLimitSec,
      perWord: cards.length ? Math.max(...cards.map((c) => perWordCoin(c.wordAttempt ?? 1))) : 0,
      eligibleWords: cards.filter((c) => perWordCoin(c.wordAttempt ?? 1) > 0).length,
      coinsAvailable: coinsAvailable > 0,
      maxWordCoins: coinsAvailable,
      bonusEligible: attemptNumber <= COIN_TEST_RULES.maxCoinAttempts,
      deadlineAt: null,
      // To'g'ri javob (inglizcha so'z) YUBORILMAYDI — u har javobdan keyin
      // qaytariladi. Talaffuz ham berilmaydi (javobni oshkor qiladi).
      cards: cards.map((c) => ({
        pairId: c.pairId,
        mode: c.mode,
        word: null,
        ipa: null,
        pos: c.pos,
        imageUrl: c.imageUrl,
        voiceFileId: null,
        prompt: c.translation,
        options: [],
        /** shu so'z to'g'ri topilsa beriladigan coin */
        coin: perWordCoin(c.wordAttempt ?? 1),
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
    // Muddat yo'q: har qanday urinish coin/jarima qoidalari bo'yicha hisoblanadi
    const eligible = true;
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
          userId: test.userId, pairId: card.pairId, status: VocabStatus.new, attempts: 0, wrongAttempts: 0, srsStep: 0,
        });
      }
      progress.attempts += 1;
      if (!correct) progress.wrongAttempts += 1;
      // SRS: to'g'ri → kamida 2-pog'ona (+7 kun), xato → 0 (+1 kun)
      if (correct) {
        progress.srsStep = Math.max(progress.srsStep ?? 0, 2);
      } else {
        progress.srsStep = 0;
        progress.growthCleared = false;
      }
      progress.nextReviewAt = srsNextReview(progress.srsStep, now);
      progress.status = correct ? VocabStatus.mastered : VocabStatus.learning;
      updatedProgress.push(progress);

      pair.attempts += 1;
      if (!correct) pair.wrongAttempts += 1;
      pair.difficulty = pair.attempts > 0 ? pair.wrongAttempts / pair.attempts : 0;
      updatedPairs.push(pair);

      logs.push(this.logRepo.create({ sessionId: null, pairId: card.pairId, mode: card.mode ?? 'typing', correct }));
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
    // Mustahkam so'zlar o'zgardi → «Lug'at» foizi va dars balli
    await this.lessonScore.refresh(test.userId, test.lessonId);

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
      part: test.part ?? 1,
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
      deadlineAt: null,
      /** shu sinovda mustahkam bo'lgan so'zlar (= to'g'ri javoblar) */
      mastered: test.correctCount,
      wrongWords,
      finishedAt: test.finishedAt ? new Date(test.finishedAt).toISOString() : null,
    };
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

  /** Qism (1 dan) bo'yicha so'zlar: 1 → 0..34, 2 → 35..69 */
  private slicePart<T>(pairs: T[], part: number): T[] {
    const size = COIN_TEST_RULES.partSize;
    return pairs.slice((part - 1) * size, part * size);
  }

  /** Har so'z coinli sinovda necha marta so'ralgan (tugagan sinovlar bo'yicha) */
  private wordAttemptCounts(finished: VocabularyCoinTest[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const t of finished) for (const c of t.cards) map.set(c.pairId, (map.get(c.pairId) ?? 0) + 1);
    return map;
  }

  /** Darsning juftliklari (inglizcha so'z + tarjima), o'qituvchi tartibida. */
  private async loadLessonPairs(userId: string, lessonId: string): Promise<VocabularyRelation[]> {
    return this.pairRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.vocabulary', 'src')
      .innerJoinAndSelect('r.translation', 'trg')
      .where('src.lessonId = :lessonId', { lessonId })
      .andWhere('src.lang = :lang', { lang: 'en' })
      // almashtirilgan darsda o'quvchi o'z (mixlangan) lug'at to'plamida sinaladi
      .andWhere('vocab_visible(:vsUser, src.lesson_id, src.set_no)', { vsUser: userId })
      .orderBy('src.orderIndex', 'ASC')
      .getMany();
  }
}

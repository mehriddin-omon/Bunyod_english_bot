import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizContent } from 'src/common/core/entitys/quiz-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { Exercise } from 'src/common/core/entitys/exercise.entity';
import { ExerciseItem, ExerciseOption } from 'src/common/core/entitys/exercise-item.entity';
import { StudentAnswer } from 'src/common/core/entitys/student-answer.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import {
  LessonProgressStatus,
  QuizExerciseType,
  StudentAnswerBlockType,
} from 'src/common/utils/enum';

export interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

export interface ItemResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/** Javoblarni solishtirish uchun normalizatsiya */
const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[.?!]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[’ʼ]/g, "'");
const eq = (a?: string | null, b?: string | null) => norm(a ?? '') === norm(b ?? '');

const SCORE_FIELD: Record<StudentAnswerBlockType, 'quizScore' | 'readingScore' | 'listeningScore' | 'grammarScore'> = {
  [StudentAnswerBlockType.quiz]: 'quizScore',
  [StudentAnswerBlockType.reading]: 'readingScore',
  [StudentAnswerBlockType.listening]: 'listeningScore',
  [StudentAnswerBlockType.grammar]: 'grammarScore',
};

/**
 * Barcha blok turlari uchun yagona javob qabul qilish va baholash servisi.
 * Mashqlar `exercises`/`exercise_items` dan o'qiladi (owner_block_type/owner_block_id
 * orqali), javoblar student_answers ga yoziladi, foiz lesson_progress dagi
 * tegishli *_score ustuniga saqlanadi. Qarang: quiz.md 5.3.
 */
@Injectable()
export class StudentAnswersService {
  constructor(
    @InjectRepository(QuizContent)
    private readonly quizRepo: Repository<QuizContent>,

    @InjectRepository(ReadingContent)
    private readonly readingRepo: Repository<ReadingContent>,

    @InjectRepository(ListeningContent)
    private readonly listeningRepo: Repository<ListeningContent>,

    @InjectRepository(GrammarContent)
    private readonly grammarRepo: Repository<GrammarContent>,

    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,

    @InjectRepository(StudentAnswer)
    private readonly answerRepo: Repository<StudentAnswer>,

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,
  ) {}

  // ── umumiy yordamchilar ────────────────────────────────────────────

  private async resolveOwner(lessonId: string, blockId: string): Promise<StudentAnswerBlockType> {
    if (await this.quizRepo.findOne({ where: { id: blockId, lessonId } })) return StudentAnswerBlockType.quiz;
    if (await this.readingRepo.findOne({ where: { id: blockId, lessonId } })) return StudentAnswerBlockType.reading;
    if (await this.listeningRepo.findOne({ where: { id: blockId, lessonId } })) return StudentAnswerBlockType.listening;
    if (await this.grammarRepo.findOne({ where: { id: blockId, lessonId } })) return StudentAnswerBlockType.grammar;
    throw new NotFoundException('Blok topilmadi');
  }

  private async saveAnswers(
    userId: string,
    lessonId: string,
    blockType: StudentAnswerBlockType,
    blockId: string,
    entries: { questionId: string; givenAnswer: string; isCorrect: boolean }[],
  ) {
    if (!entries.length) return;
    await this.answerRepo.upsert(
      entries.map((e) => ({
        userId,
        lessonId,
        blockType,
        blockId,
        questionId: e.questionId,
        givenAnswer: e.givenAnswer,
        isCorrect: e.isCorrect,
        answeredAt: new Date(),
      })),
      ['userId', 'blockType', 'questionId'],
    );
  }

  private async updateProgressScore(
    userId: string,
    lessonId: string,
    field: 'quizScore' | 'readingScore' | 'listeningScore' | 'grammarScore',
    percent: number,
  ) {
    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        lessonId,
        status: LessonProgressStatus.in_progress,
      });
    } else if (progress.status === LessonProgressStatus.not_started) {
      progress.status = LessonProgressStatus.in_progress;
    }
    progress[field] = percent;

    // Umumiy `score`ni topshirilgan bloklar ballari o'rtachasidan yangilaymiz.
    // Shu tufayli talaba darsni "yakunlash"ni bosmasa ham, teacher paneli va
    // shaxsiy statistikadagi o'rtacha ball haqiqiy ishlangan mashqlarni aks
    // ettiradi (avval faqat dars yakunlanganda to'ldirilar edi → 0% ko'rinardi).
    const blockScores = [
      progress.quizScore,
      progress.readingScore,
      progress.listeningScore,
      progress.grammarScore,
    ].filter((s): s is number => s != null);
    if (blockScores.length) {
      progress.score = Math.round(blockScores.reduce((a, b) => a + b, 0) / blockScores.length);
    }

    await this.progressRepo.save(progress);

    // Faollik tamg'asini yangilaymiz — aks holda mashq ishlagan talaba teacher
    // monitoringida "Hali faol bo'lmagan" bo'lib qolardi (lastActivityDate null).
    await this.touchActivity(userId);
  }

  /** Talabaning oxirgi faollik sanasini bugungi kunga o'rnatadi (yozuv bo'lmasa yaratadi). */
  private async touchActivity(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    let gamification = await this.gamificationRepo.findOne({ where: { userId } });
    if (!gamification) {
      gamification = this.gamificationRepo.create({ userId });
    }
    gamification.lastActivityDate = today;
    await this.gamificationRepo.save(gamification);
  }

  private toMap(answers: SubmittedAnswer[]): Map<string, string> {
    const map = new Map<string, string>();
    (answers ?? []).forEach((a) => {
      if (a?.questionId) map.set(a.questionId, a.answer ?? '');
    });
    return map;
  }

  private buildResult(blockId: string, results: ItemResult[], correct: number, total: number) {
    return {
      blockId,
      total,
      correct,
      percent: total ? Math.round((correct / total) * 100) : 0,
      results,
    };
  }

  /** Bitta itemni exercise turiga qarab baholaydi. */
  private gradeItem(exerciseType: QuizExerciseType, item: ExerciseItem, ans: string | undefined): boolean {
    if (ans === undefined || norm(ans) === '') return false;
    if (exerciseType === QuizExerciseType.true_false) {
      return eq(ans, item.correctAnswer);
    }
    if (exerciseType === QuizExerciseType.matching) {
      // Moslashtirish: talaba javobi JSON shaklida yuboriladi
      // ({ chapSoz: tanlangan o'ngSoz, ... }). To'g'rilik isCorrect'ga emas,
      // har bir variantning matchKey'iga qarab aniqlanadi — matching
      // variantlarida isCorrect umuman saqlanmaydi (ma'nosiz maydon edi).
      const options: ExerciseOption[] = item.options ?? [];
      if (!options.length) return false;
      let submitted: Record<string, string>;
      try {
        const parsed = JSON.parse(ans);
        submitted = parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return false;
      }
      return options.every((o) => {
        if (typeof o === 'string') return false;
        if (o.matchKey == null) return true;
        return eq(submitted[o.text ?? ''], o.matchKey);
      });
    }
    if (exerciseType === QuizExerciseType.multiple_choice) {
      const options: ExerciseOption[] = item.options ?? [];
      const matchesOption = options.some((o) => {
        if (typeof o === 'string') return eq(ans, o);
        const textMatch = !!o.isCorrect && eq(ans, o.text);
        const keyMatch = !!o.isCorrect && o.matchKey != null && eq(ans, o.matchKey);
        return textMatch || keyMatch;
      });
      return matchesOption || eq(ans, item.correctAnswer);
    }
    // fill_in_blank, word_bank, translation, boshqalar — correct_answer bilan taqqoslash
    return eq(ans, item.correctAnswer);
  }

  /**
   * Universal submit: istalgan blok turi (quiz/reading/listening/grammar) uchun.
   * POST /lessons/:lessonId/blocks/:blockId/submit
   */
  async submitBlock(lessonId: string, blockId: string, userId: string, answers: SubmittedAnswer[]) {
    const blockType = await this.resolveOwner(lessonId, blockId);
    const exercises = await this.exerciseRepo.find({
      where: { ownerBlockType: blockType, ownerBlockId: blockId },
      relations: ['items'],
      order: { orderIndex: 'ASC' },
    });

    const given = this.toMap(answers);
    const results: ItemResult[] = [];
    const rows: { questionId: string; givenAnswer: string; isCorrect: boolean }[] = [];
    let correct = 0;
    let total = 0;

    for (const ex of exercises) {
      // Translation mashqlari ballga kirmaydi (javob baribir saqlanadi)
      const scored = ex.exerciseType !== QuizExerciseType.translation;
      for (const item of ex.items ?? []) {
        const ans = given.get(item.id);
        const isCorrect = this.gradeItem(ex.exerciseType, item, ans);
        if (scored) {
          total++;
          if (isCorrect) correct++;
        }
        results.push({ questionId: item.id, isCorrect, correctAnswer: item.correctAnswer });
        if (ans !== undefined) rows.push({ questionId: item.id, givenAnswer: ans, isCorrect });
      }
    }

    await this.saveAnswers(userId, lessonId, blockType, blockId, rows);
    const out = this.buildResult(blockId, results, correct, total);
    if (total > 0) await this.updateProgressScore(userId, lessonId, SCORE_FIELD[blockType], out.percent);
    return { blockType, ...out };
  }

  // ── ESKI endpointlar (backward compat) — submitBlock ga delegatsiya ────

  async submitQuiz(lessonId: string, quizId: string, userId: string, answers: SubmittedAnswer[]) {
    const out = await this.submitBlock(lessonId, quizId, userId, answers);
    return { quizId, ...out };
  }

  async submitReading(lessonId: string, blockId: string, userId: string, answers: SubmittedAnswer[]) {
    return this.submitBlock(lessonId, blockId, userId, answers);
  }

  async submitListening(lessonId: string, blockId: string, userId: string, answers: SubmittedAnswer[]) {
    return this.submitBlock(lessonId, blockId, userId, answers);
  }
}

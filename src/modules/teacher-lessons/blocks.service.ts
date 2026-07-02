import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ReadingQuestion } from 'src/common/core/entitys/reading-question.entity';
import { ReadingOption } from 'src/common/core/entitys/reading-option.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { ListeningTranscript } from 'src/common/core/entitys/listening-transcript.entity';
import { ListeningQuestion } from 'src/common/core/entitys/listening-question.entity';
import { ListeningOption } from 'src/common/core/entitys/listening-option.entity';
import { QuizContent } from 'src/common/core/entitys/quiz-content.entity';
import { QuizExercise } from 'src/common/core/entitys/quiz-exercise.entity';
import { QuizItem } from 'src/common/core/entitys/quiz-item.entity';
import { TeacherLessonsService } from './teacher-lessons.service';
import { QuestionType } from 'src/common/utils/enum';

// "mcq" (frontend) → "multiple_choice" (backend enum)
function toQuestionType(type: string): QuestionType {
  if (type === 'mcq') return QuestionType.multiple_choice;
  return (type as QuestionType) ?? QuestionType.multiple_choice;
}

function fromQuestionType(type: QuestionType): string {
  if (type === QuestionType.multiple_choice) return 'mcq';
  return type;
}

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(GrammarContent)
    private readonly grammarRepo: Repository<GrammarContent>,

    @InjectRepository(ReadingContent)
    private readonly readingRepo: Repository<ReadingContent>,

    @InjectRepository(ReadingQuestion)
    private readonly readingQRepo: Repository<ReadingQuestion>,

    @InjectRepository(ReadingOption)
    private readonly readingOptRepo: Repository<ReadingOption>,

    @InjectRepository(ListeningContent)
    private readonly listeningRepo: Repository<ListeningContent>,

    @InjectRepository(ListeningTranscript)
    private readonly listeningTranscriptRepo: Repository<ListeningTranscript>,

    @InjectRepository(ListeningQuestion)
    private readonly listeningQRepo: Repository<ListeningQuestion>,

    @InjectRepository(ListeningOption)
    private readonly listeningOptRepo: Repository<ListeningOption>,

    @InjectRepository(QuizContent)
    private readonly quizRepo: Repository<QuizContent>,

    @InjectRepository(QuizExercise)
    private readonly quizExerciseRepo: Repository<QuizExercise>,

    @InjectRepository(QuizItem)
    private readonly quizItemRepo: Repository<QuizItem>,

    private readonly lessonsSvc: TeacherLessonsService,
  ) {}

  // ─── Block CRUD ───────────────────────────────────────────────

  async getBlocks(lessonId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const [grammar, reading, listening, quiz] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } }),
      this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.listeningRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.quizRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' }, relations: ['exercises', 'exercises.items'] }),
    ]);
    return [
      ...grammar.map((g) => ({ id: g.id, type: 'grammar', grammarPage: g.pageName })),
      ...reading.map((r) => ({
        id: r.id,
        type: 'reading',
        order: r.orderIndex,
        reading: { title: r.title, content: r.textContent, wordCount: r.wordCount },
      })),
      ...listening.map((l) => ({
        id: l.id,
        type: 'listening',
        order: l.orderIndex,
        listening: {
          title: l.title,
          audioUrl: l.fileId || null,
          imageUrl: l.imageUrl,
          duration: l.durationSeconds,
          trackCode: l.trackCode,
          speakers: l.speakers,
        },
      })),
      ...quiz.map((q) => ({
        id: q.id,
        type: 'quiz',
        order: q.orderIndex,
        quiz: {
          title: q.title,
          exerciseCount: q.exercises?.length ?? 0,
          itemCount: q.exercises?.reduce((sum, e) => sum + (e.items?.length ?? 0), 0) ?? 0,
        },
      })),
    ];
  }

  async addBlock(lessonId: string, dto: { type: string; grammarPage?: string; title?: string; textContent?: string; fileId?: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);

    if (dto.type === 'grammar') {
      const g = await this.grammarRepo.save(
        this.grammarRepo.create({ lessonId, pageName: dto.grammarPage ?? '' }),
      );
      return { id: g.id, type: 'grammar', grammarPage: g.pageName };
    }

    if (dto.type === 'reading') {
      const count = await this.readingRepo.count({ where: { lessonId } });
      const r = await this.readingRepo.save(
        this.readingRepo.create({ lessonId, title: dto.title ?? '', textContent: dto.textContent ?? '', orderIndex: count }),
      );
      return { id: r.id, type: 'reading', title: r.title, orderIndex: r.orderIndex };
    }

    if (dto.type === 'listening') {
      const count = await this.listeningRepo.count({ where: { lessonId } });
      const l = await this.listeningRepo.save(
        this.listeningRepo.create({ lessonId, title: dto.title ?? '', fileId: dto.fileId ?? '', orderIndex: count }),
      );
      return { id: l.id, type: 'listening', title: l.title, fileId: l.fileId, orderIndex: l.orderIndex };
    }

    if (dto.type === 'quiz') {
      const count = await this.quizRepo.count({ where: { lessonId } });
      const q = await this.quizRepo.save(
        this.quizRepo.create({ lessonId, title: 'Quiz', orderIndex: count }),
      );
      return { id: q.id, type: 'quiz', order: q.orderIndex, quiz: { title: q.title, exerciseCount: 0, itemCount: 0 } };
    }

    throw new NotFoundException("Noto'g'ri blok turi");
  }

  async deleteBlock(lessonId: string, blockId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);

    const grammar = await this.grammarRepo.findOne({ where: { id: blockId, lessonId } });
    if (grammar) { await this.grammarRepo.remove(grammar); return { message: "O'chirildi" }; }

    const reading = await this.readingRepo.findOne({ where: { id: blockId, lessonId } });
    if (reading) { await this.readingRepo.remove(reading); return { message: "O'chirildi" }; }

    const listening = await this.listeningRepo.findOne({ where: { id: blockId, lessonId } });
    if (listening) { await this.listeningRepo.remove(listening); return { message: "O'chirildi" }; }

    const quiz = await this.quizRepo.findOne({ where: { id: blockId, lessonId } });
    if (quiz) { await this.quizRepo.remove(quiz); return { message: "O'chirildi" }; }

    throw new NotFoundException('Blok topilmadi');
  }

  async reorderBlocks(lessonId: string, blockIds: string[]) {
    await this.lessonsSvc.verifyLesson(lessonId);
    await Promise.all(
      blockIds.map(async (id, idx) => {
        await this.readingRepo.update({ id, lessonId }, { orderIndex: idx }).catch(() => {});
        await this.listeningRepo.update({ id, lessonId }, { orderIndex: idx }).catch(() => {});
        await this.quizRepo.update({ id, lessonId }, { orderIndex: idx }).catch(() => {});
      }),
    );
    return { message: 'Tartib saqlandi' };
  }

  // ─── Grammar ──────────────────────────────────────────────────

  async updateGrammarPage(lessonId: string, blockId: string, pageName: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const g = await this.grammarRepo.findOne({ where: { id: blockId, lessonId } });
    if (!g) throw new NotFoundException('Grammar blok topilmadi');
    g.pageName = pageName;
    const saved = await this.grammarRepo.save(g);
    return { id: saved.id, type: 'grammar', grammarPage: saved.pageName };
  }

  // ─── Reading ──────────────────────────────────────────────────

  async getReading(lessonId: string, blockId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: blockId, lessonId }, relations: ['questions', 'questions.options'] });
    if (!content) return { blockId, title: null, content: null, wordCount: null, questions: [] };
    return {
      id: content.id,
      title: content.title,
      content: content.textContent,
      wordCount: content.wordCount,
      readTimeMinutes: content.readingTimeMinutes,
      questions: (content.questions ?? []).map((q) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        correctExplanation: q.correctExplanation,
        orderIndex: q.orderIndex,
        options: (q.options ?? []).map((o) => ({ id: o.id, optionText: o.optionText, isCorrect: o.isCorrect })),
      })),
    };
  }

  async saveReading(lessonId: string, blockId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) throw new NotFoundException('Reading blok topilmadi');
    if (dto.title !== undefined) content.title = dto.title;
    if (dto.text !== undefined) {
      content.textContent = dto.text;
      content.wordCount = dto.text ? dto.text.split(/\s+/).filter(Boolean).length : null;
    }
    if (dto.readTimeMinutes !== undefined) content.readingTimeMinutes = dto.readTimeMinutes;
    const saved = await this.readingRepo.save(content);
    return { id: saved.id, title: saved.title, content: saved.textContent, wordCount: saved.wordCount };
  }

  async addReadingQuestion(lessonId: string, blockId: string, dto: { questionText: string; questionType: QuestionType; correctExplanation?: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) throw new NotFoundException('Reading blok topilmadi');
    const count = await this.readingQRepo.count({ where: { readingId: content.id } });
    const q = await this.readingQRepo.save(this.readingQRepo.create({ readingId: content.id, ...dto, orderIndex: count }));
    return { id: q.id, questionText: q.questionText, questionType: q.questionType, correctExplanation: q.correctExplanation, orderIndex: q.orderIndex };
  }

  async updateReadingQuestion(lessonId: string, _blockId: string, qId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.readingQRepo.findOne({ where: { id: qId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    Object.assign(q, dto);
    return this.readingQRepo.save(q);
  }

  async deleteReadingQuestion(lessonId: string, _blockId: string, qId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.readingQRepo.findOne({ where: { id: qId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    await this.readingQRepo.remove(q);
    return { message: "O'chirildi" };
  }

  async addReadingOption(qId: string, dto: { optionText: string; isCorrect: boolean }) {
    const q = await this.readingQRepo.findOne({ where: { id: qId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    const count = await this.readingOptRepo.count({ where: { questionId: qId } });
    return this.readingOptRepo.save(this.readingOptRepo.create({ questionId: qId, ...dto, orderIndex: count }));
  }

  // ─── Listening ────────────────────────────────────────────────

  async getListening(lessonId: string, blockId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({
      where: { id: blockId, lessonId },
      relations: ['questions', 'questions.options', 'transcripts'],
    });
    if (!content) return { blockId, title: null, audioUrl: null, duration: null, questions: [], transcript: [] };
    return {
      id: content.id,
      title: content.title,
      audioUrl: content.fileId || null,
      imageUrl: content.imageUrl,
      duration: content.durationSeconds,
      trackCode: content.trackCode,
      speakers: content.speakers,
      orderIndex: content.orderIndex,
      transcript: (content.transcripts ?? [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((t) => ({ speaker: t.speakerName, timeStart: t.timestampSec, text: t.textContent })),
      questions: (content.questions ?? [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => {
          const opts = (q.options ?? []).sort((a, b) => a.orderIndex - b.orderIndex);
          return {
            id: q.id,
            type: fromQuestionType(q.questionType),
            question: q.questionText,
            imageUrl: q.imageUrl,
            matchTargets: q.matchTargets,
            explanation: q.correctExplanation,
            orderIndex: q.orderIndex,
            options: opts.map((o) => ({
              id: o.id,
              text: o.optionText,
              imageUrl: o.imageUrl,
              matchKey: o.matchKey,
              isCorrect: o.isCorrect,
            })),
          };
        }),
    };
  }

  async saveListening(lessonId: string, blockId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) throw new NotFoundException('Listening blok topilmadi');

    if (dto.title !== undefined) content.title = dto.title;
    // accept both audioUrl (frontend) and fileId (backend)
    if (dto.audioUrl !== undefined) content.fileId = dto.audioUrl ?? '';
    if (dto.fileId !== undefined) content.fileId = dto.fileId;
    // accept both duration (frontend) and durationSeconds (backend)
    if (dto.duration !== undefined) content.durationSeconds = dto.duration;
    if (dto.durationSeconds !== undefined) content.durationSeconds = dto.durationSeconds;
    if (dto.trackCode !== undefined) content.trackCode = dto.trackCode;
    if (dto.speakers !== undefined) content.speakers = dto.speakers;
    if (dto.imageUrl !== undefined) content.imageUrl = dto.imageUrl ?? null;

    if (dto.transcript !== undefined) {
      await this.listeningTranscriptRepo.delete({ listeningId: content.id });
      if (Array.isArray(dto.transcript) && dto.transcript.length > 0) {
        await this.listeningTranscriptRepo.save(
          dto.transcript.map((t: any, idx: number) =>
            this.listeningTranscriptRepo.create({
              listeningId: content.id,
              speakerName: t.speaker ?? null,
              timestampSec: t.timeStart ?? null,
              textContent: t.text ?? '',
              orderIndex: idx,
            }),
          ),
        );
      }
    }

    const saved = await this.listeningRepo.save(content);
    return {
      id: saved.id,
      title: saved.title,
      audioUrl: saved.fileId || null,
      duration: saved.durationSeconds,
      trackCode: saved.trackCode,
      speakers: saved.speakers,
    };
  }

  async addListeningQuestion(lessonId: string, blockId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) throw new NotFoundException('Listening blok topilmadi');
    const count = await this.listeningQRepo.count({ where: { listeningId: content.id } });

    const questionText = dto.question ?? dto.questionText ?? '';
    const questionType = toQuestionType(dto.type ?? dto.questionType ?? 'mcq');
    const correctExplanation = dto.explanation ?? dto.correctExplanation ?? null;
    const questionImageUrl = dto.imageUrl ?? null;
    const matchTargets = dto.matchTargets ?? null;

    const q = await this.listeningQRepo.save(
      this.listeningQRepo.create({ listeningId: content.id, questionText, questionType, correctExplanation, imageUrl: questionImageUrl, matchTargets, orderIndex: count }),
    );

    const rawOptions: any[] = dto.options ?? [];
    const correctAnswer = String(dto.correctAnswer ?? '');
    if (rawOptions.length > 0) {
      const byIndex = correctAnswer !== '' && !isNaN(Number(correctAnswer));
      await this.listeningOptRepo.save(
        rawOptions.map((opt, idx) => {
          const optText = typeof opt === 'string' ? opt : (opt.text ?? opt.optionText ?? '');
          const optImageUrl = typeof opt === 'object' ? (opt.imageUrl ?? null) : null;
          const optMatchKey = typeof opt === 'object' ? (opt.matchKey ?? null) : null;
          const isCorrectOverride = typeof opt === 'object' && opt.isCorrect !== undefined ? opt.isCorrect : undefined;
          const isCorrect = isCorrectOverride !== undefined ? isCorrectOverride : byIndex ? idx === Number(correctAnswer) : optText === correctAnswer;
          return this.listeningOptRepo.create({ questionId: q.id, optionText: optText, imageUrl: optImageUrl, matchKey: optMatchKey, isCorrect, orderIndex: idx });
        }),
      );
    }

    const qFull = await this.listeningQRepo.findOne({ where: { id: q.id }, relations: ['options'] });
    const opts = (qFull?.options ?? []).sort((a, b) => a.orderIndex - b.orderIndex);
    return {
      id: q.id,
      type: fromQuestionType(q.questionType),
      question: q.questionText,
      imageUrl: q.imageUrl,
      matchTargets: q.matchTargets,
      explanation: q.correctExplanation,
      orderIndex: q.orderIndex,
      options: opts.map((o) => ({ id: o.id, text: o.optionText, imageUrl: o.imageUrl, matchKey: o.matchKey, isCorrect: o.isCorrect })),
    };
  }

  async updateListeningQuestion(lessonId: string, _blockId: string, qId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.listeningQRepo.findOne({ where: { id: qId }, relations: ['options'] });
    if (!q) throw new NotFoundException('Savol topilmadi');

    if (dto.question !== undefined) q.questionText = dto.question;
    if (dto.questionText !== undefined) q.questionText = dto.questionText;
    if (dto.type !== undefined) q.questionType = toQuestionType(dto.type);
    if (dto.questionType !== undefined) q.questionType = toQuestionType(dto.questionType);
    if (dto.explanation !== undefined) q.correctExplanation = dto.explanation;
    if (dto.correctExplanation !== undefined) q.correctExplanation = dto.correctExplanation;
    if (dto.imageUrl !== undefined) q.imageUrl = dto.imageUrl ?? null;
    if (dto.matchTargets !== undefined) q.matchTargets = dto.matchTargets ?? null;

    await this.listeningQRepo.save(q);

    if (dto.options !== undefined || dto.correctAnswer !== undefined) {
      const rawOptions: any[] = dto.options ?? (q.options ?? []).map((o) => o.optionText);
      const correctAnswer = String(dto.correctAnswer ?? (q.options ?? []).find((o) => o.isCorrect)?.optionText ?? '');
      const byIndex = correctAnswer !== '' && !isNaN(Number(correctAnswer));
      await this.listeningOptRepo.delete({ questionId: q.id });
      await this.listeningOptRepo.save(
        rawOptions.map((opt, idx) => {
          const optText = typeof opt === 'string' ? opt : (opt.text ?? opt.optionText ?? '');
          const optImageUrl = typeof opt === 'object' ? (opt.imageUrl ?? null) : null;
          const optMatchKey = typeof opt === 'object' ? (opt.matchKey ?? null) : null;
          const isCorrectOverride = typeof opt === 'object' && opt.isCorrect !== undefined ? opt.isCorrect : undefined;
          const isCorrect = isCorrectOverride !== undefined ? isCorrectOverride : byIndex ? idx === Number(correctAnswer) : optText === correctAnswer;
          return this.listeningOptRepo.create({ questionId: q.id, optionText: optText, imageUrl: optImageUrl, matchKey: optMatchKey, isCorrect, orderIndex: idx });
        }),
      );
    }

    const updated = await this.listeningQRepo.findOne({ where: { id: q.id }, relations: ['options'] });
    const opts = (updated?.options ?? []).sort((a, b) => a.orderIndex - b.orderIndex);
    return {
      id: q.id,
      type: fromQuestionType(q.questionType),
      question: q.questionText,
      imageUrl: q.imageUrl,
      matchTargets: q.matchTargets,
      explanation: q.correctExplanation,
      orderIndex: q.orderIndex,
      options: opts.map((o) => ({ id: o.id, text: o.optionText, imageUrl: o.imageUrl, matchKey: o.matchKey, isCorrect: o.isCorrect })),
    };
  }

  async deleteListeningQuestion(lessonId: string, _blockId: string, qId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.listeningQRepo.findOne({ where: { id: qId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    await this.listeningQRepo.remove(q);
    return { message: "O'chirildi" };
  }

  async addListeningOption(qId: string, dto: { optionText: string; isCorrect: boolean; imageUrl?: string; matchKey?: string }) {
    const q = await this.listeningQRepo.findOne({ where: { id: qId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    const count = await this.listeningOptRepo.count({ where: { questionId: qId } });
    const opt = await this.listeningOptRepo.save(
      this.listeningOptRepo.create({ questionId: qId, optionText: dto.optionText, isCorrect: dto.isCorrect, imageUrl: dto.imageUrl ?? null, matchKey: dto.matchKey ?? null, orderIndex: count }),
    );
    return { id: opt.id, text: opt.optionText, imageUrl: opt.imageUrl, matchKey: opt.matchKey, isCorrect: opt.isCorrect, orderIndex: opt.orderIndex };
  }

  // ─── Quiz ─────────────────────────────────────────────────────

  private mapExercise(e: QuizExercise) {
    return {
      id: e.id,
      title: e.title,
      instructions: e.instructions,
      exerciseType: e.exerciseType,
      orderIndex: e.orderIndex,
      items: (e.items ?? [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((i) => ({
          id: i.id,
          itemText: i.itemText,
          correctAnswer: i.correctAnswer,
          options: i.options ? JSON.parse(i.options) : null,
          orderIndex: i.orderIndex,
        })),
    };
  }

  async getQuiz(lessonId: string, blockId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const quiz = await this.quizRepo.findOne({
      where: { id: blockId, lessonId },
      relations: ['exercises', 'exercises.items'],
    });
    if (!quiz) throw new NotFoundException('Quiz blok topilmadi');
    return {
      id: quiz.id,
      title: quiz.title,
      exercises: (quiz.exercises ?? [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((e) => this.mapExercise(e)),
    };
  }

  async saveQuiz(lessonId: string, blockId: string, dto: { title?: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const quiz = await this.quizRepo.findOne({ where: { id: blockId, lessonId } });
    if (!quiz) throw new NotFoundException('Quiz blok topilmadi');
    if (dto.title !== undefined) quiz.title = dto.title;
    const saved = await this.quizRepo.save(quiz);
    return { id: saved.id, title: saved.title };
  }

  async addExercise(lessonId: string, blockId: string, dto: { title?: string; instructions?: string; exerciseType: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const quiz = await this.quizRepo.findOne({ where: { id: blockId, lessonId } });
    if (!quiz) throw new NotFoundException('Quiz blok topilmadi');
    const count = await this.quizExerciseRepo.count({ where: { quizId: quiz.id } });
    const ex = await this.quizExerciseRepo.save(
      this.quizExerciseRepo.create({
        quizId: quiz.id,
        title: dto.title ?? null,
        instructions: dto.instructions ?? null,
        exerciseType: dto.exerciseType,
        orderIndex: count,
      }),
    );
    return this.mapExercise({ ...ex, items: [] });
  }

  async updateExercise(lessonId: string, _blockId: string, exerciseId: string, dto: { title?: string; instructions?: string; exerciseType?: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const ex = await this.quizExerciseRepo.findOne({ where: { id: exerciseId }, relations: ['items'] });
    if (!ex) throw new NotFoundException('Mashq topilmadi');
    if (dto.title !== undefined) ex.title = dto.title;
    if (dto.instructions !== undefined) ex.instructions = dto.instructions;
    if (dto.exerciseType !== undefined) ex.exerciseType = dto.exerciseType;
    await this.quizExerciseRepo.save(ex);
    return this.mapExercise(ex);
  }

  async deleteExercise(lessonId: string, _blockId: string, exerciseId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const ex = await this.quizExerciseRepo.findOne({ where: { id: exerciseId } });
    if (!ex) throw new NotFoundException('Mashq topilmadi');
    await this.quizExerciseRepo.remove(ex);
    return { message: "O'chirildi" };
  }

  async reorderExercises(lessonId: string, blockId: string, exerciseIds: string[]) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const quiz = await this.quizRepo.findOne({ where: { id: blockId, lessonId } });
    if (!quiz) throw new NotFoundException('Quiz blok topilmadi');
    await Promise.all(
      exerciseIds.map((id, idx) =>
        this.quizExerciseRepo.update({ id, quizId: quiz.id }, { orderIndex: idx }).catch(() => {}),
      ),
    );
    return { message: 'Tartib saqlandi' };
  }

  async addItem(lessonId: string, _blockId: string, exerciseId: string, dto: { itemText: string; correctAnswer: string; options?: string[] }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const ex = await this.quizExerciseRepo.findOne({ where: { id: exerciseId } });
    if (!ex) throw new NotFoundException('Mashq topilmadi');
    const count = await this.quizItemRepo.count({ where: { exerciseId } });
    const item = await this.quizItemRepo.save(
      this.quizItemRepo.create({
        exerciseId,
        itemText: dto.itemText,
        correctAnswer: dto.correctAnswer,
        options: dto.options ? JSON.stringify(dto.options) : null,
        orderIndex: count,
      }),
    );
    return {
      id: item.id,
      itemText: item.itemText,
      correctAnswer: item.correctAnswer,
      options: item.options ? JSON.parse(item.options) : null,
      orderIndex: item.orderIndex,
    };
  }

  async updateItem(lessonId: string, _blockId: string, _exerciseId: string, itemId: string, dto: { itemText?: string; correctAnswer?: string; options?: string[] | null }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const item = await this.quizItemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Element topilmadi');
    if (dto.itemText !== undefined) item.itemText = dto.itemText;
    if (dto.correctAnswer !== undefined) item.correctAnswer = dto.correctAnswer;
    if (dto.options !== undefined) item.options = dto.options ? JSON.stringify(dto.options) : null;
    await this.quizItemRepo.save(item);
    return {
      id: item.id,
      itemText: item.itemText,
      correctAnswer: item.correctAnswer,
      options: item.options ? JSON.parse(item.options) : null,
      orderIndex: item.orderIndex,
    };
  }

  async deleteItem(lessonId: string, _blockId: string, _exerciseId: string, itemId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const item = await this.quizItemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Element topilmadi');
    await this.quizItemRepo.remove(item);
    return { message: "O'chirildi" };
  }

  async reorderItems(lessonId: string, _blockId: string, exerciseId: string, itemIds: string[]) {
    await this.lessonsSvc.verifyLesson(lessonId);
    await Promise.all(
      itemIds.map((id, idx) =>
        this.quizItemRepo.update({ id, exerciseId }, { orderIndex: idx }).catch(() => {}),
      ),
    );
    return { message: 'Tartib saqlandi' };
  }

}

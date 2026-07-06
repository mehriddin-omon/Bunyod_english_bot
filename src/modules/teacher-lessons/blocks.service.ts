import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { ListeningTranscript } from 'src/common/core/entitys/listening-transcript.entity';
import { QuizContent } from 'src/common/core/entitys/quiz-content.entity';
import { Exercise } from 'src/common/core/entitys/exercise.entity';
import { ExerciseItem, ExerciseOption } from 'src/common/core/entitys/exercise-item.entity';
import { TeacherLessonsService } from './teacher-lessons.service';
import { QuestionType, QuizExerciseType, StudentAnswerBlockType } from 'src/common/utils/enum';

// "mcq" (frontend) → "multiple_choice" (backend enum) — eski listening savol payloadi uchun
function toQuestionType(type: string): QuestionType {
  if (type === 'mcq') return QuestionType.multiple_choice;
  return (type as QuestionType) ?? QuestionType.multiple_choice;
}

function fromQuestionType(type: QuestionType | string): string {
  if (type === QuestionType.multiple_choice) return 'mcq';
  return type;
}

interface AddExerciseDto {
  title?: string;
  instructions?: string;
  exerciseType: string;
}
interface UpdateExerciseDto {
  title?: string;
  instructions?: string;
  exerciseType?: string;
}
interface AddItemDto {
  itemText: string;
  correctAnswer: string;
  options?: ExerciseOption[] | null;
  imageUrl?: string | null;
  explanation?: string | null;
}
interface UpdateItemDto {
  itemText?: string;
  correctAnswer?: string;
  options?: ExerciseOption[] | null;
  imageUrl?: string | null;
  explanation?: string | null;
}

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(GrammarContent)
    private readonly grammarRepo: Repository<GrammarContent>,

    @InjectRepository(ReadingContent)
    private readonly readingRepo: Repository<ReadingContent>,

    @InjectRepository(ListeningContent)
    private readonly listeningRepo: Repository<ListeningContent>,

    @InjectRepository(ListeningTranscript)
    private readonly listeningTranscriptRepo: Repository<ListeningTranscript>,

    @InjectRepository(QuizContent)
    private readonly quizRepo: Repository<QuizContent>,

    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,

    @InjectRepository(ExerciseItem)
    private readonly itemRepo: Repository<ExerciseItem>,

    private readonly lessonsSvc: TeacherLessonsService,
  ) {}

  // ─── Owner rezolvatsiyasi (polimorf: blockId → qaysi kontent turi) ────

  private async resolveOwner(blockId: string): Promise<{ type: StudentAnswerBlockType; lessonId: string }> {
    const quiz = await this.quizRepo.findOne({ where: { id: blockId } });
    if (quiz) return { type: StudentAnswerBlockType.quiz, lessonId: quiz.lessonId };

    const reading = await this.readingRepo.findOne({ where: { id: blockId } });
    if (reading) return { type: StudentAnswerBlockType.reading, lessonId: reading.lessonId };

    const listening = await this.listeningRepo.findOne({ where: { id: blockId } });
    if (listening) return { type: StudentAnswerBlockType.listening, lessonId: listening.lessonId };

    const grammar = await this.grammarRepo.findOne({ where: { id: blockId } });
    if (grammar) return { type: StudentAnswerBlockType.grammar, lessonId: grammar.lessonId };

    throw new NotFoundException('Blok topilmadi');
  }

  private async requireOwner(lessonId: string, blockId: string) {
    const owner = await this.resolveOwner(blockId);
    if (owner.lessonId !== lessonId) throw new NotFoundException('Blok topilmadi');
    return owner;
  }

  private mapExercise(e: Exercise) {
    return {
      id: e.id,
      title: e.title,
      instructions: e.instructions,
      exerciseType: e.exerciseType,
      orderIndex: e.orderIndex,
      items: (e.items ?? [])
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((i) => this.mapItem(i)),
    };
  }

  private mapItem(i: ExerciseItem) {
    return {
      id: i.id,
      itemText: i.itemText,
      correctAnswer: i.correctAnswer,
      options: i.options ?? null,
      imageUrl: i.imageUrl,
      explanation: i.explanation,
      orderIndex: i.orderIndex,
    };
  }

  private async exerciseSummary(ownerType: StudentAnswerBlockType, blockId: string) {
    const exercises = await this.exerciseRepo.find({
      where: { ownerBlockType: ownerType, ownerBlockId: blockId },
      relations: ['items'],
    });
    return {
      exerciseCount: exercises.length,
      itemCount: exercises.reduce((sum, e) => sum + (e.items?.length ?? 0), 0),
      exerciseTypes: [...new Set(exercises.map((e) => e.exerciseType))],
    };
  }

  // ─── Block CRUD ───────────────────────────────────────────────

  async getBlocks(lessonId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const [grammar, reading, listening, quiz] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } }),
      this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.listeningRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.quizRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
    ]);

    const [grammarEx, readingEx, listeningEx, quizEx] = await Promise.all([
      Promise.all(grammar.map((g) => this.exerciseSummary(StudentAnswerBlockType.grammar, g.id))),
      Promise.all(reading.map((r) => this.exerciseSummary(StudentAnswerBlockType.reading, r.id))),
      Promise.all(listening.map((l) => this.exerciseSummary(StudentAnswerBlockType.listening, l.id))),
      Promise.all(quiz.map((q) => this.exerciseSummary(StudentAnswerBlockType.quiz, q.id))),
    ]);

    // O'qituvchi belgilagan tartib: orderIndex (grammar doim birinchi), teng bo'lsa createdAt
    const sortMeta = new Map<string, { idx: number; created: number }>();
    grammar.forEach((g) => sortMeta.set(g.id, { idx: -1, created: +new Date(g.createdAt) }));
    reading.forEach((r) => sortMeta.set(r.id, { idx: r.orderIndex ?? 0, created: +new Date(r.createdAt) }));
    listening.forEach((l) => sortMeta.set(l.id, { idx: l.orderIndex ?? 0, created: +new Date(l.createdAt) }));
    quiz.forEach((q) => sortMeta.set(q.id, { idx: q.orderIndex ?? 0, created: +new Date(q.createdAt) }));

    return [
      ...grammar.map((g, i) => ({ id: g.id, type: 'grammar', grammarPage: g.pageName, exercises: grammarEx[i] })),
      ...reading.map((r, i) => ({
        id: r.id,
        type: 'reading',
        order: r.orderIndex,
        reading: { title: r.title, content: r.textContent, wordCount: r.wordCount },
        exercises: readingEx[i],
      })),
      ...listening.map((l, i) => ({
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
        exercises: listeningEx[i],
      })),
      ...quiz.map((q, i) => ({
        id: q.id,
        type: 'quiz',
        order: q.orderIndex,
        quiz: { title: q.title, exerciseCount: quizEx[i].exerciseCount, itemCount: quizEx[i].itemCount },
        exercises: quizEx[i],
      })),
    ].sort((a, b) => {
      const A = sortMeta.get(a.id)!;
      const B = sortMeta.get(b.id)!;
      return A.idx - B.idx || A.created - B.created;
    });
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
      // Bir darsda faqat bitta quiz bloki bo'ladi — mavjud bo'lsa o'shani qaytaramiz
      const existing = await this.quizRepo.findOne({ where: { lessonId } });
      if (existing) {
        const summary = await this.exerciseSummary(StudentAnswerBlockType.quiz, existing.id);
        return {
          id: existing.id,
          type: 'quiz',
          order: existing.orderIndex,
          quiz: { title: existing.title, exerciseCount: summary.exerciseCount, itemCount: summary.itemCount },
        };
      }
      const q = await this.quizRepo.save(
        this.quizRepo.create({ lessonId, title: 'Quiz', orderIndex: 0 }),
      );
      return { id: q.id, type: 'quiz', order: q.orderIndex, quiz: { title: q.title, exerciseCount: 0, itemCount: 0 } };
    }

    throw new NotFoundException("Noto'g'ri blok turi");
  }

  async deleteBlock(lessonId: string, blockId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);

    const grammar = await this.grammarRepo.findOne({ where: { id: blockId, lessonId } });
    if (grammar) {
      await this.exerciseRepo.delete({ ownerBlockType: StudentAnswerBlockType.grammar, ownerBlockId: blockId });
      await this.grammarRepo.remove(grammar);
      return { message: "O'chirildi" };
    }

    const reading = await this.readingRepo.findOne({ where: { id: blockId, lessonId } });
    if (reading) {
      await this.exerciseRepo.delete({ ownerBlockType: StudentAnswerBlockType.reading, ownerBlockId: blockId });
      await this.readingRepo.remove(reading);
      return { message: "O'chirildi" };
    }

    const listening = await this.listeningRepo.findOne({ where: { id: blockId, lessonId } });
    if (listening) {
      await this.exerciseRepo.delete({ ownerBlockType: StudentAnswerBlockType.listening, ownerBlockId: blockId });
      await this.listeningRepo.remove(listening);
      return { message: "O'chirildi" };
    }

    const quiz = await this.quizRepo.findOne({ where: { id: blockId, lessonId } });
    if (quiz) {
      await this.exerciseRepo.delete({ ownerBlockType: StudentAnswerBlockType.quiz, ownerBlockId: blockId });
      await this.quizRepo.remove(quiz);
      return { message: "O'chirildi" };
    }

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
    const content = await this.readingRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) return { blockId, title: null, text: null, content: null, wordCount: null, questions: [], exercises: [] };
    const exercises = await this.getExercises(lessonId, blockId);
    return {
      id: content.id,
      title: content.title,
      author: content.author,
      // Teacher UI `text` kalitini o'qiydi; `content` legacy uchun qoldirildi.
      text: content.textContent,
      content: content.textContent,
      wordCount: content.wordCount,
      readTimeMinutes: content.readingTimeMinutes,
      cefrLevel: content.cefrLevel,
      highlights: content.highlights ?? [],
      // Savollar teacher UI formatida (mcq/true_false, options: string[]).
      questions: exercises.flatMap((e) => e.items.map((i) => this.toUiReadingQuestion(i, e.exerciseType))),
      exercises,
    };
  }

  /** ExerciseItem'ni reading teacher UI kutgan Question shakliga o'giradi. */
  private toUiReadingQuestion(
    i: { id: string; itemText: string; correctAnswer?: string | null; options?: ExerciseOption[] | null; explanation?: string | null; orderIndex: number },
    exerciseType: string,
  ) {
    const opts = (i.options ?? []).map((o) =>
      typeof o === 'string' ? { text: o, isCorrect: false } : { text: o.text, isCorrect: !!o.isCorrect },
    );
    const isMcq = exerciseType !== QuizExerciseType.true_false;
    const correctIdx = opts.findIndex((o) => o.isCorrect);
    return {
      id: i.id,
      type: isMcq ? 'mcq' : 'true_false',
      question: i.itemText,
      options: opts.map((o) => o.text),
      correctAnswer: isMcq ? (correctIdx >= 0 ? String(correctIdx) : '') : (i.correctAnswer ?? ''),
      explanation: i.explanation ?? undefined,
      // Legacy kalitlar
      questionText: i.itemText,
      questionType: exerciseType,
      correctExplanation: i.explanation,
      orderIndex: i.orderIndex,
    };
  }

  /** Teacher UI turi ('mcq'|'true_false') yoki legacy questionType'ni enumga o'giradi. */
  private readingQuestionType(dto: any): string {
    if (dto.questionType) return dto.questionType;
    if (dto.type === 'true_false') return QuizExerciseType.true_false;
    return QuizExerciseType.multiple_choice;
  }

  /** Teacher UI payloadidan (options: string[], correctAnswer: index|true/false) DB shaklini yasaydi. */
  private readingOptionsFromDto(dto: any, qType: string): { options: ExerciseOption[] | null; correctAnswer: string } {
    if (qType === QuizExerciseType.true_false) {
      return { options: null, correctAnswer: dto.correctAnswer === 'true' || dto.correctAnswer === 'false' ? dto.correctAnswer : '' };
    }
    const raw: unknown[] = Array.isArray(dto.options) ? dto.options : [];
    const mapped: { text: string; isCorrect: boolean }[] = raw.map((o, idx) => {
      if (typeof o === 'string') return { text: o, isCorrect: String(idx) === String(dto.correctAnswer ?? '') };
      const oo = o as { text?: string; optionText?: string; isCorrect?: boolean };
      return { text: oo.text ?? oo.optionText ?? '', isCorrect: !!oo.isCorrect };
    });
    const correct = mapped.find((o) => o.isCorrect);
    return { options: mapped.length ? (mapped as ExerciseOption[]) : null, correctAnswer: correct?.text ?? '' };
  }

  async saveReading(lessonId: string, blockId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) throw new NotFoundException('Reading blok topilmadi');
    if (dto.title !== undefined) content.title = dto.title;
    if (dto.author !== undefined) content.author = dto.author;
    if (dto.text !== undefined) {
      content.textContent = dto.text;
      content.wordCount = dto.text ? dto.text.split(/\s+/).filter(Boolean).length : null;
    }
    if (dto.readTimeMinutes !== undefined) content.readingTimeMinutes = dto.readTimeMinutes;
    if (dto.cefrLevel !== undefined) content.cefrLevel = dto.cefrLevel;
    if (dto.highlights !== undefined) content.highlights = dto.highlights;
    const saved = await this.readingRepo.save(content);
    return {
      id: saved.id,
      title: saved.title,
      author: saved.author,
      text: saved.textContent,
      content: saved.textContent,
      wordCount: saved.wordCount,
      readTimeMinutes: saved.readingTimeMinutes,
      cefrLevel: saved.cefrLevel,
      highlights: saved.highlights ?? [],
    };
  }

  /** Berilgan owner+tur uchun mos exercise'ni topadi, bo'lmasa yaratadi (legacy proxy uchun). */
  private async findOrCreateExercise(ownerType: StudentAnswerBlockType, ownerBlockId: string, lessonId: string, exerciseType: string) {
    let ex = await this.exerciseRepo.findOne({
      where: { ownerBlockType: ownerType, ownerBlockId, exerciseType: exerciseType as QuizExerciseType },
    });
    if (!ex) {
      const count = await this.exerciseRepo.count({ where: { ownerBlockType: ownerType, ownerBlockId } });
      ex = await this.exerciseRepo.save(
        this.exerciseRepo.create({
          lessonId,
          ownerBlockType: ownerType,
          ownerBlockId,
          exerciseType: exerciseType as QuizExerciseType,
          title: 'Savollar',
          orderIndex: count,
        }),
      );
    }
    return ex;
  }

  /** Reading savoli qo'shadi. Teacher UI ({type, question, options, correctAnswer}) va legacy ({questionText, questionType}) payloadlarini qabul qiladi. */
  async addReadingQuestion(lessonId: string, blockId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) throw new NotFoundException('Reading blok topilmadi');
    const qType = this.readingQuestionType(dto);
    const ex = await this.findOrCreateExercise(StudentAnswerBlockType.reading, content.id, lessonId, qType);
    const count = await this.itemRepo.count({ where: { exerciseId: ex.id } });
    const { options, correctAnswer } = this.readingOptionsFromDto(dto, qType);
    const item = await this.itemRepo.save(
      this.itemRepo.create({
        exerciseId: ex.id,
        itemText: dto.questionText ?? dto.question ?? '',
        correctAnswer,
        options,
        explanation: dto.correctExplanation ?? dto.explanation ?? null,
        orderIndex: count,
      }),
    );
    return this.toUiReadingQuestion(item, ex.exerciseType);
  }

  private async findItemWithExercise(itemId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) return null;
    const exercise = await this.exerciseRepo.findOne({ where: { id: item.exerciseId } });
    return { item, exercise };
  }

  async updateReadingQuestion(lessonId: string, _blockId: string, qId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const found = await this.findItemWithExercise(qId);
    if (!found?.exercise) throw new NotFoundException('Savol topilmadi');
    const { item } = found;
    let exercise = found.exercise;

    // Savol turi o'zgarsa — mos turdagi exercise'ga ko'chiriladi (guruhlash mantig'i)
    const newType = dto.questionType ?? (dto.type === 'mcq' ? QuizExerciseType.multiple_choice : dto.type === 'true_false' ? QuizExerciseType.true_false : undefined);
    if (newType !== undefined && newType !== exercise.exerciseType) {
      const target = await this.findOrCreateExercise(
        StudentAnswerBlockType.reading,
        exercise.ownerBlockId,
        exercise.lessonId,
        newType,
      );
      item.exerciseId = target.id;
      item.orderIndex = await this.itemRepo.count({ where: { exerciseId: target.id } });
      exercise = target;
    }

    if (dto.questionText !== undefined || dto.question !== undefined) item.itemText = dto.questionText ?? dto.question;
    if (dto.correctExplanation !== undefined || dto.explanation !== undefined) item.explanation = dto.correctExplanation ?? dto.explanation ?? null;
    if (dto.options !== undefined || dto.correctAnswer !== undefined) {
      const { options, correctAnswer } = this.readingOptionsFromDto(
        {
          options: dto.options ?? (item.options ?? []).map((o) => (typeof o === 'string' ? o : o.text)),
          correctAnswer: dto.correctAnswer,
        },
        exercise.exerciseType,
      );
      item.options = options;
      item.correctAnswer = correctAnswer;
    }
    await this.itemRepo.save(item);
    return this.toUiReadingQuestion(item, exercise.exerciseType);
  }

  async deleteReadingQuestion(lessonId: string, _blockId: string, qId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const item = await this.itemRepo.findOne({ where: { id: qId } });
    if (!item) throw new NotFoundException('Savol topilmadi');
    await this.itemRepo.remove(item);
    return { message: "O'chirildi" };
  }

  async addReadingOption(qId: string, dto: { optionText: string; isCorrect: boolean }) {
    const item = await this.itemRepo.findOne({ where: { id: qId } });
    if (!item) throw new NotFoundException('Savol topilmadi');
    const options: ExerciseOption[] = Array.isArray(item.options) ? [...item.options] : [];
    options.push({ text: dto.optionText, isCorrect: dto.isCorrect });
    item.options = options;
    if (dto.isCorrect) item.correctAnswer = dto.optionText;
    await this.itemRepo.save(item);
    return { text: dto.optionText, isCorrect: dto.isCorrect };
  }

  // ─── Listening ────────────────────────────────────────────────

  private matchTargetsMap(instructions: string | null): Record<string, string[]> {
    if (!instructions) return {};
    try {
      const parsed = JSON.parse(instructions);
      return parsed?.matchTargetsByItem ?? {};
    } catch {
      return {};
    }
  }

  private setMatchTargets(exercise: Exercise, itemId: string, matchTargets: string[] | null) {
    const map = this.matchTargetsMap(exercise.instructions);
    if (matchTargets && matchTargets.length) map[itemId] = matchTargets;
    else delete map[itemId];
    exercise.instructions = Object.keys(map).length ? JSON.stringify({ matchTargetsByItem: map }) : null;
  }

  async getListening(lessonId: string, blockId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: blockId, lessonId }, relations: ['transcripts'] });
    if (!content) return { blockId, title: null, audioUrl: null, duration: null, questions: [], transcript: [], exercises: [] };
    const exercises = await this.getExercises(lessonId, blockId);
    const rawExercises = await this.exerciseRepo.find({ where: { ownerBlockType: StudentAnswerBlockType.listening, ownerBlockId: blockId } });
    const instructionsByExId = new Map(rawExercises.map((e) => [e.id, e.instructions]));

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
      questions: exercises.flatMap((e) => {
        const targets = this.matchTargetsMap(instructionsByExId.get(e.id) ?? null);
        return e.items.map((i) => ({
          id: i.id,
          type: fromQuestionType(e.exerciseType),
          question: i.itemText,
          imageUrl: i.imageUrl,
          matchTargets: targets[i.id] ?? null,
          explanation: i.explanation,
          orderIndex: i.orderIndex,
          options: (i.options ?? []).map((o) =>
            typeof o === 'string'
              ? { text: o, imageUrl: null, matchKey: null, isCorrect: false }
              : { text: o.text, imageUrl: o.imageUrl ?? null, matchKey: o.matchKey ?? null, isCorrect: !!o.isCorrect },
          ),
        }));
      }),
      exercises,
    };
  }

  async saveListening(lessonId: string, blockId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: blockId, lessonId } });
    if (!content) throw new NotFoundException('Listening blok topilmadi');

    if (dto.title !== undefined) content.title = dto.title;
    if (dto.audioUrl !== undefined) content.fileId = dto.audioUrl ?? '';
    if (dto.fileId !== undefined) content.fileId = dto.fileId;
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

    const questionType = toQuestionType(dto.type ?? dto.questionType ?? 'mcq');
    const ex = await this.findOrCreateExercise(StudentAnswerBlockType.listening, content.id, lessonId, questionType);

    const questionText = dto.question ?? dto.questionText ?? '';
    const explanation = dto.explanation ?? dto.correctExplanation ?? null;
    const imageUrl = dto.imageUrl ?? null;
    const matchTargets = dto.matchTargets ?? null;

    const rawOptions: any[] = dto.options ?? [];
    const correctAnswerRaw = String(dto.correctAnswer ?? '');
    const byIndex = correctAnswerRaw !== '' && !isNaN(Number(correctAnswerRaw));
    const options: ExerciseOption[] = rawOptions.map((opt, idx) => {
      const optText = typeof opt === 'string' ? opt : (opt.text ?? opt.optionText ?? '');
      const optImageUrl = typeof opt === 'object' ? (opt.imageUrl ?? null) : null;
      const optMatchKey = typeof opt === 'object' ? (opt.matchKey ?? null) : null;
      const isCorrectOverride = typeof opt === 'object' && opt.isCorrect !== undefined ? opt.isCorrect : undefined;
      const isCorrect = isCorrectOverride !== undefined ? isCorrectOverride : byIndex ? idx === Number(correctAnswerRaw) : optText === correctAnswerRaw;
      return { text: optText, isCorrect, imageUrl: optImageUrl, matchKey: optMatchKey };
    });
    const correctOpt = options.find((o) => (o as any).isCorrect) as any;

    const count = await this.itemRepo.count({ where: { exerciseId: ex.id } });
    const item = await this.itemRepo.save(
      this.itemRepo.create({
        exerciseId: ex.id,
        itemText: questionText,
        correctAnswer: correctOpt?.text ?? '',
        options: options.length ? options : null,
        imageUrl,
        explanation,
        orderIndex: count,
      }),
    );

    if (matchTargets) {
      this.setMatchTargets(ex, item.id, matchTargets);
      await this.exerciseRepo.save(ex);
    }

    return {
      id: item.id,
      type: fromQuestionType(ex.exerciseType),
      question: item.itemText,
      imageUrl: item.imageUrl,
      matchTargets,
      explanation: item.explanation,
      orderIndex: item.orderIndex,
      options: options.map((o: any) => ({ text: o.text, imageUrl: o.imageUrl, matchKey: o.matchKey, isCorrect: o.isCorrect })),
    };
  }

  async updateListeningQuestion(lessonId: string, _blockId: string, qId: string, dto: any) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const found = await this.findItemWithExercise(qId);
    if (!found?.exercise) throw new NotFoundException('Savol topilmadi');
    let { item, exercise } = found;

    if (dto.question !== undefined) item.itemText = dto.question;
    if (dto.questionText !== undefined) item.itemText = dto.questionText;
    if (dto.explanation !== undefined) item.explanation = dto.explanation;
    if (dto.correctExplanation !== undefined) item.explanation = dto.correctExplanation;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl ?? null;

    const newType = dto.type !== undefined ? toQuestionType(dto.type) : dto.questionType !== undefined ? toQuestionType(dto.questionType) : null;
    if (newType && (newType as string) !== exercise.exerciseType) {
      const target = await this.findOrCreateExercise(StudentAnswerBlockType.listening, exercise.ownerBlockId, exercise.lessonId, newType);
      const count = await this.itemRepo.count({ where: { exerciseId: target.id } });
      const oldTargets = this.matchTargetsMap(exercise.instructions)[item.id];
      item.exerciseId = target.id;
      item.orderIndex = count;
      exercise = target;
      if (oldTargets) {
        this.setMatchTargets(exercise, item.id, oldTargets);
        await this.exerciseRepo.save(exercise);
      }
    }

    if (dto.options !== undefined || dto.correctAnswer !== undefined) {
      const rawOptions: any[] = dto.options ?? (item.options ?? []).map((o) => (typeof o === 'string' ? o : o.text));
      const correctAnswerRaw = String(dto.correctAnswer ?? ((item.options ?? []).find((o: any) => typeof o === 'object' && o.isCorrect) as any)?.text ?? '');
      const byIndex = correctAnswerRaw !== '' && !isNaN(Number(correctAnswerRaw));
      const options: ExerciseOption[] = rawOptions.map((opt, idx) => {
        const optText = typeof opt === 'string' ? opt : (opt.text ?? opt.optionText ?? '');
        const optImageUrl = typeof opt === 'object' ? (opt.imageUrl ?? null) : null;
        const optMatchKey = typeof opt === 'object' ? (opt.matchKey ?? null) : null;
        const isCorrectOverride = typeof opt === 'object' && opt.isCorrect !== undefined ? opt.isCorrect : undefined;
        const isCorrect = isCorrectOverride !== undefined ? isCorrectOverride : byIndex ? idx === Number(correctAnswerRaw) : optText === correctAnswerRaw;
        return { text: optText, isCorrect, imageUrl: optImageUrl, matchKey: optMatchKey };
      });
      item.options = options.length ? options : null;
      const correctOpt = options.find((o: any) => o.isCorrect) as any;
      item.correctAnswer = correctOpt?.text ?? '';
    }

    if (dto.matchTargets !== undefined) {
      this.setMatchTargets(exercise, item.id, dto.matchTargets ?? null);
      await this.exerciseRepo.save(exercise);
    }

    await this.itemRepo.save(item);

    const targets = this.matchTargetsMap(exercise.instructions)[item.id] ?? null;
    return {
      id: item.id,
      type: fromQuestionType(exercise.exerciseType),
      question: item.itemText,
      imageUrl: item.imageUrl,
      matchTargets: targets,
      explanation: item.explanation,
      orderIndex: item.orderIndex,
      options: (item.options ?? []).map((o: any) => (typeof o === 'string' ? { text: o } : { text: o.text, imageUrl: o.imageUrl, matchKey: o.matchKey, isCorrect: o.isCorrect })),
    };
  }

  async deleteListeningQuestion(lessonId: string, _blockId: string, qId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const found = await this.findItemWithExercise(qId);
    if (!found) throw new NotFoundException('Savol topilmadi');
    const { item, exercise } = found;
    if (exercise) {
      this.setMatchTargets(exercise, item.id, null);
      await this.exerciseRepo.save(exercise);
    }
    await this.itemRepo.remove(item);
    return { message: "O'chirildi" };
  }

  async addListeningOption(qId: string, dto: { optionText: string; isCorrect: boolean; imageUrl?: string; matchKey?: string }) {
    const item = await this.itemRepo.findOne({ where: { id: qId } });
    if (!item) throw new NotFoundException('Savol topilmadi');
    const options: ExerciseOption[] = Array.isArray(item.options) ? [...item.options] : [];
    options.push({ text: dto.optionText, isCorrect: dto.isCorrect, imageUrl: dto.imageUrl ?? null, matchKey: dto.matchKey ?? null });
    item.options = options;
    if (dto.isCorrect) item.correctAnswer = dto.optionText;
    await this.itemRepo.save(item);
    return { text: dto.optionText, imageUrl: dto.imageUrl ?? null, matchKey: dto.matchKey ?? null, isCorrect: dto.isCorrect };
  }

  // ─── Quiz ─────────────────────────────────────────────────────

  async getQuiz(lessonId: string, blockId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const quiz = await this.quizRepo.findOne({ where: { id: blockId, lessonId } });
    if (!quiz) throw new NotFoundException('Quiz blok topilmadi');
    return { id: quiz.id, title: quiz.title, exercises: await this.getExercises(lessonId, blockId) };
  }

  async saveQuiz(lessonId: string, blockId: string, dto: { title?: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const quiz = await this.quizRepo.findOne({ where: { id: blockId, lessonId } });
    if (!quiz) throw new NotFoundException('Quiz blok topilmadi');
    if (dto.title !== undefined) quiz.title = dto.title;
    const saved = await this.quizRepo.save(quiz);
    return { id: saved.id, title: saved.title };
  }

  // ─── Mashqlar (Exercises) — UMUMIY CRUD (barcha blok turlari uchun) ────

  async getExercises(lessonId: string, blockId: string) {
    const owner = await this.requireOwner(lessonId, blockId);
    const exercises = await this.exerciseRepo.find({
      where: { ownerBlockType: owner.type, ownerBlockId: blockId },
      relations: ['items'],
      order: { orderIndex: 'ASC' },
    });
    return exercises.map((e) => this.mapExercise(e));
  }

  async addExercise(lessonId: string, blockId: string, dto: AddExerciseDto) {
    const owner = await this.requireOwner(lessonId, blockId);
    if (!Object.values(QuizExerciseType).includes(dto.exerciseType as QuizExerciseType)) {
      throw new BadRequestException("Noto'g'ri mashq turi");
    }
    const count = await this.exerciseRepo.count({ where: { ownerBlockType: owner.type, ownerBlockId: blockId } });
    const ex = await this.exerciseRepo.save(
      this.exerciseRepo.create({
        lessonId,
        ownerBlockType: owner.type,
        ownerBlockId: blockId,
        exerciseType: dto.exerciseType as QuizExerciseType,
        title: dto.title ?? null,
        instructions: dto.instructions ?? null,
        orderIndex: count,
      }),
    );
    return this.mapExercise({ ...ex, items: [] } as Exercise);
  }

  async updateExercise(lessonId: string, blockId: string, exerciseId: string, dto: UpdateExerciseDto) {
    await this.requireOwner(lessonId, blockId);
    const ex = await this.exerciseRepo.findOne({ where: { id: exerciseId, ownerBlockId: blockId }, relations: ['items'] });
    if (!ex) throw new NotFoundException('Mashq topilmadi');
    if (dto.title !== undefined) ex.title = dto.title;
    if (dto.instructions !== undefined) ex.instructions = dto.instructions;
    if (dto.exerciseType !== undefined) {
      if (!Object.values(QuizExerciseType).includes(dto.exerciseType as QuizExerciseType)) {
        throw new BadRequestException("Noto'g'ri mashq turi");
      }
      ex.exerciseType = dto.exerciseType as QuizExerciseType;
    }
    await this.exerciseRepo.save(ex);
    return this.mapExercise(ex);
  }

  async deleteExercise(lessonId: string, blockId: string, exerciseId: string) {
    await this.requireOwner(lessonId, blockId);
    const ex = await this.exerciseRepo.findOne({ where: { id: exerciseId, ownerBlockId: blockId } });
    if (!ex) throw new NotFoundException('Mashq topilmadi');
    await this.exerciseRepo.remove(ex);
    return { message: "O'chirildi" };
  }

  async reorderExercises(lessonId: string, blockId: string, exerciseIds: string[]) {
    const owner = await this.requireOwner(lessonId, blockId);
    await Promise.all(
      exerciseIds.map((id, idx) =>
        this.exerciseRepo.update({ id, ownerBlockId: blockId, ownerBlockType: owner.type }, { orderIndex: idx }).catch(() => {}),
      ),
    );
    return { message: 'Tartib saqlandi' };
  }

  async addItem(lessonId: string, blockId: string, exerciseId: string, dto: AddItemDto) {
    await this.requireOwner(lessonId, blockId);
    const ex = await this.exerciseRepo.findOne({ where: { id: exerciseId, ownerBlockId: blockId } });
    if (!ex) throw new NotFoundException('Mashq topilmadi');
    const count = await this.itemRepo.count({ where: { exerciseId: ex.id } });
    const item = await this.itemRepo.save(
      this.itemRepo.create({
        exerciseId: ex.id,
        itemText: dto.itemText,
        correctAnswer: dto.correctAnswer,
        options: dto.options ?? null,
        imageUrl: dto.imageUrl ?? null,
        explanation: dto.explanation ?? null,
        orderIndex: count,
      }),
    );
    return this.mapItem(item);
  }

  async updateItem(lessonId: string, blockId: string, exerciseId: string, itemId: string, dto: UpdateItemDto) {
    await this.requireOwner(lessonId, blockId);
    const item = await this.itemRepo.findOne({ where: { id: itemId, exerciseId } });
    if (!item) throw new NotFoundException('Element topilmadi');
    if (dto.itemText !== undefined) item.itemText = dto.itemText;
    if (dto.correctAnswer !== undefined) item.correctAnswer = dto.correctAnswer;
    if (dto.options !== undefined) item.options = dto.options;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl;
    if (dto.explanation !== undefined) item.explanation = dto.explanation;
    await this.itemRepo.save(item);
    return this.mapItem(item);
  }

  async deleteItem(lessonId: string, blockId: string, exerciseId: string, itemId: string) {
    await this.requireOwner(lessonId, blockId);
    const item = await this.itemRepo.findOne({ where: { id: itemId, exerciseId } });
    if (!item) throw new NotFoundException('Element topilmadi');
    await this.itemRepo.remove(item);
    return { message: "O'chirildi" };
  }

  async reorderItems(lessonId: string, blockId: string, exerciseId: string, itemIds: string[]) {
    await this.requireOwner(lessonId, blockId);
    await Promise.all(
      itemIds.map((id, idx) => this.itemRepo.update({ id, exerciseId }, { orderIndex: idx }).catch(() => {})),
    );
    return { message: 'Tartib saqlandi' };
  }
}

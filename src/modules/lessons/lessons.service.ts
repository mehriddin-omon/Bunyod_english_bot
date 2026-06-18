import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { LessonProgressStatus, LessonStatus, Role } from 'src/common/utils/enum';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(GrammarContent)
    private readonly grammarRepo: Repository<GrammarContent>,

    @InjectRepository(ReadingContent)
    private readonly readingRepo: Repository<ReadingContent>,

    @InjectRepository(ListeningContent)
    private readonly listeningRepo: Repository<ListeningContent>,
  ) { }

  async getUnits(userId: string, role: Role) {
    const units = await this.unitRepo.find({ order: { number: 'ASC' } });
    const allLessons = await this.lessonRepo.find({ order: { unitId: 'ASC', orderIndex: 'ASC' } });

    const lessonsByUnit = new Map<string, Lesson[]>();
    allLessons.forEach((l) => {
      const key = l.unitId ?? '';
      if (!lessonsByUnit.has(key)) lessonsByUnit.set(key, []);
      lessonsByUnit.get(key)!.push(l);
    });

    let progressMap = new Map<string, LessonProgress>();
    if (role === Role.student) {
      const allProgress = await this.progressRepo.find({ where: { userId } });
      allProgress.forEach((p) => progressMap.set(p.lessonId, p));
    }

    const unitResults = units.map((unit, index) => {
      const lessons = (lessonsByUnit.get(unit.id) || []).sort((a, b) => a.orderIndex - b.orderIndex);
      const lessonCount = lessons.length;

      if (role !== Role.student) {
        return { id: unit.id, number: unit.number, title: unit.title, lessonCount, progress: 0, status: 'current', currentLesson: null };
      }

      const completedCount = lessons.filter(
        (l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed,
      ).length;

      const progress = lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0;

      let status: string;
      if (completedCount === lessonCount && lessonCount > 0) {
        status = 'completed';
      } else if (completedCount > 0 || lessons.some((l) => progressMap.get(l.id)?.status === LessonProgressStatus.in_progress)) {
        status = 'current';
      } else if (index === 0) {
        status = 'current';
      } else {
        const prevUnit = units[index - 1];
        const prevLessons = lessonsByUnit.get(prevUnit.id) || [];
        const prevCompleted = prevLessons.filter((l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed).length;
        status = prevLessons.length > 0 && prevCompleted === prevLessons.length ? 'current' : 'locked';
      }

      const currentLesson = status !== 'completed'
        ? lessons.find((l) => { const p = progressMap.get(l.id); return !p || p.status !== LessonProgressStatus.completed; }) ?? null
        : null;

      return {
        id: unit.id,
        number: unit.number,
        title: unit.title,
        lessonCount,
        progress,
        status,
        currentLesson: currentLesson
          ? { id: currentLesson.id, lessonCode: `${unit.number}.${currentLesson.orderIndex}`, title: currentLesson.lessonName }
          : null,
      };
    });

    return { units: unitResults };
  }

  async getUnit(unitId: string, userId: string, role: Role) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit topilmadi');

    const lessons = await this.lessonRepo.find({ where: { unitId }, order: { orderIndex: 'ASC' } });

    const progressMap = new Map<string, LessonProgress>();
    if (role === Role.student) {
      const progresses = await this.progressRepo.find({ where: { userId } });
      progresses.forEach((p) => progressMap.set(p.lessonId, p));
    }

    const lessonResults = lessons.map((lesson, index) => {
      const progress = progressMap.get(lesson.id);

      let status: string;
      if (role !== Role.student) {
        status = 'current';
      } else if (progress?.status === LessonProgressStatus.completed) {
        status = 'completed';
      } else if (progress?.status === LessonProgressStatus.in_progress) {
        status = 'current';
      } else if (index === 0) {
        status = 'current';
      } else {
        const prev = lessons[index - 1];
        status = progressMap.get(prev.id)?.status === LessonProgressStatus.completed ? 'current' : 'locked';
      }

      return {
        id: lesson.id,
        number: lesson.orderIndex,
        lessonCode: `${unit.number}.${lesson.orderIndex}`,
        title: lesson.lessonName,
        status,
        score: progress?.score ?? null,
      };
    });

    return { unit: { id: unit.id, number: unit.number, title: unit.title }, lessons: lessonResults };
  }

  async getLessonPages(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const pages = await this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } });
    return { lessonId, pages };
  }

  async getLessonContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const [grammar, reading, listening] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId } }),
      this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.listeningRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
    ]);
    return {
      id: lesson.id,
      title: lesson.lessonName,
      grammar: {
        count: grammar.length,
        items: grammar.map(
          (g) => ({
            id: g.id,
            pageName: g.pageName
          }))
      },
      reading: { count: reading.length, items: reading.map((r) => ({ id: r.id, title: r.title, wordCount: r.wordCount })) },
      listening: { count: listening.length, items: listening.map((l) => ({ id: l.id, title: l.title, durationSeconds: l.durationSeconds })) },
    };
  }

  async getReadingContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const content = await this.readingRepo.find({
      where: { lessonId },
      relations: ['questions', 'questions.options'],
      order: { orderIndex: 'ASC' },
    });
    return { lessonId, content };
  }

  async getListeningContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const content = await this.listeningRepo.find({
      where: { lessonId },
      relations: ['transcripts', 'questions', 'questions.options'],
      order: { orderIndex: 'ASC' },
    });
    return { lessonId, content };
  }

  async getPublishedByUnit(unitNumber: number): Promise<any[]> {
    const unit = await this.unitRepo.findOne({ where: { number: unitNumber } });
    if (!unit) return [];

    const lessons = await this.lessonRepo.find({
      where: { unitId: unit.id, status: LessonStatus.published },
      order: { orderIndex: 'ASC' },
    });

    return Promise.all(
      lessons.map(async (lesson) => {
        const [readingCount, listeningCount] = await Promise.all([
          this.readingRepo.count({ where: { lessonId: lesson.id } }),
          this.listeningRepo.count({ where: { lessonId: lesson.id } }),
        ]);

        let page_type: 'grammar' | 'reading' | 'listening' = 'grammar';
        if (readingCount > 0) page_type = 'reading';
        else if (listeningCount > 0) page_type = 'listening';

        return {
          id: lesson.id,
          title: lesson.lessonName,
          lesson_code: `${unit.number}.${lesson.orderIndex.toString().padStart(2, '0')}`,
          unit_number: unit.number,
          cefr_level: '',
          status: lesson.status as 'published' | 'draft',
          teacher_id: '',
          group_id: null,
          page_type,
          duration: null,
        };
      }),
    );
  }

  async getLessonBlocks(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const [grammars, readings, listenings] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } }),
      this.readingRepo.find({
        where: { lessonId },
        relations: ['questions', 'questions.options'],
        order: { orderIndex: 'ASC' },
      }),
      this.listeningRepo.find({
        where: { lessonId },
        relations: ['transcripts', 'questions', 'questions.options'],
        order: { orderIndex: 'ASC' },
      }),
    ]);

    let order = 1;

    const grammarBlocks = grammars.map((g) => ({
      id: g.id,
      type: 'grammar' as const,
      order: order++,
      grammarPage: g.pageName,
    }));

    const readingBlocks = readings.map((r) => ({
      id: r.id,
      type: 'reading' as const,
      order: order++,
      title: r.title,
      content: r.textContent,
      wordCount: r.wordCount,
      readTimeMinutes: r.readingTimeMinutes,
      questions: r.questions
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((o) => ({ id: o.id, optionText: o.optionText, isCorrect: o.isCorrect })),
        })),
    }));

    const listeningBlocks = listenings.map((l) => ({
      id: l.id,
      type: 'listening' as const,
      order: order++,
      title: l.title,
      audioUrl: l.fileId || null,
      duration: l.durationSeconds,
      transcript: l.transcripts
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((t) => ({ speaker: t.speakerName, timeStart: t.timestampSec, text: t.textContent })),
      questions: l.questions
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({
          id: q.id,
          type: 'mcq' as const,
          question: q.questionText,
          options: q.options.sort((a, b) => a.orderIndex - b.orderIndex).map((o) => o.optionText),
          correctAnswer: q.options.find((o) => o.isCorrect)?.optionText ?? '',
        })),
    }));

    return [...grammarBlocks, ...readingBlocks, ...listeningBlocks];
  }

  async getLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const progress = await this.progressRepo.findOne({ where: { userId, lessonId } });

    return {
      id: lesson.id,
      lessonCode: lesson.unit ? `${lesson.unit.number}.${lesson.orderIndex}` : String(lesson.orderIndex),
      title: lesson.lessonName,
      orderIndex: lesson.orderIndex,
      status: lesson.status,
      userProgress: progress
        ? { status: progress.status, score: progress.score, attempts: progress.attempts, timeSpent: progress.timeSpentSec }
        : null,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { LessonProgressStatus, Role } from 'src/common/utils/enum';

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
  ) {}

  async getUnits(userId: string, role: Role) {
    const units = await this.unitRepo.find({ order: { number: 'ASC' } });
    const allLessons = await this.lessonRepo.find({ order: { unitId: 'ASC', orderIndex: 'ASC' } });

    const lessonsByUnit = new Map<string, Lesson[]>();
    allLessons.forEach((l) => {
      if (!lessonsByUnit.has(l.unitId)) lessonsByUnit.set(l.unitId, []);
      lessonsByUnit.get(l.unitId)!.push(l);
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
          ? { id: currentLesson.id, lessonCode: `${unit.number}.${currentLesson.lessonNumber}`, title: currentLesson.lessonName }
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
        lessonCode: `${unit.number}.${lesson.lessonNumber}`,
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
      grammar: { count: grammar.length, items: grammar.map((g) => ({ id: g.id, pageName: g.pageName })) },
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

  async getLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const progress = await this.progressRepo.findOne({ where: { userId, lessonId } });

    return {
      id: lesson.id,
      lessonCode: lesson.unit ? `${lesson.unit.number}.${lesson.lessonNumber}` : lesson.lessonNumber,
      title: lesson.lessonName,
      orderIndex: lesson.orderIndex,
      status: lesson.status,
      userProgress: progress
        ? { status: progress.status, score: progress.score, attempts: progress.attempts, timeSpent: progress.timeSpentSec }
        : null,
    };
  }
}

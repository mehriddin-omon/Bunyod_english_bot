import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumLesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { LessonProgressStatus, LessonType, Role } from 'src/common/utils/enum';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(CurriculumLesson)
    private readonly lessonRepo: Repository<CurriculumLesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,
  ) {}

  async getUnits(userId: string, role: Role) {
    const units = await this.unitRepo.find({ order: { number: 'ASC' } });
    const allLessons = await this.lessonRepo.find({ order: { unitId: 'ASC', orderIndex: 'ASC' } });

    const lessonsByUnit = new Map<string, CurriculumLesson[]>();
    allLessons.forEach((l) => {
      if (!l.unitId) return;
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
        return {
          id: unit.id,
          number: unit.number,
          title: unit.title,
          lessonCount,
          progress: 0,
          status: 'current',
          currentLesson: null,
        };
      }

      const completedCount = lessons.filter(
        (l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed,
      ).length;

      const progress =
        lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0;

      let status: string;
      if (completedCount === lessonCount && lessonCount > 0) {
        status = 'completed';
      } else if (
        completedCount > 0 ||
        lessons.some(
          (l) => progressMap.get(l.id)?.status === LessonProgressStatus.in_progress,
        )
      ) {
        status = 'current';
      } else if (index === 0) {
        status = 'current';
      } else {
        const prevUnit = units[index - 1];
        const prevLessons = (prevUnit.lessons || []);
        const prevCompleted = prevLessons.filter(
          (l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed,
        ).length;
        status =
          prevLessons.length > 0 && prevCompleted === prevLessons.length
            ? 'current'
            : 'locked';
      }

      const currentLesson =
        status !== 'completed'
          ? lessons.find((l) => {
              const p = progressMap.get(l.id);
              return !p || p.status !== LessonProgressStatus.completed;
            }) ?? null
          : null;

      return {
        id: unit.id,
        number: unit.number,
        title: unit.title,
        lessonCount,
        progress,
        status,
        currentLesson: currentLesson
          ? {
              id: currentLesson.id,
              lessonCode: `${unit.number}.${currentLesson.lessonNumber}`,
              title: currentLesson.lessonName,
              type: currentLesson.lessonType,
            }
          : null,
      };
    });

    return { units: unitResults };
  }

  async getUnit(unitId: string, userId: string, role: Role) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit topilmadi');

    const lessons = (
      await this.lessonRepo.find({ where: { unitId }, order: { orderIndex: 'ASC' } })
    );

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
        const prevProgress = progressMap.get(prev.id);
        status =
          prevProgress?.status === LessonProgressStatus.completed ? 'current' : 'locked';
      }

      return {
        id: lesson.id,
        number: lesson.orderIndex,
        lessonCode: `${unit.number}.${lesson.lessonNumber}`,
        title: lesson.lessonName,
        type: lesson.lessonType,
        duration: lesson.durationMinutes,
        status,
        score: progress?.score ?? null,
      };
    });

    return {
      unit: { id: unit.id, number: unit.number, title: unit.title },
      lessons: lessonResults,
    };
  }

  async getLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const [progress, unit] = await Promise.all([
      this.progressRepo.findOne({ where: { userId, lessonId } }),
      lesson.unitId ? this.unitRepo.findOne({ where: { id: lesson.unitId } }) : null,
    ]);

    return {
      id: lesson.id,
      lessonCode: unit
        ? `${unit.number}.${lesson.lessonNumber}`
        : lesson.lessonNumber,
      title: lesson.lessonName,
      type: lesson.lessonType,
      duration: lesson.durationMinutes,
      content: lesson.content,
      userProgress: progress
        ? {
            status: progress.status,
            score: progress.score,
            attempts: progress.attempts,
            timeSpent: progress.timeSpentSec,
          }
        : null,
      outline: [],
    };
  }

  async getReadingContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (lesson.lessonType !== LessonType.reading) {
      throw new BadRequestException('Bu dars reading turida emas');
    }
    return lesson.content;
  }

  async getListeningContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (lesson.lessonType !== LessonType.listening) {
      throw new BadRequestException('Bu dars listening turida emas');
    }
    return lesson.content;
  }
}

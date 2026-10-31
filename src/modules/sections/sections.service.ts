import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { LessonProgressStatus, LessonStatus } from 'src/common/utils/enum';
import { LessonGatingService } from 'src/common/services/lesson-gating.service';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    private readonly lessonGating: LessonGatingService,
  ) {}

  async getSections(userId: string) {
    const units = await this.unitRepo.find({ order: { number: 'ASC' } });

    const allLessons = await this.lessonRepo.find({
      where: { status: LessonStatus.published },
      order: { unitId: 'ASC', orderIndex: 'ASC' },
    });

    const lessonsByUnit = new Map<string, Lesson[]>();
    allLessons.forEach((l) => {
      const key = l.unitId ?? '';
      if (!lessonsByUnit.has(key)) lessonsByUnit.set(key, []);
      lessonsByUnit.get(key)!.push(l);
    });

    const allProgress = await this.progressRepo.find({ where: { userId } });
    const progressMap = new Map<string, LessonProgress>();
    allProgress.forEach((p) => progressMap.set(p.lessonId, p));

    // KETMA-KET QULF: yopiq darslar yagona manbadan (LessonGatingService). Bo'lim
    // yopiq — undagi hech bir dars hali ochilmagan bo'lsa (oldingi dars tugatilmagan).
    const lockedIds = (await this.lessonGating.getLockedLessonIds(userId)) ?? new Set<string>();

    // Nashr qilingan darsi yo'q bo'lim (teacher endigina ochgan) ilovada ko'rsatilmaydi
    return units.filter((unit) => (lessonsByUnit.get(unit.id) || []).length > 0).map((unit) => {
      const lessons = (lessonsByUnit.get(unit.id) || []).sort((a, b) => a.orderIndex - b.orderIndex);
      const totalLessons = lessons.length;

      const completedLessons = lessons.filter(
        (l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed,
      ).length;

      let status: 'completed' | 'active' | 'available' | 'locked';

      if (totalLessons > 0 && completedLessons === totalLessons) {
        status = 'completed';
      } else if (totalLessons > 0 && lessons.every((l) => lockedIds.has(l.id))) {
        status = 'locked';
      } else if (completedLessons > 0) {
        status = 'active';
      } else {
        status = 'available';
      }

      return { id: unit.id, number: unit.number, title: unit.title, totalLessons, completedLessons, status };
    });
  }

  async getSection(sectionId: string, userId: string) {
    const unit = await this.unitRepo.findOne({ where: { id: sectionId } });
    if (!unit) throw new NotFoundException('Section topilmadi');

    const lessons = await this.lessonRepo.find({
      where: { unitId: sectionId, status: LessonStatus.published },
      order: { orderIndex: 'ASC' },
    });

    const allProgress = await this.progressRepo.find({ where: { userId } });
    const progressMap = new Map<string, LessonProgress>();
    allProgress.forEach((p) => progressMap.set(p.lessonId, p));

    const totalLessons = lessons.length;
    const completedLessons = lessons.filter(
      (l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed,
    ).length;

    let status: 'completed' | 'active' | 'available' | 'locked';
    if (totalLessons > 0 && completedLessons === totalLessons) status = 'completed';
    else if (completedLessons > 0) status = 'active';
    else status = 'available';

    return { id: unit.id, number: unit.number, title: unit.title, totalLessons, completedLessons, status };
  }

  async getSectionLessons(sectionId: string, userId: string) {
    const unit = await this.unitRepo.findOne({ where: { id: sectionId } });
    if (!unit) throw new NotFoundException('Section topilmadi');

    const lessons = await this.lessonRepo.find({
      where: { unitId: sectionId, status: LessonStatus.published },
      order: { orderIndex: 'ASC' },
    });

    const allProgress = await this.progressRepo.find({ where: { userId } });
    const progressMap = new Map<string, LessonProgress>();
    allProgress.forEach((p) => progressMap.set(p.lessonId, p));

    const lockedIds = (await this.lessonGating.getLockedLessonIds(userId)) ?? new Set<string>();
    let foundActive = false;

    return lessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const isCompleted = progress?.status === LessonProgressStatus.completed;

      let lessonStatus: 'completed' | 'active' | 'locked';

      if (isCompleted) {
        lessonStatus = 'completed';
      } else if (lockedIds.has(lesson.id)) {
        lessonStatus = 'locked';
      } else if (!foundActive) {
        lessonStatus = 'active';
        foundActive = true;
      } else {
        lessonStatus = 'locked';
      }

      return {
        id: lesson.id,
        sectionId: unit.id,
        number: `${unit.number}.${lesson.orderIndex}`,
        title: lesson.lessonName,
        status: lessonStatus,
        score: progress?.score ?? null,
      };
    });
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonStatus } from 'src/common/utils/enum';

@Injectable()
export class TeacherLessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
  ) {}

  async verifyLesson(lessonId: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  async getLessons(query: any) {
    const { status, unitId, search, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (unitId) where.unitId = unitId;
    if (search) where.lessonName = ILike(`%${search}%`);

    const [lessons, total] = await this.lessonRepo.findAndCount({
      where,
      relations: ['unit'],
      order: { createdAt: 'DESC' },
      skip,
      take: Number(limit),
    });

    const allLessons = await this.lessonRepo.find();
    const stats = {
      total: allLessons.length,
      published: allLessons.filter((l) => l.status === LessonStatus.published).length,
      draft: allLessons.filter((l) => l.status === LessonStatus.draft).length,
      archived: allLessons.filter((l) => l.status === LessonStatus.archived).length,
    };

    const data = lessons.map((lesson) => ({
      id: lesson.id,
      lessonNumber: lesson.lessonNumber,
      lessonName: lesson.lessonName,
      orderIndex: lesson.orderIndex,
      status: lesson.status,
      unit: lesson.unit ? { id: lesson.unit.id, number: lesson.unit.number, title: lesson.unit.title } : null,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    }));

    return {
      stats,
      data,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  async createLesson(dto: CreateLessonDto) {
    const unit = await this.unitRepo.findOne({ where: { id: dto.unitId } });
    if (!unit) throw new BadRequestException('Unit topilmadi');

    const lesson = this.lessonRepo.create({
      unitId: dto.unitId,
      lessonName: dto.lessonName,
      lessonNumber: dto.lessonNumber ?? null,
      orderIndex: dto.orderIndex ?? 0,
      status: LessonStatus.draft,
    });
    const saved = await this.lessonRepo.save(lesson);

    return {
      id: saved.id,
      lessonNumber: saved.lessonNumber,
      lessonName: saved.lessonName,
      orderIndex: saved.orderIndex,
      status: saved.status,
      unit: { id: unit.id, number: unit.number, title: unit.title },
      createdAt: saved.createdAt,
    };
  }

  async getLessonById(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['unit'],
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    return {
      id: lesson.id,
      lessonNumber: lesson.lessonNumber,
      lessonName: lesson.lessonName,
      orderIndex: lesson.orderIndex,
      status: lesson.status,
      unit: lesson.unit ? { id: lesson.unit.id, number: lesson.unit.number, title: lesson.unit.title } : null,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const lesson = await this.verifyLesson(lessonId);

    if (dto.unitId && dto.unitId !== lesson.unitId) {
      const unit = await this.unitRepo.findOne({ where: { id: dto.unitId } });
      if (!unit) throw new BadRequestException('Unit topilmadi');
    }

    Object.assign(lesson, dto);
    const saved = await this.lessonRepo.save(lesson);

    return {
      id: saved.id,
      lessonNumber: saved.lessonNumber,
      lessonName: saved.lessonName,
      orderIndex: saved.orderIndex,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  async deleteLesson(lessonId: string) {
    const lesson = await this.verifyLesson(lessonId);
    if (lesson.status !== LessonStatus.draft) throw new BadRequestException("Faqat qoralama darsni o'chirish mumkin");
    await this.lessonRepo.remove(lesson);
    return { message: "Dars o'chirildi" };
  }

  async publishLesson(lessonId: string) {
    const lesson = await this.verifyLesson(lessonId);
    lesson.status = LessonStatus.published;
    await this.lessonRepo.save(lesson);
    return { id: lesson.id, status: LessonStatus.published };
  }

  async revertToDraft(lessonId: string) {
    const lesson = await this.verifyLesson(lessonId);
    lesson.status = LessonStatus.draft;
    await this.lessonRepo.save(lesson);
    return { id: lesson.id, status: LessonStatus.draft };
  }

  async duplicateLesson(lessonId: string) {
    const original = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!original) throw new NotFoundException('Dars topilmadi');

    const copy = this.lessonRepo.create({
      unitId: original.unitId,
      lessonName: `${original.lessonName} (copy)`,
      lessonNumber: original.lessonNumber,
      orderIndex: original.orderIndex + 1,
      status: LessonStatus.draft,
    });
    const saved = await this.lessonRepo.save(copy);

    return {
      id: saved.id,
      lessonNumber: saved.lessonNumber,
      lessonName: saved.lessonName,
      orderIndex: saved.orderIndex,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  async searchGrammar(query: any) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const units = await this.unitRepo.find({ order: { number: 'ASC' } });
    return {
      data: units.map((u) => ({ id: u.id, number: u.number, title: u.title })),
      meta: { total: units.length, page: Number(page), limit: Number(limit) },
    };
  }
}

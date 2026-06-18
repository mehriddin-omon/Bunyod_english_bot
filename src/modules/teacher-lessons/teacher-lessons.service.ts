import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonStatus } from 'src/common/utils/enum';

@Injectable()
export class TeacherLessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(GrammarContent)
    private readonly grammarRepo: Repository<GrammarContent>,

    @InjectRepository(ReadingContent)
    private readonly readingRepo: Repository<ReadingContent>,

    @InjectRepository(ListeningContent)
    private readonly listeningRepo: Repository<ListeningContent>,
  ) {}

  async verifyLesson(lessonId: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  private async getBlockInfo(lessonIds: string[]): Promise<Map<string, { types: string[]; count: number }>> {
    if (!lessonIds.length) return new Map();
    const [grammar, reading, listening] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId: In(lessonIds) } }),
      this.readingRepo.find({ where: { lessonId: In(lessonIds) } }),
      this.listeningRepo.find({ where: { lessonId: In(lessonIds) } }),
    ]);
    const map = new Map<string, { types: Set<string>; count: number }>();
    const init = (id: string) => { if (!map.has(id)) map.set(id, { types: new Set(), count: 0 }); };
    grammar.forEach((g) => { init(g.lessonId); const e = map.get(g.lessonId)!; e.types.add('grammar'); e.count++; });
    reading.forEach((r) => { init(r.lessonId); const e = map.get(r.lessonId)!; e.types.add('reading'); e.count++; });
    listening.forEach((l) => { init(l.lessonId); const e = map.get(l.lessonId)!; e.types.add('listening'); e.count++; });
    const result = new Map<string, { types: string[]; count: number }>();
    map.forEach((v, k) => result.set(k, { types: [...v.types], count: v.count }));
    return result;
  }

  private formatLesson(lesson: Lesson, types: string[] = [], count = 0) {
    return {
      id: lesson.id,
      title: lesson.lessonName,
      lessonCode: lesson.unitNumber != null ? `${lesson.unitNumber}.${lesson.orderIndex}` : null,
      orderIndex: lesson.orderIndex,
      unitNumber: lesson.unitNumber ?? null,
      cefrLevel: lesson.cefrLevel ?? null,
      status: lesson.status,
      group: lesson.group ? { id: lesson.group.id, name: lesson.group.name, color: lesson.group.color } : null,
      blocksCount: count,
      blockTypes: types,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  async getLessons(query: any) {
    const { status, unitNumber, search, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (unitNumber) where.unitNumber = Number(unitNumber);
    if (search) where.lessonName = ILike(`%${search}%`);

    const [lessons, total] = await this.lessonRepo.findAndCount({
      where,
      relations: ['group'],
      order: { createdAt: 'DESC' },
      skip,
      take: Number(limit),
    });

    const allLessons = await this.lessonRepo.find();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const stats = {
      total: allLessons.length,
      published: allLessons.filter((l) => l.status === LessonStatus.published).length,
      draft: allLessons.filter((l) => l.status === LessonStatus.draft).length,
      scheduled: 0,
      createdThisMonth: allLessons.filter((l) => new Date(l.createdAt) >= startOfMonth).length,
    };

    const blockInfoMap = await this.getBlockInfo(lessons.map((l) => l.id));

    const data = lessons.map((lesson) => {
      const info = blockInfoMap.get(lesson.id) ?? { types: [], count: 0 };
      return {
        id: lesson.id,
        title: lesson.lessonName,
        lessonCode: lesson.unitNumber != null ? `${lesson.unitNumber}.${lesson.orderIndex}` : null,
        orderIndex: lesson.orderIndex,
        unitNumber: lesson.unitNumber ?? null,
        cefrLevel: lesson.cefrLevel ?? null,
        status: lesson.status,
        group: lesson.group ? { id: lesson.group.id, name: lesson.group.name, color: lesson.group.color } : null,
        blocksCount: info.count,
        blockTypes: info.types,
        studentsCompleted: 0,
        totalStudents: 0,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
      };
    });

    return {
      stats,
      data,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  async createLesson(dto: CreateLessonDto) {
    const lesson = this.lessonRepo.create({
      lessonName: dto.title,
      unitNumber: dto.unitNumber ?? null,
      orderIndex: dto.orderIndex ?? 0,
      cefrLevel: dto.cefrLevel ?? null,
      groupId: dto.groupId ?? null,
      status: LessonStatus.draft,
    });
    const saved = await this.lessonRepo.save(lesson);
    return { id: saved.id, title: saved.lessonName, status: saved.status, createdAt: saved.createdAt };
  }

  async getLessonById(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['group'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const [blockInfoMap, grammar, reading, listening] = await Promise.all([
      this.getBlockInfo([lessonId]),
      this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } }),
      this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.listeningRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
    ]);
    const info = blockInfoMap.get(lessonId) ?? { types: [], count: 0 };
    const blocks = [
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
          duration: l.durationSeconds,
          trackCode: l.trackCode,
          speakers: l.speakers,
        },
      })),
    ];
    return { ...this.formatLesson(lesson, info.types, info.count), blocks };
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['group'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (dto.title      !== undefined) lesson.lessonName = dto.title;
    if (dto.unitNumber !== undefined) lesson.unitNumber  = dto.unitNumber;
    if (dto.orderIndex !== undefined) lesson.orderIndex  = dto.orderIndex;
    if (dto.cefrLevel  !== undefined) lesson.cefrLevel   = dto.cefrLevel;
    if (dto.groupId    !== undefined) lesson.groupId     = dto.groupId;
    await this.lessonRepo.save(lesson);
    const updated = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['group'] });
    const blockInfoMap = await this.getBlockInfo([lessonId]);
    const info = blockInfoMap.get(lessonId) ?? { types: [], count: 0 };
    return this.formatLesson(updated!, info.types, info.count);
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
      lessonName: `${original.lessonName} (copy)`,
      unitNumber: original.unitNumber,
      cefrLevel: original.cefrLevel,
      status: LessonStatus.draft,
    });
    const saved = await this.lessonRepo.save(copy);
    return { id: saved.id, title: saved.lessonName, status: saved.status, createdAt: saved.createdAt };
  }

  async getUnitNumbers() {
    const lessons = await this.lessonRepo
      .createQueryBuilder('l')
      .select('DISTINCT l.unit_number', 'unitNumber')
      .where('l.unit_number IS NOT NULL')
      .orderBy('l.unit_number', 'ASC')
      .getRawMany();
    return { data: lessons.map((r) => Number(r.unitNumber)).filter((n) => !isNaN(n)) };
  }
}

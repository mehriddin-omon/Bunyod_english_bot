import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { QuizContent } from 'src/common/core/entitys/quiz-content.entity';
import { Exercise } from 'src/common/core/entitys/exercise.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonStatus, StudentAnswerBlockType } from 'src/common/utils/enum';

@Injectable()
export class TeacherLessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,

    @InjectRepository(GrammarContent)
    private readonly grammarRepo: Repository<GrammarContent>,

    @InjectRepository(ReadingContent)
    private readonly readingRepo: Repository<ReadingContent>,

    @InjectRepository(ListeningContent)
    private readonly listeningRepo: Repository<ListeningContent>,

    @InjectRepository(QuizContent)
    private readonly quizRepo: Repository<QuizContent>,

    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
  ) {}

  async verifyLesson(lessonId: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  private async getBlockInfo(lessonIds: string[]): Promise<Map<string, { types: string[]; count: number }>> {
    if (!lessonIds.length) return new Map();
    const [grammar, reading, listening, quiz] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId: In(lessonIds) } }),
      this.readingRepo.find({ where: { lessonId: In(lessonIds) } }),
      this.listeningRepo.find({ where: { lessonId: In(lessonIds) } }),
      this.quizRepo.find({ where: { lessonId: In(lessonIds) } }),
    ]);
    const map = new Map<string, { types: Set<string>; count: number }>();
    const init = (id: string) => { if (!map.has(id)) map.set(id, { types: new Set(), count: 0 }); };
    grammar.forEach((g) => { init(g.lessonId); const e = map.get(g.lessonId)!; e.types.add('grammar'); e.count++; });
    reading.forEach((r) => { init(r.lessonId); const e = map.get(r.lessonId)!; e.types.add('reading'); e.count++; });
    listening.forEach((l) => { init(l.lessonId); const e = map.get(l.lessonId)!; e.types.add('listening'); e.count++; });
    quiz.forEach((q) => { init(q.lessonId); const e = map.get(q.lessonId)!; e.types.add('quiz'); e.count++; });
    const result = new Map<string, { types: string[]; count: number }>();
    map.forEach((v, k) => result.set(k, { types: [...v.types], count: v.count }));
    return result;
  }

  private formatLesson(lesson: Lesson, types: string[] = [], count = 0) {
    return {
      id: lesson.id,
      title: lesson.lessonName,
      lessonCode: lesson.unit?.number != null ? `${lesson.unit.number}.${lesson.orderIndex}` : null,
      orderIndex: lesson.orderIndex,
      unitNumber: lesson.unit?.number ?? null,
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

    const qb = this.lessonRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.unit',  'unit')
      .leftJoinAndSelect('l.group', 'grp')
      .orderBy('unit.number',  'ASC')
      .addOrderBy('l.orderIndex', 'ASC');

    if (status)     qb.andWhere('l.status = :status', { status });
    if (search)     qb.andWhere('l.lesson_name ILIKE :search', { search: `%${search}%` });
    if (unitNumber) qb.andWhere('unit.number = :unitNumber', { unitNumber: Number(unitNumber) });

    qb.skip(skip).take(Number(limit));

    const [lessons, total] = await qb.getManyAndCount();

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
        lessonCode: lesson.unit?.number != null ? `${lesson.unit.number}.${lesson.orderIndex}` : null,
        orderIndex: lesson.orderIndex,
        unitNumber: lesson.unit?.number ?? null,
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
      orderIndex: dto.orderIndex ?? 0,
      cefrLevel: dto.cefrLevel ?? null,
      groupId: dto.groupId ?? null,
      status: LessonStatus.draft,
    });
    const saved = await this.lessonRepo.save(lesson);
    return { id: saved.id, title: saved.lessonName, status: saved.status, createdAt: saved.createdAt };
  }

  async getLessonById(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['group', 'unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const [blockInfoMap, grammar, reading, listening, quiz] = await Promise.all([
      this.getBlockInfo([lessonId]),
      this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } }),
      this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.listeningRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.quizRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
    ]);
    // Quiz mashqlari polimorf bog'lanadi: owner_block_type='quiz' + owner_block_id
    const quizExercises = quiz.length
      ? await this.exerciseRepo.find({
          where: { ownerBlockType: StudentAnswerBlockType.quiz, ownerBlockId: In(quiz.map((q) => q.id)) },
          relations: ['items'],
        })
      : [];
    const exercisesByQuiz = new Map<string, Exercise[]>();
    for (const ex of quizExercises) {
      if (!exercisesByQuiz.has(ex.ownerBlockId)) exercisesByQuiz.set(ex.ownerBlockId, []);
      exercisesByQuiz.get(ex.ownerBlockId)!.push(ex);
    }
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
      ...quiz.map((q) => ({
        id: q.id,
        type: 'quiz',
        order: q.orderIndex,
        quiz: {
          title: q.title,
          exerciseCount: exercisesByQuiz.get(q.id)?.length ?? 0,
          itemCount: exercisesByQuiz.get(q.id)?.reduce((sum, e) => sum + (e.items?.length ?? 0), 0) ?? 0,
        },
      })),
    ];

    // O'qituvchi belgilagan tartib: orderIndex (grammar doim birinchi), teng bo'lsa createdAt
    const sortMeta = new Map<string, { idx: number; created: number }>();
    grammar.forEach((g) => sortMeta.set(g.id, { idx: -1, created: +new Date(g.createdAt) }));
    reading.forEach((r) => sortMeta.set(r.id, { idx: r.orderIndex ?? 0, created: +new Date(r.createdAt) }));
    listening.forEach((l) => sortMeta.set(l.id, { idx: l.orderIndex ?? 0, created: +new Date(l.createdAt) }));
    quiz.forEach((q) => sortMeta.set(q.id, { idx: q.orderIndex ?? 0, created: +new Date(q.createdAt) }));
    blocks.sort((a, b) => {
      const A = sortMeta.get(a.id)!;
      const B = sortMeta.get(b.id)!;
      return A.idx - B.idx || A.created - B.created;
    });

    return { ...this.formatLesson(lesson, info.types, info.count), blocks };
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['group', 'unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (dto.title      !== undefined) lesson.lessonName = dto.title;
    if (dto.orderIndex !== undefined) lesson.orderIndex  = dto.orderIndex;
    if (dto.cefrLevel  !== undefined) lesson.cefrLevel   = dto.cefrLevel;
    if (dto.groupId    !== undefined) lesson.groupId     = dto.groupId;
    await this.lessonRepo.save(lesson);
    const updated = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['group', 'unit'] });
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
      cefrLevel: original.cefrLevel,
      status: LessonStatus.draft,
    });
    const saved = await this.lessonRepo.save(copy);
    return { id: saved.id, title: saved.lessonName, status: saved.status, createdAt: saved.createdAt };
  }

  async getUnitNumbers() {
    const units = await this.unitRepo
      .createQueryBuilder('u')
      .innerJoin('lessons', 'l', 'l.unit_id = u.id')
      .select('DISTINCT u.number', 'number')
      .orderBy('u.number', 'ASC')
      .getRawMany();
    return { data: units.map((r) => Number(r.number)).filter((n) => !isNaN(n)) };
  }
}

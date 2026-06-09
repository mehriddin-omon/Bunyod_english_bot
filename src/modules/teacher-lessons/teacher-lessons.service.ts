import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/teacher-lesson.entity';
import { LessonBlock } from 'src/common/core/entitys/teacher-lesson-block.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Grammar } from 'src/common/core/entitys/grammar.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class TeacherLessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(LessonBlock)
    private readonly blockRepo: Repository<LessonBlock>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(Grammar)
    private readonly grammarRepo: Repository<Grammar>,
  ) {}

  async verifyOwnership(lessonId: string, userId: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException("Dars topilmadi");
    if (lesson.teacherId !== userId) throw new ForbiddenException("Bu dars sizga tegishli emas");
    return lesson;
  }

  private async getGroupMemberCount(groupId: string): Promise<number> {
    const result = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoin('g.members', 'm')
      .where('g.id = :groupId', { groupId })
      .select('COUNT(m.id)', 'cnt')
      .getRawOne();
    return parseInt(result?.cnt ?? '0', 10);
  }

  async getLessons(userId: string, query: any) {
    const { status, unitNumber, search, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { teacherId: userId };
    if (status) where.status = status;
    if (unitNumber) where.unitNumber = Number(unitNumber);
    if (search) where.title = ILike(`%${search}%`);

    const [lessons, total] = await this.lessonRepo.findAndCount({
      where,
      relations: ['group', 'blocks'],
      order: { created_at: 'DESC' },
      skip,
      take: Number(limit),
    });

    const allLessons = await this.lessonRepo.find({ where: { teacherId: userId } });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const stats = {
      total: allLessons.length,
      published: allLessons.filter((l) => l.status === 'published').length,
      draft: allLessons.filter((l) => l.status === 'draft').length,
      scheduled: allLessons.filter((l) => l.status === 'scheduled').length,
      createdThisMonth: allLessons.filter((l) => new Date(l.created_at) >= startOfMonth).length,
    };

    const data = await Promise.all(
      lessons.map(async (lesson) => {
        const blockTypes = [...new Set(lesson.blocks.map((b) => b.type))];
        const totalStudents = lesson.groupId ? await this.getGroupMemberCount(lesson.groupId) : 0;
        return {
          id: lesson.id,
          title: lesson.title,
          lessonCode: lesson.lessonCode,
          unitNumber: lesson.unitNumber,
          cefrLevel: lesson.cefrLevel,
          status: lesson.status,
          group: lesson.group ? { id: lesson.group.id, name: lesson.group.name, color: (lesson.group as any).color } : null,
          blocksCount: lesson.blocks.length,
          blockTypes,
          studentsCompleted: 0,
          totalStudents,
          createdAt: lesson.created_at,
          updatedAt: lesson.update_at,
        };
      }),
    );

    return {
      stats,
      data,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  async createLesson(dto: CreateLessonDto, userId: string) {
    if (dto.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
      if (!group) throw new BadRequestException("Guruh topilmadi");
      if (group.teacherId !== userId) throw new BadRequestException("Bu guruh sizga tegishli emas");
    }
    const lesson = this.lessonRepo.create({ ...dto, groupId: dto.groupId ?? null, teacherId: userId, status: 'draft' });
    const saved = await this.lessonRepo.save(lesson);
    const group = dto.groupId ? await this.groupRepo.findOne({ where: { id: dto.groupId } }) : null;
    return {
      id: saved.id, title: saved.title, lessonCode: saved.lessonCode, unitNumber: saved.unitNumber,
      cefrLevel: saved.cefrLevel, status: saved.status,
      group: group ? { id: group.id, name: group.name, color: (group as any).color } : null,
      blocks: [], createdAt: saved.created_at,
    };
  }

  async getLessonById(lessonId: string, userId: string) {
    await this.verifyOwnership(lessonId, userId);

    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['group', 'blocks', 'blocks.vocabBlock', 'blocks.vocabBlock.words', 'blocks.readingBlock', 'blocks.readingBlock.questions', 'blocks.listeningBlock', 'blocks.listeningBlock.questions', 'blocks.speakingBlock'],
    });

    const blocks = await Promise.all(
      (lesson!.blocks || []).sort((a, b) => a.order - b.order).map(async (block) => {
        let grammar: any = null;
        if (block.grammarId) {
          const g = await this.grammarRepo.findOne({ where: { id: block.grammarId } });
          if (g) grammar = { id: g.id, heading: g.heading, description: g.description, formula: g.formula, examples: g.examples, rules: g.rules, relatedWords: g.relatedWords, tip: g.tip };
        }
        return {
          id: block.id, type: block.type, order: block.order, grammar,
          vocabulary: block.vocabBlock ? {
            id: block.vocabBlock.id, exerciseTypes: block.vocabBlock.exerciseTypes,
            wordsCount: (block.vocabBlock.words || []).length,
            words: (block.vocabBlock.words || []).sort((a, b) => a.order - b.order),
          } : null,
          reading: block.readingBlock ? {
            id: block.readingBlock.id, title: block.readingBlock.title, author: block.readingBlock.author,
            content: block.readingBlock.text, wordCount: block.readingBlock.wordCount,
            readTimeMinutes: block.readingBlock.readTimeMinutes, cefrLevel: block.readingBlock.cefrLevel,
            highlights: block.readingBlock.highlights,
            questions: (block.readingBlock.questions || []).sort((a, b) => a.order - b.order),
          } : null,
          listening: block.listeningBlock ? {
            id: block.listeningBlock.id, title: block.listeningBlock.title, audioUrl: block.listeningBlock.audioUrl,
            duration: block.listeningBlock.duration, trackCode: block.listeningBlock.trackCode,
            speakers: block.listeningBlock.speakers, transcript: block.listeningBlock.transcript,
            questions: (block.listeningBlock.questions || []).sort((a, b) => a.order - b.order),
          } : null,
          speaking: block.speakingBlock ? {
            id: block.speakingBlock.id, title: block.speakingBlock.title,
            instructions: block.speakingBlock.instructions, topics: block.speakingBlock.topics,
            examples: block.speakingBlock.examples, durationMinutes: block.speakingBlock.durationMinutes,
          } : null,
        };
      }),
    );

    return {
      id: lesson!.id, title: lesson!.title, lessonCode: lesson!.lessonCode,
      unitNumber: lesson!.unitNumber, cefrLevel: lesson!.cefrLevel, status: lesson!.status,
      group: lesson!.group ? { id: lesson!.group.id, name: lesson!.group.name, color: (lesson!.group as any).color } : null,
      blocks,
    };
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto, userId: string) {
    const lesson = await this.verifyOwnership(lessonId, userId);
    if ('groupId' in dto && dto.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
      if (!group) throw new BadRequestException("Guruh topilmadi");
      if (group.teacherId !== userId) throw new BadRequestException("Bu guruh sizga tegishli emas");
    }
    Object.assign(lesson, dto);
    if ('groupId' in dto && dto.groupId === null) lesson.groupId = null;
    const saved = await this.lessonRepo.save(lesson);
    const group = saved.groupId ? await this.groupRepo.findOne({ where: { id: saved.groupId } }) : null;
    return {
      id: saved.id, title: saved.title, lessonCode: saved.lessonCode,
      unitNumber: saved.unitNumber, cefrLevel: saved.cefrLevel, status: saved.status,
      group: group ? { id: group.id, name: group.name, color: (group as any).color } : null,
      updatedAt: saved.update_at,
    };
  }

  async deleteLesson(lessonId: string, userId: string) {
    const lesson = await this.verifyOwnership(lessonId, userId);
    if (lesson.status !== 'draft') throw new BadRequestException("Faqat qoralama darsni o'chirib bo'ladi");
    await this.lessonRepo.remove(lesson);
    return { message: "Dars o'chirildi" };
  }

  async publishLesson(lessonId: string, userId: string) {
    const lesson = await this.verifyOwnership(lessonId, userId);
    const count = await this.blockRepo.count({ where: { lessonId } });
    if (count === 0) throw new BadRequestException("Darsda kamida 1 ta blok bo'lishi kerak");
    lesson.status = 'published';
    await this.lessonRepo.save(lesson);
    return { id: lesson.id, status: 'published' };
  }

  async revertToDraft(lessonId: string, userId: string) {
    const lesson = await this.verifyOwnership(lessonId, userId);
    lesson.status = 'draft';
    await this.lessonRepo.save(lesson);
    return { id: lesson.id, status: 'draft' };
  }

  async duplicateLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['blocks', 'blocks.vocabBlock', 'blocks.vocabBlock.words', 'blocks.readingBlock', 'blocks.readingBlock.questions', 'blocks.listeningBlock', 'blocks.listeningBlock.questions', 'blocks.speakingBlock'],
    });
    if (!lesson) throw new NotFoundException("Dars topilmadi");
    if (lesson.teacherId !== userId) throw new ForbiddenException("Bu dars sizga tegishli emas");

    const newLesson = this.lessonRepo.create({
      title: lesson.title + ' (nusxa)', status: 'draft', teacherId: userId,
      lessonCode: null, unitNumber: lesson.unitNumber, cefrLevel: lesson.cefrLevel, groupId: null,
    });
    const savedLesson = await this.lessonRepo.save(newLesson);

    for (const block of lesson.blocks) {
      const newBlock = this.blockRepo.create({ lessonId: savedLesson.id, type: block.type, order: block.order, grammarId: block.grammarId });
      await this.blockRepo.save(newBlock);
    }

    return { id: savedLesson.id, title: savedLesson.title, status: 'draft', createdAt: savedLesson.created_at };
  }

  async searchGrammar(query: any) {
    const { search, cefrLevel, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    let qb = this.grammarRepo.createQueryBuilder('g').skip(skip).take(Number(limit));
    if (search) qb = qb.where('g.heading ILIKE :s OR g.description ILIKE :s', { s: `%${search}%` });
    if (cefrLevel) qb = qb.andWhere('g.cefrLevel = :cefrLevel', { cefrLevel });

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((g) => ({ id: g.id, heading: g.heading, description: g.description, cefrLevel: g.cefrLevel, formula: g.formula, examples: g.examples })),
      meta: { total, page: Number(page), limit: Number(limit) },
    };
  }
}

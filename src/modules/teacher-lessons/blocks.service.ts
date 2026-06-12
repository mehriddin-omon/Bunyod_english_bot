import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
import { TeacherLessonsService } from './teacher-lessons.service';
import { QuestionType } from 'src/common/utils/enum';

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
    private readonly transcriptRepo: Repository<ListeningTranscript>,

    @InjectRepository(ListeningQuestion)
    private readonly listeningQRepo: Repository<ListeningQuestion>,

    @InjectRepository(ListeningOption)
    private readonly listeningOptRepo: Repository<ListeningOption>,

    private readonly lessonsSvc: TeacherLessonsService,
  ) {}

  // ─── Grammar ─────────────────────────────────────────────────

  async getGrammarContents(lessonId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    return this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } });
  }

  async addGrammarContent(lessonId: string, pageName: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.grammarRepo.save(this.grammarRepo.create({ lessonId, pageName }));
    return { id: content.id, lessonId: content.lessonId, pageName: content.pageName };
  }

  async updateGrammarContent(lessonId: string, contentId: string, pageName: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.grammarRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Grammar content topilmadi');
    content.pageName = pageName;
    return this.grammarRepo.save(content);
  }

  async deleteGrammarContent(lessonId: string, contentId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.grammarRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Grammar content topilmadi');
    await this.grammarRepo.remove(content);
    return { message: "O'chirildi" };
  }

  // ─── Reading ─────────────────────────────────────────────────

  async getReadingContents(lessonId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    return this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } });
  }

  async addReadingContent(lessonId: string, dto: { title: string; textContent?: string; orderIndex?: number }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.save(
      this.readingRepo.create({
        lessonId,
        title: dto.title,
        textContent: dto.textContent ?? '',
        orderIndex: dto.orderIndex ?? 0,
      }),
    );
    return { id: content.id, title: content.title, textContent: content.textContent, orderIndex: content.orderIndex };
  }

  async saveReadingContent(lessonId: string, contentId: string, dto: Partial<{ title: string; textContent: string; orderIndex: number }>) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Reading content topilmadi');
    Object.assign(content, dto);
    if (dto.textContent !== undefined) {
      content.wordCount = dto.textContent.split(/\s+/).filter(Boolean).length;
    }
    const saved = await this.readingRepo.save(content);
    return { id: saved.id, title: saved.title, textContent: saved.textContent, wordCount: saved.wordCount, orderIndex: saved.orderIndex };
  }

  async deleteReadingContent(lessonId: string, contentId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Reading content topilmadi');
    await this.readingRepo.remove(content);
    return { message: "O'chirildi" };
  }

  async getReadingWithQuestions(lessonId: string, contentId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: contentId, lessonId }, relations: ['questions', 'questions.options'] });
    if (!content) throw new NotFoundException('Reading content topilmadi');
    return content;
  }

  async addReadingQuestion(lessonId: string, contentId: string, dto: { questionText: string; questionType: QuestionType; correctExplanation?: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.readingRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Reading content topilmadi');

    const count = await this.readingQRepo.count({ where: { readingId: contentId } });
    const q = await this.readingQRepo.save(this.readingQRepo.create({ readingId: contentId, ...dto, orderIndex: count }));
    return { id: q.id, questionText: q.questionText, questionType: q.questionType, correctExplanation: q.correctExplanation, orderIndex: q.orderIndex };
  }

  async updateReadingQuestion(lessonId: string, contentId: string, qId: string, dto: Partial<{ questionText: string; questionType: QuestionType; correctExplanation: string }>) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.readingQRepo.findOne({ where: { id: qId, readingId: contentId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    Object.assign(q, dto);
    return this.readingQRepo.save(q);
  }

  async deleteReadingQuestion(lessonId: string, contentId: string, qId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.readingQRepo.findOne({ where: { id: qId, readingId: contentId } });
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

  async deleteReadingOption(optionId: string) {
    const opt = await this.readingOptRepo.findOne({ where: { id: optionId } });
    if (!opt) throw new NotFoundException('Variant topilmadi');
    await this.readingOptRepo.remove(opt);
    return { message: "O'chirildi" };
  }

  // ─── Listening ───────────────────────────────────────────────

  async getListeningContents(lessonId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    return this.listeningRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } });
  }

  async addListeningContent(lessonId: string, dto: { title: string; fileId: string; durationSeconds?: number; speakerCount?: number; orderIndex?: number }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.save(this.listeningRepo.create({ lessonId, ...dto }));
    return { id: content.id, title: content.title, fileId: content.fileId, durationSeconds: content.durationSeconds, orderIndex: content.orderIndex };
  }

  async saveListeningContent(lessonId: string, contentId: string, dto: Partial<{ title: string; fileId: string; durationSeconds: number; speakerCount: number }>) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Listening content topilmadi');
    Object.assign(content, dto);
    const saved = await this.listeningRepo.save(content);
    return { id: saved.id, title: saved.title, fileId: saved.fileId, durationSeconds: saved.durationSeconds, speakerCount: saved.speakerCount };
  }

  async deleteListeningContent(lessonId: string, contentId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Listening content topilmadi');
    await this.listeningRepo.remove(content);
    return { message: "O'chirildi" };
  }

  async getListeningWithDetails(lessonId: string, contentId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({
      where: { id: contentId, lessonId },
      relations: ['transcripts', 'questions', 'questions.options'],
    });
    if (!content) throw new NotFoundException('Listening content topilmadi');
    return content;
  }

  async addTranscript(lessonId: string, contentId: string, dto: { speakerName?: string; timestampSec?: number; textContent: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Listening content topilmadi');
    const count = await this.transcriptRepo.count({ where: { listeningId: contentId } });
    return this.transcriptRepo.save(this.transcriptRepo.create({ listeningId: contentId, ...dto, orderIndex: count }));
  }

  async deleteTranscript(transcriptId: string) {
    const transcript = await this.transcriptRepo.findOne({ where: { id: transcriptId } });
    if (!transcript) throw new NotFoundException('Transcript topilmadi');
    await this.transcriptRepo.remove(transcript);
    return { message: "O'chirildi" };
  }

  async addListeningQuestion(lessonId: string, contentId: string, dto: { questionText: string; questionType: QuestionType; correctExplanation?: string }) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const content = await this.listeningRepo.findOne({ where: { id: contentId, lessonId } });
    if (!content) throw new NotFoundException('Listening content topilmadi');
    const count = await this.listeningQRepo.count({ where: { listeningId: contentId } });
    const q = await this.listeningQRepo.save(this.listeningQRepo.create({ listeningId: contentId, ...dto, orderIndex: count }));
    return { id: q.id, questionText: q.questionText, questionType: q.questionType, correctExplanation: q.correctExplanation, orderIndex: q.orderIndex };
  }

  async updateListeningQuestion(lessonId: string, contentId: string, qId: string, dto: Partial<{ questionText: string; questionType: QuestionType; correctExplanation: string }>) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.listeningQRepo.findOne({ where: { id: qId, listeningId: contentId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    Object.assign(q, dto);
    return this.listeningQRepo.save(q);
  }

  async deleteListeningQuestion(lessonId: string, contentId: string, qId: string) {
    await this.lessonsSvc.verifyLesson(lessonId);
    const q = await this.listeningQRepo.findOne({ where: { id: qId, listeningId: contentId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    await this.listeningQRepo.remove(q);
    return { message: "O'chirildi" };
  }

  async addListeningOption(qId: string, dto: { optionText: string; isCorrect: boolean }) {
    const q = await this.listeningQRepo.findOne({ where: { id: qId } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    const count = await this.listeningOptRepo.count({ where: { questionId: qId } });
    return this.listeningOptRepo.save(this.listeningOptRepo.create({ questionId: qId, ...dto, orderIndex: count }));
  }

  async deleteListeningOption(optionId: string) {
    const opt = await this.listeningOptRepo.findOne({ where: { id: optionId } });
    if (!opt) throw new NotFoundException('Variant topilmadi');
    await this.listeningOptRepo.remove(opt);
    return { message: "O'chirildi" };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/teacher-lesson.entity';
import { LessonBlock } from 'src/common/core/entitys/teacher-lesson-block.entity';
import { LessonVocab } from 'src/common/core/entitys/teacher-lesson-vocab.entity';
import { LessonVocabWord } from 'src/common/core/entitys/teacher-lesson-vocab-word.entity';
import { LessonReading } from 'src/common/core/entitys/teacher-lesson-reading.entity';
import { LessonReadingQuestion } from 'src/common/core/entitys/teacher-lesson-reading-question.entity';
import { LessonListening } from 'src/common/core/entitys/teacher-lesson-listening.entity';
import { LessonListeningQuestion } from 'src/common/core/entitys/teacher-lesson-listening-question.entity';
import { LessonSpeaking } from 'src/common/core/entitys/teacher-lesson-speaking.entity';
import { Grammar } from 'src/common/core/entitys/grammar.entity';
import { TeacherLessonsService } from './teacher-lessons.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { SaveVocabWordDto } from './dto/save-vocab-word.dto';
import { BulkImportDto } from './dto/bulk-import.dto';
import { SaveReadingDto } from './dto/save-reading.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SaveListeningDto } from './dto/save-listening.dto';
import { SaveSpeakingDto } from './dto/save-speaking.dto';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(LessonBlock)
    private readonly blockRepo: Repository<LessonBlock>,

    @InjectRepository(LessonVocab)
    private readonly vocabRepo: Repository<LessonVocab>,

    @InjectRepository(LessonVocabWord)
    private readonly vocabWordRepo: Repository<LessonVocabWord>,

    @InjectRepository(LessonReading)
    private readonly readingRepo: Repository<LessonReading>,

    @InjectRepository(LessonReadingQuestion)
    private readonly readingQRepo: Repository<LessonReadingQuestion>,

    @InjectRepository(LessonListening)
    private readonly listeningRepo: Repository<LessonListening>,

    @InjectRepository(LessonListeningQuestion)
    private readonly listeningQRepo: Repository<LessonListeningQuestion>,

    @InjectRepository(LessonSpeaking)
    private readonly speakingRepo: Repository<LessonSpeaking>,

    @InjectRepository(Grammar)
    private readonly grammarRepo: Repository<Grammar>,

    private readonly lessonsSvc: TeacherLessonsService,
  ) {}

  private async getBlock(lessonId: string, blockId: string): Promise<LessonBlock> {
    const block = await this.blockRepo.findOne({ where: { id: blockId } });
    if (!block || block.lessonId !== lessonId) throw new NotFoundException("Blok topilmadi");
    return block;
  }

  private async maxBlockOrder(lessonId: string): Promise<number> {
    const result = await this.blockRepo
      .createQueryBuilder('b')
      .where('b.lessonId = :lessonId', { lessonId })
      .select('MAX(b.order)', 'max')
      .getRawOne();
    return result?.max !== null ? Number(result.max) + 1 : 0;
  }

  async createBlock(lessonId: string, dto: CreateBlockDto, userId: string) {
    await this.lessonsSvc.verifyOwnership(lessonId, userId);
    const order = await this.maxBlockOrder(lessonId);
    const block = this.blockRepo.create({ lessonId, type: dto.type, order, grammarId: null });

    if (dto.type === 'grammar') {
      if (!dto.grammarId) throw new BadRequestException("grammarId majburiy");
      const grammar = await this.grammarRepo.findOne({ where: { id: dto.grammarId } });
      if (!grammar) throw new NotFoundException("Grammar topilmadi");
      block.grammarId = dto.grammarId;
    }

    const savedBlock = await this.blockRepo.save(block);

    if (dto.type === 'vocabulary') {
      await this.vocabRepo.save(this.vocabRepo.create({ blockId: savedBlock.id, exerciseTypes: ['variantli_test', 'yozib_yodlash', 'audio'] }));
    } else if (dto.type === 'reading') {
      await this.readingRepo.save(this.readingRepo.create({ blockId: savedBlock.id, title: '', text: '', highlights: [], wordCount: 0 }));
    } else if (dto.type === 'listening') {
      await this.listeningRepo.save(this.listeningRepo.create({ blockId: savedBlock.id, title: '', speakers: [], transcript: [] }));
    } else if (dto.type === 'speaking') {
      await this.speakingRepo.save(this.speakingRepo.create({ blockId: savedBlock.id, topics: [], examples: [] }));
    }

    const full = await this.blockRepo.findOne({ where: { id: savedBlock.id }, relations: ['vocabBlock', 'readingBlock', 'listeningBlock', 'speakingBlock'] });
    return { id: full!.id, type: full!.type, order: full!.order, grammarId: full!.grammarId, vocabBlock: full!.vocabBlock, readingBlock: full!.readingBlock, listeningBlock: full!.listeningBlock, speakingBlock: full!.speakingBlock };
  }

  async deleteBlock(lessonId: string, blockId: string, userId: string) {
    await this.lessonsSvc.verifyOwnership(lessonId, userId);
    const block = await this.getBlock(lessonId, blockId);
    await this.blockRepo.remove(block);
    return { message: "Blok o'chirildi" };
  }

  async reorderBlocks(lessonId: string, blockIds: string[], userId: string) {
    await this.lessonsSvc.verifyOwnership(lessonId, userId);
    const blocks = await this.blockRepo.find({ where: { lessonId } });
    if (blocks.length !== blockIds.length) throw new BadRequestException("blockIds soni mos emas");
    const blockMap = new Map(blocks.map((b) => [b.id, b]));
    for (const id of blockIds) {
      if (!blockMap.has(id)) throw new BadRequestException("Noto'g'ri blockId: " + id);
    }
    await Promise.all(blockIds.map((id, index) => { const b = blockMap.get(id)!; b.order = index; return this.blockRepo.save(b); }));
    return { message: "Tartib yangilandi" };
  }

  // ─── Vocabulary ──────────────────────────────────────────────
  private async getVocabBlock(lessonId: string, blockId: string): Promise<LessonVocab> {
    const block = await this.getBlock(lessonId, blockId);
    if (block.type !== 'vocabulary') throw new BadRequestException("Bu blok vocabulary emas");
    const vocab = await this.vocabRepo.findOne({ where: { blockId }, relations: ['words'] });
    if (!vocab) throw new NotFoundException("VocabBlock topilmadi");
    return vocab;
  }

  async getVocab(lessonId: string, blockId: string) {
    const vocab = await this.getVocabBlock(lessonId, blockId);
    const words = (vocab.words || []).sort((a, b) => a.order - b.order);
    return { id: vocab.id, exerciseTypes: vocab.exerciseTypes, wordsCount: words.length, words };
  }

  async addWord(lessonId: string, blockId: string, dto: SaveVocabWordDto) {
    const vocab = await this.getVocabBlock(lessonId, blockId);
    const words = await this.vocabWordRepo.find({ where: { vocabId: vocab.id } });
    const maxOrder = words.length ? Math.max(...words.map((w) => w.order)) + 1 : 0;
    const word = await this.vocabWordRepo.save(this.vocabWordRepo.create({ vocabId: vocab.id, ...dto, order: maxOrder }));
    return { id: word.id, word: word.word, translation: word.translation, ipa: word.ipa, partOfSpeech: word.partOfSpeech, topic: word.topic, exampleEn: word.exampleEn, exampleUz: word.exampleUz, order: word.order };
  }

  async updateWord(lessonId: string, blockId: string, wordId: string, dto: Partial<SaveVocabWordDto>) {
    const vocab = await this.getVocabBlock(lessonId, blockId);
    const word = await this.vocabWordRepo.findOne({ where: { id: wordId } });
    if (!word || word.vocabId !== vocab.id) throw new NotFoundException("So'z topilmadi");
    Object.assign(word, dto);
    return this.vocabWordRepo.save(word);
  }

  async deleteWord(lessonId: string, blockId: string, wordId: string) {
    const vocab = await this.getVocabBlock(lessonId, blockId);
    const word = await this.vocabWordRepo.findOne({ where: { id: wordId } });
    if (!word || word.vocabId !== vocab.id) throw new NotFoundException("So'z topilmadi");
    await this.vocabWordRepo.remove(word);
    return { message: "So'z o'chirildi" };
  }

  async bulkImportWords(lessonId: string, blockId: string, dto: BulkImportDto) {
    const vocab = await this.getVocabBlock(lessonId, blockId);
    const existing = await this.vocabWordRepo.find({ where: { vocabId: vocab.id } });
    let nextOrder = existing.length ? Math.max(...existing.map((w) => w.order)) + 1 : 0;
    const created: any[] = [];
    let skipped = 0;
    for (const line of dto.lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) { skipped++; continue; }
      const [word, translation, partOfSpeech] = parts;
      const saved = await this.vocabWordRepo.save(this.vocabWordRepo.create({ vocabId: vocab.id, word, translation, partOfSpeech: partOfSpeech || null, order: nextOrder++ }));
      created.push(saved);
    }
    return { imported: created.length, skipped, words: created };
  }

  async updateVocabSettings(lessonId: string, blockId: string, exerciseTypes: string[]) {
    const valid = ['variantli_test', 'yozib_yodlash', 'audio', 'flashcard'];
    for (const t of exerciseTypes) {
      if (!valid.includes(t)) throw new BadRequestException("Noto'g'ri exerciseType: " + t);
    }
    const vocab = await this.getVocabBlock(lessonId, blockId);
    vocab.exerciseTypes = exerciseTypes;
    await this.vocabRepo.save(vocab);
    return { exerciseTypes };
  }

  // ─── Reading ─────────────────────────────────────────────────
  private async getReading(lessonId: string, blockId: string): Promise<LessonReading> {
    const block = await this.getBlock(lessonId, blockId);
    if (block.type !== 'reading') throw new BadRequestException("Bu blok reading emas");
    const reading = await this.readingRepo.findOne({ where: { blockId }, relations: ['questions'] });
    if (!reading) throw new NotFoundException("ReadingBlock topilmadi");
    return reading;
  }

  async getReading_(lessonId: string, blockId: string) {
    const r = await this.getReading(lessonId, blockId);
    return { id: r.id, title: r.title, author: r.author, text: r.text, wordCount: r.wordCount, readTimeMinutes: r.readTimeMinutes, cefrLevel: r.cefrLevel, highlights: r.highlights, questions: (r.questions || []).sort((a, b) => a.order - b.order) };
  }

  async saveReading(lessonId: string, blockId: string, dto: SaveReadingDto) {
    const reading = await this.getReading(lessonId, blockId);
    Object.assign(reading, dto);
    if (dto.text !== undefined) reading.wordCount = dto.text.split(/\s+/).filter(Boolean).length;
    const saved = await this.readingRepo.save(reading);
    return { id: saved.id, title: saved.title, author: saved.author, text: saved.text, wordCount: saved.wordCount, readTimeMinutes: saved.readTimeMinutes, cefrLevel: saved.cefrLevel, highlights: saved.highlights };
  }

  async addReadingQuestion(lessonId: string, blockId: string, dto: CreateQuestionDto) {
    const reading = await this.getReading(lessonId, blockId);
    if (dto.type === 'mcq' && (!dto.options || dto.options.length < 2)) throw new BadRequestException("MCQ uchun kamida 2 ta variant kerak");
    const questions = await this.readingQRepo.find({ where: { readingId: reading.id } });
    const order = questions.length ? Math.max(...questions.map((q) => q.order)) + 1 : 0;
    const q = await this.readingQRepo.save(this.readingQRepo.create({ readingId: reading.id, ...dto, order }));
    return { id: q.id, type: q.type, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: q.order };
  }

  async updateReadingQuestion(lessonId: string, blockId: string, qId: string, dto: Partial<CreateQuestionDto>) {
    const reading = await this.getReading(lessonId, blockId);
    const q = await this.readingQRepo.findOne({ where: { id: qId } });
    if (!q || q.readingId !== reading.id) throw new NotFoundException("Savol topilmadi");
    Object.assign(q, dto);
    return this.readingQRepo.save(q);
  }

  async deleteReadingQuestion(lessonId: string, blockId: string, qId: string) {
    const reading = await this.getReading(lessonId, blockId);
    const q = await this.readingQRepo.findOne({ where: { id: qId } });
    if (!q || q.readingId !== reading.id) throw new NotFoundException("Savol topilmadi");
    await this.readingQRepo.remove(q);
    return { message: "Savol o'chirildi" };
  }

  // ─── Listening ───────────────────────────────────────────────
  private async getListening(lessonId: string, blockId: string): Promise<LessonListening> {
    const block = await this.getBlock(lessonId, blockId);
    if (block.type !== 'listening') throw new BadRequestException("Bu blok listening emas");
    const listening = await this.listeningRepo.findOne({ where: { blockId }, relations: ['questions'] });
    if (!listening) throw new NotFoundException("ListeningBlock topilmadi");
    return listening;
  }

  async getListening_(lessonId: string, blockId: string) {
    const l = await this.getListening(lessonId, blockId);
    return { id: l.id, title: l.title, audioUrl: l.audioUrl, duration: l.duration, trackCode: l.trackCode, speakers: l.speakers, transcript: l.transcript, questions: (l.questions || []).sort((a, b) => a.order - b.order) };
  }

  async saveListening(lessonId: string, blockId: string, dto: SaveListeningDto) {
    const listening = await this.getListening(lessonId, blockId);
    Object.assign(listening, dto);
    const saved = await this.listeningRepo.save(listening);
    return { id: saved.id, title: saved.title, audioUrl: saved.audioUrl, duration: saved.duration, trackCode: saved.trackCode, speakers: saved.speakers, transcript: saved.transcript };
  }

  async addListeningQuestion(lessonId: string, blockId: string, dto: CreateQuestionDto) {
    const listening = await this.getListening(lessonId, blockId);
    if (dto.type === 'mcq' && (!dto.options || dto.options.length < 2)) throw new BadRequestException("MCQ uchun kamida 2 ta variant kerak");
    const questions = await this.listeningQRepo.find({ where: { listeningId: listening.id } });
    const order = questions.length ? Math.max(...questions.map((q) => q.order)) + 1 : 0;
    const q = await this.listeningQRepo.save(this.listeningQRepo.create({ listeningId: listening.id, ...dto, order }));
    return { id: q.id, type: q.type, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: q.order };
  }

  async updateListeningQuestion(lessonId: string, blockId: string, qId: string, dto: Partial<CreateQuestionDto>) {
    const listening = await this.getListening(lessonId, blockId);
    const q = await this.listeningQRepo.findOne({ where: { id: qId } });
    if (!q || q.listeningId !== listening.id) throw new NotFoundException("Savol topilmadi");
    Object.assign(q, dto);
    return this.listeningQRepo.save(q);
  }

  async deleteListeningQuestion(lessonId: string, blockId: string, qId: string) {
    const listening = await this.getListening(lessonId, blockId);
    const q = await this.listeningQRepo.findOne({ where: { id: qId } });
    if (!q || q.listeningId !== listening.id) throw new NotFoundException("Savol topilmadi");
    await this.listeningQRepo.remove(q);
    return { message: "Savol o'chirildi" };
  }

  // ─── Speaking ────────────────────────────────────────────────
  private async getSpeaking(lessonId: string, blockId: string): Promise<LessonSpeaking> {
    const block = await this.getBlock(lessonId, blockId);
    if (block.type !== 'speaking') throw new BadRequestException("Bu blok speaking emas");
    const speaking = await this.speakingRepo.findOne({ where: { blockId } });
    if (!speaking) throw new NotFoundException("SpeakingBlock topilmadi");
    return speaking;
  }

  async getSpeaking_(lessonId: string, blockId: string) {
    const s = await this.getSpeaking(lessonId, blockId);
    return { id: s.id, title: s.title, instructions: s.instructions, topics: s.topics, examples: s.examples, durationMinutes: s.durationMinutes };
  }

  async saveSpeaking(lessonId: string, blockId: string, dto: SaveSpeakingDto) {
    const speaking = await this.getSpeaking(lessonId, blockId);
    Object.assign(speaking, dto);
    const saved = await this.speakingRepo.save(speaking);
    return { id: saved.id, title: saved.title, instructions: saved.instructions, topics: saved.topics, examples: saved.examples, durationMinutes: saved.durationMinutes };
  }
}

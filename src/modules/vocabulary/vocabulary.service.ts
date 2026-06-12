import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { VocabStatus, CefrLevel, PartOfSpeech } from 'src/common/utils/enum';

@Injectable()
export class VocabularyService {
  constructor(
    @InjectRepository(Vocabulary)
    private readonly wordRepo: Repository<Vocabulary>,

    @InjectRepository(UserVocabularyProgress)
    private readonly progressRepo: Repository<UserVocabularyProgress>,
  ) {}

  async create(dto: { word: string; uzbekTranslation?: string; example?: string; lang?: string }): Promise<Vocabulary> {
    const existing = await this.wordRepo.findOne({ where: { word: dto.word } });
    if (existing) return existing;

    const word = this.wordRepo.create({
      word: dto.word,
      uzbekTranslation: dto.uzbekTranslation ?? '',
      example: dto.example,
      lang: dto.lang ?? 'en',
    });
    return this.wordRepo.save(word);
  }

  async importFromText(rawText: string) {
    if (!rawText?.trim()) return [];

    const lines = rawText
      .split(/\n|·/)
      .map((l) => l.trim())
      .filter(Boolean);

    const results: Vocabulary[] = [];
    for (const line of lines) {
      const full = line.match(/(.+?)\s*\/(.+?)\/\s*[-–]\s*(.+)/);
      const simple = line.match(/(.+?)\s*[-–]\s*(.+)/);

      if (full) {
        const [, eng, _ipa, uz] = full;
        results.push(await this.create({ word: eng.trim(), uzbekTranslation: uz.trim(), example: _ipa.trim() }));
      } else if (simple) {
        const [, eng, uz] = simple;
        results.push(await this.create({ word: eng.trim(), uzbekTranslation: uz.trim() }));
      }
    }
    return results;
  }

  async findAll(filters?: { topic?: string; cefrLevel?: string; lang?: string }) {
    const where: any = {};
    if (filters?.topic) where.topic = filters.topic;
    if (filters?.cefrLevel) where.cefrLevel = filters.cefrLevel;
    if (filters?.lang) where.lang = filters.lang;
    return this.wordRepo.find({ where, order: { orderIndex: 'ASC' } });
  }

  async findVocabularyPairs() {
    const words = await this.wordRepo.find({ order: { orderIndex: 'ASC' } });
    return words.map((w) => ({
      id: w.id,
      vocabulary_id: w.id,
      vocabulary_word: w.word,
      translation_word: w.uzbekTranslation,
    }));
  }

  async generateVocabularyQuiz() {
    const words = await this.wordRepo.find();
    return words.map((w) => {
      const others = words.filter((x) => x.id !== w.id).sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [w.uzbekTranslation, ...others.map((o) => o.uzbekTranslation)].sort(() => 0.5 - Math.random());
      return {
        vocabulary_id: w.id,
        question: `"${w.word}" so'zining tarjimasi qaysi?`,
        options,
        correct: w.uzbekTranslation,
        lang: w.lang,
      };
    });
  }

  async getVocabularyForStudent(userId: string, filters: { cefrLevel?: string; topic?: string; status?: string }) {
    const where: any = {};
    if (filters.cefrLevel) where.cefrLevel = filters.cefrLevel;
    if (filters.topic) where.topic = filters.topic;

    const words = await this.wordRepo.find({ where, order: { orderIndex: 'ASC' } });

    const progressList = words.length
      ? await this.progressRepo.find({ where: { userId } })
      : [];

    const progressMap = new Map(progressList.map((p) => [p.vocabularyId, p]));

    const result = words
      .map((w) => {
        const prog = progressMap.get(w.id);
        const status = prog?.status ?? VocabStatus.new;
        if (filters.status && filters.status !== status) return null;
        return {
          id: w.id,
          word: w.word,
          uzbekTranslation: w.uzbekTranslation,
          ipa: w.ipa,
          pos: w.pos,
          example: w.example,
          cefrLevel: w.cefrLevel,
          topic: w.topic,
          status,
          strength: prog?.strength ?? 0,
          nextReviewAt: prog?.nextReviewAt ?? null,
        };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);

    const stats = {
      total: result.length,
      mastered: result.filter((w) => w.status === VocabStatus.mastered).length,
      learning: result.filter((w) => w.status === VocabStatus.learning).length,
      new: result.filter((w) => w.status === VocabStatus.new).length,
    };

    return { words: result, stats };
  }

  async reviewWord(userId: string, wordId: string, quality: number) {
    const word = await this.wordRepo.findOne({ where: { id: wordId } });
    if (!word) throw new NotFoundException("So'z topilmadi");

    let progress = await this.progressRepo.findOne({ where: { userId, vocabularyId: wordId } });
    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        vocabularyId: wordId,
        status: VocabStatus.new,
        strength: 0,
        attempts: 0,
        wrongAttempts: 0,
      });
    }

    const q = Math.max(0, Math.min(5, quality));
    progress.attempts += 1;

    if (q >= 3) {
      progress.strength = Math.min(100, progress.strength + (q >= 4 ? 15 : 10));
    } else {
      progress.strength = Math.max(0, progress.strength - 20);
      progress.wrongAttempts += 1;
    }

    // Strength asosida keyingi takrorlash vaqti
    const daysUntilReview = progress.strength < 20 ? 1 : progress.strength < 50 ? 3 : progress.strength < 80 ? 7 : 14;
    progress.nextReviewAt = new Date(Date.now() + daysUntilReview * 86400000);
    progress.lastReviewedAt = new Date();

    // Status yangilash
    progress.status = progress.strength >= 80
      ? VocabStatus.mastered
      : progress.strength > 0
      ? VocabStatus.learning
      : VocabStatus.new;

    await this.progressRepo.save(progress);

    return {
      nextReviewAt: progress.nextReviewAt.toISOString(),
      xpEarned: q >= 4 ? 10 : 5,
      status: progress.status,
      strength: progress.strength,
    };
  }
}

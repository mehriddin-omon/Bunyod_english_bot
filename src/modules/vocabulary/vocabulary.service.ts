import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { VocabularyWord, VocabularyReview } from 'src/common/core/entitys/vocabulary.entity';
import { VocabStatus, CefrLevel, PartOfSpeech } from 'src/common/utils/enum';

@Injectable()
export class VocabularyService {
  constructor(
    @InjectRepository(VocabularyWord)
    private readonly wordRepo: Repository<VocabularyWord>,

    @InjectRepository(VocabularyReview)
    private readonly reviewRepo: Repository<VocabularyReview>,
  ) {}

  async create(dto: { word: string; translation?: string; example?: string; lang?: string }): Promise<VocabularyWord> {
    const existing = await this.wordRepo.findOne({ where: { word: dto.word } });
    if (existing) return existing;

    const word = this.wordRepo.create({
      word: dto.word,
      translation: dto.translation ?? '',
      example: dto.example,
    });
    return this.wordRepo.save(word);
  }

  async importFromText(rawText: string, _lessonId?: string) {
    if (!rawText?.trim()) return [];

    const lines = rawText
      .split(/\n|·/)
      .map((l) => l.trim())
      .filter(Boolean);

    const results: VocabularyWord[] = [];
    for (const line of lines) {
      const full = line.match(/(.+?)\s*\/(.+?)\/\s*[-–]\s*(.+)/);
      const simple = line.match(/(.+?)\s*[-–]\s*(.+)/);

      if (full) {
        const [, eng, _transcription, uz] = full;
        results.push(await this.create({ word: eng.trim(), translation: uz.trim(), example: _transcription.trim() }));
      } else if (simple) {
        const [, eng, uz] = simple;
        results.push(await this.create({ word: eng.trim(), translation: uz.trim() }));
      }
    }
    return results;
  }

  async findAllWithTranslations(): Promise<VocabularyWord[]> {
    return this.wordRepo.find({ order: { created_at: 'ASC' } });
  }

  async findVocabularyPairs() {
    const words = await this.wordRepo.find({ order: { created_at: 'ASC' } });
    return words.map((w) => ({
      id: w.id,
      vocabulary_id: w.id,
      vocabulary_word: w.word,
      translation_word: w.translation,
    }));
  }

  async generateVocabularyQuiz() {
    const words = await this.wordRepo.find();
    return words.map((w) => {
      const others = words.filter((x) => x.id !== w.id).sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [w.translation, ...others.map((o) => o.translation)].sort(() => 0.5 - Math.random());
      return {
        vocabulary_relation_id: w.id,
        question: `"${w.word}" so'zining tarjimasi qaysi?`,
        options,
        correct: w.translation,
        lang: 'en',
      };
    });
  }

  async getVocabularyForStudent(userId: string, filters: { unitId?: string; cefrLevel?: string; status?: string }) {
    const where: any = {};
    if (filters.unitId) where.unitId = filters.unitId;
    if (filters.cefrLevel) where.cefrLevel = filters.cefrLevel;

    const words = await this.wordRepo.find({ where });

    const reviews = words.length
      ? await this.reviewRepo.find({ where: { userId, wordId: In(words.map((w) => w.id)) } })
      : [];

    const reviewMap = new Map(reviews.map((r) => [r.wordId, r]));

    const mappedWords = words
      .map((w) => {
        const review = reviewMap.get(w.id);
        const status = review?.status ?? VocabStatus.new;
        if (filters.status && filters.status !== status) return null;
        return {
          id: w.id,
          word: w.word,
          translation: w.translation,
          example: w.example,
          cefrLevel: w.cefrLevel,
          status,
          nextReviewAt: review?.nextReviewAt ?? null,
        };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);

    const stats = {
      total: mappedWords.length,
      learned: mappedWords.filter((w) => w.status === VocabStatus.mastered).length,
      reviewing: mappedWords.filter((w) => w.status === VocabStatus.learning).length,
      new: mappedWords.filter((w) => w.status === VocabStatus.new).length,
    };

    return { words: mappedWords, stats };
  }

  async reviewWord(userId: string, wordId: string, quality: number) {
    const word = await this.wordRepo.findOne({ where: { id: wordId } });
    if (!word) throw new NotFoundException("So'z topilmadi");

    let review = await this.reviewRepo.findOne({ where: { userId, wordId } });
    if (!review) {
      review = this.reviewRepo.create({
        userId,
        wordId,
        status: VocabStatus.new,
        repetitions: 0,
        easeFactor: 2.5,
        interval: 1,
      });
    }

    // SM-2 algorithm
    const q = Math.max(0, Math.min(5, quality));
    review.easeFactor = Math.max(1.3, review.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

    if (q < 3) {
      review.repetitions = 0;
      review.interval = 1;
    } else {
      review.repetitions += 1;
      if (review.repetitions === 1) review.interval = 1;
      else if (review.repetitions === 2) review.interval = 6;
      else review.interval = Math.round(review.interval * review.easeFactor);
    }

    review.nextReviewAt = new Date(Date.now() + review.interval * 86400000);
    review.lastReviewAt = new Date();
    review.status = review.repetitions >= 5 ? VocabStatus.mastered : VocabStatus.learning;

    await this.reviewRepo.save(review);

    return {
      nextReviewAt: review.nextReviewAt.toISOString(),
      xpEarned: q >= 4 ? 10 : 5,
      status: review.status,
    };
  }
}

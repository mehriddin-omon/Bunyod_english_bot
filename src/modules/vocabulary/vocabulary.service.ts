import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyRelation } from 'src/common/core/entitys/vocabulary-relation.entity';
import { VocabularyExample } from 'src/common/core/entitys/vocabulary-example.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { VocabularyPracticeLog, PracticeMode } from 'src/common/core/entitys/vocabulary-practice-log.entity';
import { VocabularySession } from 'src/common/core/entitys/vocabulary-session.entity';
import { TtsService } from './tts.service';
import { VocabStatus } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { SessionFilter, SessionMode } from './dto';

// ── SRS constants ─────────────────────────────────────────────────────────────
const MASTERED_MIN_ATTEMPTS   = 5;
const MASTERED_MAX_ERROR_RATE = 0.2;
const OVERDUE_MS              = 14 * 86_400_000;
const REVIEW_MS_GOOD          = 7 * 86_400_000;
const REVIEW_MS_OK            = 3 * 86_400_000;
const REVIEW_MS_FAIL          = 1 * 86_400_000;

function computeVocabStatus(attempts: number, errorRate: number): VocabStatus {
  return attempts >= MASTERED_MIN_ATTEMPTS && errorRate < MASTERED_MAX_ERROR_RATE
    ? VocabStatus.mastered
    : VocabStatus.learning;
}

@Injectable()
export class VocabularyService {
  constructor(
    @InjectRepository(Vocabulary)
    private readonly wordRepo: Repository<Vocabulary>,

    @InjectRepository(VocabularyRelation)
    private readonly pairRepo: Repository<VocabularyRelation>,

    @InjectRepository(VocabularyExample)
    private readonly exampleRepo: Repository<VocabularyExample>,

    @InjectRepository(UserVocabularyProgress)
    private readonly progressRepo: Repository<UserVocabularyProgress>,

    @InjectRepository(VocabularyPracticeLog)
    private readonly logRepo: Repository<VocabularyPracticeLog>,

    @InjectRepository(VocabularySession)
    private readonly sessionRepo: Repository<VocabularySession>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    private readonly ttsService: TtsService,
  ) {}

  // ─── Teacher: word / pair CRUD ──────────────────────────────────────────────

  async createWord(data: { word: string; lang: string; ipa?: string; pos?: string; lessonId?: string }) {
    const maxOrder = await this.wordRepo
      .createQueryBuilder('v')
      .select('MAX(v.order_index)', 'max')
      .where(data.lessonId ? 'v.lesson_id = :lessonId' : 'v.lesson_id IS NULL', { lessonId: data.lessonId })
      .getRawOne();
    const orderIndex = parseInt(maxOrder?.max ?? '0', 10) + 1;

    const word = this.wordRepo.create({
      word: data.word.trim(),
      lang: data.lang,
      ipa: data.ipa ?? null,
      pos: (data.pos as any) ?? null,
      lessonId: data.lessonId ?? null,
      orderIndex,
    });
    const saved = await this.wordRepo.save(word);

    // Fire-and-forget: TTS response should not block the HTTP response
    if (data.lang === 'en') {
      this.ttsService.generate(saved.word).then((voiceFileId) => {
        if (voiceFileId) this.wordRepo.update(saved.id, { voiceFileId });
      });
    }

    return saved;
  }

  async createPair(data: { vocabularyId: string; translationId: string }) {
    const [src, trg] = await Promise.all([
      this.wordRepo.findOne({ where: { id: data.vocabularyId } }),
      this.wordRepo.findOne({ where: { id: data.translationId } }),
    ]);
    if (!src) throw new BadRequestException('vocabularyId topilmadi');
    if (!trg) throw new BadRequestException('translationId topilmadi');

    const pair = this.pairRepo.create({
      vocabularyId: data.vocabularyId,
      translationId: data.translationId,
      attempts: 0,
      wrongAttempts: 0,
      difficulty: 0,
    });
    const saved = await this.pairRepo.save(pair);
    return {
      pairId: saved.id,
      vocabularyId: saved.vocabularyId,
      translationId: saved.translationId,
      word: src.word,
      translation: trg.word,
      ipa: src.ipa,
      pos: src.pos,
      attempts: 0,
      wrongAttempts: 0,
      difficulty: 0,
    };
  }

  async updateWord(wordId: string, data: { word?: string; ipa?: string; pos?: string; imageUrl?: string }) {
    const word = await this.wordRepo.findOne({ where: { id: wordId } });
    if (!word) throw new NotFoundException('So\'z topilmadi');

    const wordChanged = data.word !== undefined && data.word.trim() !== word.word;

    if (data.word     !== undefined) word.word     = data.word.trim();
    if (data.ipa      !== undefined) word.ipa      = data.ipa.trim() || null;
    if (data.pos      !== undefined) word.pos      = (data.pos as any) || null;
    if (data.imageUrl !== undefined) word.imageUrl = data.imageUrl.trim() || null;
    const saved = await this.wordRepo.save(word);

    const needsTts = word.lang === 'en' && (wordChanged || !saved.voiceFileId);
    if (needsTts) {
      this.ttsService.generate(saved.word).then((voiceFileId) => {
        if (voiceFileId) this.wordRepo.update(saved.id, { voiceFileId });
      });
    }

    return saved;
  }

  async deletePair(pairId: string) {
    const pair = await this.pairRepo.findOne({ where: { id: pairId } });
    if (!pair) throw new NotFoundException('Juft topilmadi');

    const { vocabularyId, translationId } = pair;

    await this.progressRepo.delete({ pairId });
    await this.pairRepo.remove(pair);

    // Parallel orphan-check: delete word only if it has no other pairs
    await Promise.all([
      this.pairRepo.count({ where: { vocabularyId } }).then((n) => {
        if (n === 0) return this.wordRepo.delete(vocabularyId);
      }),
      this.pairRepo.count({ where: { translationId } }).then((n) => {
        if (n === 0) return this.wordRepo.delete(translationId);
      }),
    ]);
  }

  async upsertExamples(pairId: string, examples: { englishText: string; uzbekText?: string; highlightWord?: string }[]) {
    const pair = await this.pairRepo.findOne({ where: { id: pairId } });
    if (!pair) throw new NotFoundException('Juft topilmadi');
    await this.exampleRepo.delete({ pairId });
    if (!examples.length) return [];
    const entities = examples.map((ex, i) =>
      this.exampleRepo.create({
        pairId,
        englishText: ex.englishText.trim(),
        uzbekText:   ex.uzbekText?.trim()    || null,
        highlightWord: ex.highlightWord?.trim() || null,
        orderIndex: i,
      })
    );
    return this.exampleRepo.save(entities);
  }

  // ─── Teacher: pairs for lesson ──────────────────────────────────────────────

  async getPairsForLesson(lessonId: string) {
    const words = await this.wordRepo.find({ where: { lessonId, lang: 'en' }, order: { orderIndex: 'ASC' } });
    const wordIds = words.map((w) => w.id);
    if (!wordIds.length) return [];

    const pairs = await this.pairRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.vocabulary', 'src')
      .leftJoinAndSelect('r.translation', 'trg')
      .where('r.vocabulary_id IN (:...ids)', { ids: wordIds })
      .getMany();

    return pairs.map((p) => ({
      pairId:        p.id,
      vocabularyId:  p.vocabularyId,
      translationId: p.translationId,
      word:          p.vocabulary.word,
      ipa:           p.vocabulary.ipa,
      pos:           p.vocabulary.pos,
      imageUrl:      p.vocabulary.imageUrl,
      translation:   p.translation.word,
      attempts:      p.attempts,
      wrongAttempts: p.wrongAttempts,
      difficulty:    p.difficulty,
    }));
  }

  // ─── Pair detail (teacher edit + student word card) ─────────────────────────

  async getPairDetail(pairId: string, userId?: string) {
    const pair = await this.pairRepo.findOne({
      where: { id: pairId },
      relations: ['vocabulary', 'vocabulary.synonyms', 'vocabulary.antonyms', 'translation'],
    });
    if (!pair) throw new NotFoundException('Juft topilmadi');

    const [examples, progress] = await Promise.all([
      this.exampleRepo.find({ where: { pairId }, order: { orderIndex: 'ASC' } }),
      userId ? this.progressRepo.findOne({ where: { userId, pairId } }) : null,
    ]);

    return {
      pairId:        pair.id,
      vocabularyId:  pair.vocabularyId,
      translationId: pair.translationId,
      word:          pair.vocabulary.word,
      ipa:           pair.vocabulary.ipa,
      pos:           pair.vocabulary.pos,
      imageUrl:      pair.vocabulary.imageUrl,
      voiceFileId:   pair.vocabulary.voiceFileId,
      translation:   pair.translation.word,
      difficulty:    pair.difficulty,
      attempts:      pair.attempts,
      wrongAttempts: pair.wrongAttempts,
      synonyms:  (pair.vocabulary.synonyms  ?? []).map((s) => s.word),
      antonyms:  (pair.vocabulary.antonyms  ?? []).map((a) => a.word),
      examples:  examples.map((e) => ({
        id:            e.id,
        englishText:   e.englishText,
        uzbekText:     e.uzbekText,
        highlightWord: e.highlightWord,
        orderIndex:    e.orderIndex,
      })),
      userProgress: progress ? {
        status:        progress.status,
        attempts:      progress.attempts,
        wrongAttempts: progress.wrongAttempts,
        nextReviewAt:  progress.nextReviewAt?.toISOString() ?? null,
      } : null,
    };
  }

  // ─── Student: lessons vocabulary summary ───────────────────────────────────

  async getLessonsSummary(userId: string) {
    const rows = await this.wordRepo
      .createQueryBuilder('v')
      .select('DISTINCT v.lesson_id', 'lessonId')
      .where('v.lang = :lang', { lang: 'en' })
      .andWhere('v.lesson_id IS NOT NULL')
      .getRawMany();

    const lessonIds: string[] = rows.map((r) => r.lessonId).filter(Boolean);
    if (!lessonIds.length) return [];

    const [lessons, allWords] = await Promise.all([
      this.lessonRepo.find({ where: { id: In(lessonIds) }, relations: ['unit'], order: { unitId: 'ASC', orderIndex: 'ASC' } }),
      this.wordRepo.find({ where: { lang: 'en', lessonId: In(lessonIds) } }),
    ]);

    const wordsByLesson = new Map<string, string[]>();
    for (const w of allWords) {
      if (!w.lessonId) continue;
      if (!wordsByLesson.has(w.lessonId)) wordsByLesson.set(w.lessonId, []);
      wordsByLesson.get(w.lessonId)!.push(w.id);
    }

    const allWordIds = allWords.map((w) => w.id);
    const allPairs = allWordIds.length
      ? await this.pairRepo.find({ where: { vocabularyId: In(allWordIds) } })
      : [];

    const pairByWordId = new Map(allPairs.map((p) => [p.vocabularyId, p.id]));

    const pairIds = allPairs.map((p) => p.id);
    const progressList = pairIds.length
      ? await this.progressRepo.find({ where: { userId, pairId: In(pairIds) } })
      : [];
    const progressMap = new Map(progressList.map((p) => [p.pairId, p]));

    return lessons.map((lesson) => {
      const wordIds    = wordsByLesson.get(lesson.id) ?? [];
      const totalPairs = wordIds.map((wid) => pairByWordId.get(wid)).filter(Boolean).length;

      let mastered = 0;
      let learning = 0;
      for (const wid of wordIds) {
        const pairId = pairByWordId.get(wid);
        if (!pairId) continue;
        const status = progressMap.get(pairId)?.status;
        if (status === VocabStatus.mastered) mastered++;
        else if (status === VocabStatus.learning) learning++;
      }

      return {
        lessonId:        lesson.id,
        lessonName:      lesson.lessonName,
        unitNumber:      lesson.unit?.number ?? null,
        cefrLevel:       lesson.cefrLevel,
        orderIndex:      lesson.orderIndex,
        totalPairs,
        mastered,
        learning,
        newCount:        totalPairs - mastered - learning,
        progressPercent: totalPairs > 0 ? Math.round((mastered / totalPairs) * 100) : 0,
      };
    });
  }

  // ─── Student: vocabulary list ───────────────────────────────────────────────

  async getStudentVocabulary(userId: string, filters: { lessonId?: string; status?: string }) {
    const where: any = { lang: 'en' };
    if (filters.lessonId) where.lessonId = filters.lessonId;

    const words = await this.wordRepo.find({ where, order: { orderIndex: 'ASC' } });
    const wordIds = words.map((w) => w.id);
    if (!wordIds.length) return { pairs: [], stats: { total: 0, mastered: 0, learning: 0, new: 0, hard: 0, dueToday: 0 } };

    const pairs = await this.pairRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.vocabulary', 'src')
      .leftJoinAndSelect('r.translation', 'trg')
      .where('r.vocabulary_id IN (:...ids)', { ids: wordIds })
      .getMany();

    const progressList = await this.progressRepo.find({ where: { userId } });
    const progressMap  = new Map(progressList.map((p) => [p.pairId, p]));
    const now = new Date();

    // Build lesson order map only when needed (no lessonId filter = multiple lessons)
    const lessonOrderMap = new Map<string, number>();
    if (!filters.lessonId) {
      const lessonIds = [...new Set(words.map((w) => w.lessonId).filter((id): id is string => !!id))];
      if (lessonIds.length) {
        const lessons = await this.lessonRepo.find({ where: { id: In(lessonIds) } });
        for (const lesson of lessons) lessonOrderMap.set(lesson.id, lesson.orderIndex);
      }
    }
    const wordMetaMap = new Map(words.map((w) => [
      w.id,
      { lessonOrder: lessonOrderMap.get(w.lessonId ?? '') ?? 0, wordOrder: w.orderIndex },
    ]));

    // Sort keys stored separately — avoids polluting the output shape
    type SortKey = { status: VocabStatus; lessonOrder: number; wordOrder: number; pairCreatedAt: Date; nextReviewAt: Date | null; lastReviewedAt: Date | null };
    const sortKeys = new Map<string, SortKey>();

    const result = pairs
      .filter((pair) => {
        const status = progressMap.get(pair.id)?.status ?? VocabStatus.new;
        if (filters.status && filters.status !== status) return false;
        const prog = progressMap.get(pair.id);
        const meta = wordMetaMap.get(pair.vocabularyId);
        sortKeys.set(pair.id, {
          status,
          lessonOrder:    meta?.lessonOrder ?? 0,
          wordOrder:      meta?.wordOrder   ?? 0,
          pairCreatedAt:  pair.createdAt,
          nextReviewAt:   prog?.nextReviewAt  ?? null,
          lastReviewedAt: prog?.updatedAt     ?? null,
        });
        return true;
      })
      .map((pair) => {
        const prog = progressMap.get(pair.id);
        return {
          pairId:        pair.id,
          word:          pair.vocabulary.word,
          translation:   pair.translation.word,
          ipa:           pair.vocabulary.ipa,
          pos:           pair.vocabulary.pos,
          imageUrl:      pair.vocabulary.imageUrl,
          voiceFileId:   pair.vocabulary.voiceFileId,
          status:        prog?.status ?? VocabStatus.new,
          attempts:      prog?.attempts      ?? 0,
          wrongAttempts: prog?.wrongAttempts ?? 0,
          nextReviewAt:  prog?.nextReviewAt  ?? null,
          isDueToday:    prog?.nextReviewAt ? prog.nextReviewAt <= now : false,
        };
      });

    const STATUS_ORDER: Record<string, number> = {
      [VocabStatus.new]:      0,
      [VocabStatus.learning]: 1,
      [VocabStatus.mastered]: 2,
    };

    result.sort((a, b) => {
      const ka = sortKeys.get(a.pairId)!;
      const kb = sortKeys.get(b.pairId)!;
      const sa = STATUS_ORDER[ka.status] ?? 3;
      const sb = STATUS_ORDER[kb.status] ?? 3;
      if (sa !== sb) return sa - sb;

      if (ka.status === VocabStatus.new) {
        if (ka.lessonOrder !== kb.lessonOrder) return ka.lessonOrder - kb.lessonOrder;
        if (ka.wordOrder   !== kb.wordOrder)   return ka.wordOrder   - kb.wordOrder;
        return ka.pairCreatedAt.getTime() - kb.pairCreatedAt.getTime();
      }

      if (ka.status === VocabStatus.learning) {
        if (!ka.nextReviewAt && !kb.nextReviewAt) return 0;
        if (!ka.nextReviewAt) return 1;
        if (!kb.nextReviewAt) return -1;
        return ka.nextReviewAt.getTime() - kb.nextReviewAt.getTime();
      }

      // mastered: lastReviewedAt DESC
      if (!ka.lastReviewedAt && !kb.lastReviewedAt) return 0;
      if (!ka.lastReviewedAt) return 1;
      if (!kb.lastReviewedAt) return -1;
      return kb.lastReviewedAt.getTime() - ka.lastReviewedAt.getTime();
    });

    const stats = {
      total:    result.length,
      mastered: result.filter((p) => p.status === VocabStatus.mastered).length,
      learning: result.filter((p) => p.status === VocabStatus.learning).length,
      new:      result.filter((p) => p.status === VocabStatus.new).length,
      hard:     result.filter((p) => p.wrongAttempts > p.attempts / 2 && p.attempts > 0).length,
      dueToday: result.filter((p) => p.isDueToday).length,
    };

    return { pairs: result, stats };
  }

  // ─── Student: dashboard stats ───────────────────────────────────────────────

  async getStudentStats(userId: string) {
    const [total, progressList] = await Promise.all([
      this.pairRepo.count(),
      this.progressRepo.find({ where: { userId } }),
    ]);

    const now = new Date();
    const mastered = progressList.filter((p) => p.status === VocabStatus.mastered).length;
    const learning = progressList.filter((p) => p.status === VocabStatus.learning).length;
    const hard     = progressList.filter((p) => p.wrongAttempts > p.attempts / 2 && p.attempts > 0).length;
    const dueToday = progressList.filter((p) => p.nextReviewAt && p.nextReviewAt <= now).length;
    const overdue  = progressList.filter((p) => p.nextReviewAt && now.getTime() - p.nextReviewAt.getTime() > OVERDUE_MS).length;

    return { total, mastered, learning, new: total - mastered - learning, hard, dueToday, overdue };
  }

  // ─── Student: vocabulary home (current lesson + due/overdue) ───────────────

  async getVocabularyHome(userId: string, lessonId?: string) {
    const now          = new Date();
    const selectedIds: string[] = [];
    const idSet        = new Set<string>();

    // Part 1: current lesson vocab (order_index asc, max 30)
    if (lessonId) {
      const rows: { id: string }[] = await this.pairRepo
        .createQueryBuilder('r')
        .select('r.id', 'id')
        .innerJoin('r.vocabulary', 'src')
        .where('src.lang = :lang AND src.lesson_id = :lessonId', { lang: 'en', lessonId })
        .orderBy('src.order_index', 'ASC')
        .limit(30)
        .getRawMany();

      for (const row of rows) {
        if (!idSet.has(row.id)) { idSet.add(row.id); selectedIds.push(row.id); }
      }
    }

    // Part 2: due/overdue from other lessons (mastered emas, vaqti kelgan)
    const remaining = 50 - selectedIds.length;
    if (remaining > 0) {
      const dueQb = this.pairRepo
        .createQueryBuilder('r')
        .select('r.id', 'id')
        .innerJoin('r.vocabulary', 'src')
        .innerJoin(
          'user_vocabulary_progress',
          'uvp',
          'uvp.pair_id = r.id AND uvp.user_id = :userId',
          { userId },
        )
        .where('src.lang = :lang', { lang: 'en' })
        .andWhere('uvp.status != :mastered', { mastered: VocabStatus.mastered })
        .andWhere('uvp.next_review_at <= :now', { now });

      if (lessonId) {
        dueQb.andWhere('(src.lesson_id IS NULL OR src.lesson_id != :lessonId)', { lessonId });
      }

      const dueRows: { id: string }[] = await dueQb
        .orderBy('uvp.next_review_at', 'ASC')
        .limit(remaining)
        .getRawMany();

      for (const row of dueRows) {
        if (!idSet.has(row.id)) { idSet.add(row.id); selectedIds.push(row.id); }
      }
    }

    if (!selectedIds.length) return { total: 0, pairs: [] };

    // Full data faqat tanlangan ID lar uchun (2 parallel query)
    const [pairs, progressList] = await Promise.all([
      this.pairRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.vocabulary', 'src')
        .leftJoinAndSelect('r.translation', 'trg')
        .where('r.id IN (:...ids)', { ids: selectedIds })
        .getMany(),
      this.progressRepo.find({ where: { userId, pairId: In(selectedIds) } }),
    ]);

    const pairMap     = new Map(pairs.map((p) => [p.id, p]));
    const progressMap = new Map(progressList.map((p) => [p.pairId, p]));

    const result = selectedIds
      .map((id) => pairMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((pair) => {
        const prog = progressMap.get(pair.id);
        return {
          pairId:        pair.id,
          word:          pair.vocabulary.word,
          translation:   pair.translation.word,
          ipa:           pair.vocabulary.ipa,
          pos:           pair.vocabulary.pos,
          imageUrl:      pair.vocabulary.imageUrl,
          voiceFileId:   pair.vocabulary.voiceFileId,
          status:        prog?.status        ?? VocabStatus.new,
          isDueToday:    prog?.nextReviewAt ? prog.nextReviewAt <= now : false,
          nextReviewAt:  prog?.nextReviewAt  ?? null,
          attempts:      prog?.attempts      ?? 0,
          wrongAttempts: prog?.wrongAttempts ?? 0,
        };
      });

    return { total: result.length, pairs: result };
  }

  // ─── Student: start session ─────────────────────────────────────────────────

  async startSession(userId: string, params: {
    filter: SessionFilter;
    mode: SessionMode;
    lessonId?: string;
    status?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit ?? 20, 50);
    const now   = new Date();
    const overdueCutoff = new Date(now.getTime() - OVERDUE_MS);

    // ── Step 1: filtered + random IDs at DB level (light query) ──────────────
    const idQb = this.pairRepo
      .createQueryBuilder('r')
      .select('r.id', 'id')
      .innerJoin('r.vocabulary', 'src')
      .leftJoin(
        'user_vocabulary_progress',
        'uvp',
        'uvp.pair_id = r.id AND uvp.user_id = :userId',
        { userId },
      )
      .where('src.lang = :lang', { lang: 'en' });

    if (params.lessonId) {
      idQb.andWhere('src.lesson_id = :lessonId', { lessonId: params.lessonId });
    }

    switch (params.filter) {
      case 'new':
        idQb.andWhere('uvp.id IS NULL');
        break;
      case 'today':
        idQb.andWhere('uvp.next_review_at IS NOT NULL AND uvp.next_review_at <= :now', { now });
        break;
      case 'hard':
        idQb.andWhere('uvp.attempts > 0 AND uvp.wrong_attempts > uvp.attempts / 2.0');
        break;
      case 'overdue':
        idQb.andWhere('uvp.next_review_at < :cutoff', { cutoff: overdueCutoff });
        break;
      case 'custom':
        if (params.status) {
          if (params.status === VocabStatus.new) {
            idQb.andWhere('uvp.id IS NULL');
          } else {
            idQb.andWhere('uvp.status = :status', { status: params.status });
          }
        }
        break;
    }

    const rawIds: { id: string }[] = await idQb.orderBy('RANDOM()').limit(limit).getRawMany();
    const selectedIds = rawIds.map((r) => r.id);
    if (!selectedIds.length) return { sessionId: null, totalCards: 0, cards: [] };

    // ── Step 2: load full data only for selected pairs (4 parallel queries) ──
    const [pairs, progressList, examples, distractors] = await Promise.all([
      this.pairRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.vocabulary', 'src')
        .leftJoinAndSelect('src.synonyms', 'syn')
        .leftJoinAndSelect('src.antonyms', 'ant')
        .leftJoinAndSelect('r.translation', 'trg')
        .where('r.id IN (:...ids)', { ids: selectedIds })
        .getMany(),

      this.progressRepo.find({ where: { userId, pairId: In(selectedIds) } }),

      this.exampleRepo.find({ where: { pairId: In(selectedIds) }, order: { orderIndex: 'ASC' } }),

      // 100 random distractor words — not 7000
      this.wordRepo
        .createQueryBuilder('w')
        .select('w.word', 'word')
        .where('w.lang = :lang', { lang: 'uz' })
        .orderBy('RANDOM()')
        .limit(100)
        .getRawMany<{ word: string }>(),
    ]);

    // preserve ORDER BY RANDOM() order from step 1
    const idOrder = new Map(selectedIds.map((id, i) => [id, i]));
    pairs.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    const progressMap  = new Map(progressList.map((p) => [p.pairId, p]));
    const exampleMap   = new Map<string, typeof examples>();
    for (const ex of examples) {
      if (!exampleMap.has(ex.pairId)) exampleMap.set(ex.pairId, []);
      exampleMap.get(ex.pairId)!.push(ex);
    }
    const distractorPool = distractors.map((d) => d.word);

    const MODES: SessionMode[] = ['flashcard', 'multiple_choice', 'typing', 'audio'];

    const cards = pairs.map((pair) => {
      const prog     = progressMap.get(pair.id);
      const hasAudio = !!pair.vocabulary.voiceFileId;

      let cardMode = params.mode === 'mixed'
        ? MODES[Math.floor(Math.random() * MODES.length)]
        : params.mode;

      // audio modeni faqat audio fayli bor so'zlar uchun ishlatish
      if (cardMode === 'audio' && !hasAudio) {
        cardMode = 'multiple_choice';
      }

      const needsOptions = cardMode === 'multiple_choice' || cardMode === 'audio';
      const options = needsOptions
        ? [
            ...distractorPool
              .filter((w) => w !== pair.translation.word)
              .sort(() => Math.random() - 0.5)
              .slice(0, 3),
            pair.translation.word,
          ].sort(() => Math.random() - 0.5)
        : null;

      return {
        pairId:      pair.id,
        word:        pair.vocabulary.word,
        ipa:         pair.vocabulary.ipa,
        pos:         pair.vocabulary.pos,
        imageUrl:    pair.vocabulary.imageUrl,
        voiceFileId: pair.vocabulary.voiceFileId,
        translation: pair.translation.word,
        synonyms:    (pair.vocabulary.synonyms  ?? []).map((s) => s.word),
        antonyms:    (pair.vocabulary.antonyms  ?? []).map((a) => a.word),
        examples:    (exampleMap.get(pair.id) ?? []).map((e) => ({
          englishText:   e.englishText,
          uzbekText:     e.uzbekText,
          highlightWord: e.highlightWord,
        })),
        mode:       cardMode,
        options,
        userStatus: prog?.status ?? VocabStatus.new,
        attempts:   prog?.attempts ?? 0,
      };
    });

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({ userId, completedCount: 0, timeSpentSec: 0 }),
    );

    return { sessionId: session.id, totalCards: cards.length, cards };
  }

  // ─── Internal: batch-process answers (used by submitSession + reviewPair) ───

  private async _processAnswers(
    userId: string,
    answers: { pairId: string; correct: boolean; mode?: PracticeMode }[],
    sessionId?: string,
  ) {
    const pairIds = answers.map((a) => a.pairId);

    // Batch load — avoids N+1
    const [pairs, existingProgress] = await Promise.all([
      this.pairRepo.find({ where: { id: In(pairIds) } }),
      this.progressRepo.find({ where: { userId, pairId: In(pairIds) } }),
    ]);

    const pairMap     = new Map(pairs.map((p) => [p.id, p]));
    const progressMap = new Map(existingProgress.map((p) => [p.pairId, p]));

    const updatedProgress: UserVocabularyProgress[] = [];
    const updatedPairs: VocabularyRelation[]        = [];
    const newLogs: VocabularyPracticeLog[]          = [];

    let totalXp    = 0;
    let correct    = 0;
    let masteredNew = 0;

    for (const ans of answers) {
      const pair = pairMap.get(ans.pairId);
      if (!pair) continue;

      let progress = progressMap.get(ans.pairId);
      if (!progress) {
        progress = this.progressRepo.create({
          userId, pairId: ans.pairId, status: VocabStatus.new, attempts: 0, wrongAttempts: 0,
        });
      }

      progress.attempts += 1;
      if (!ans.correct) progress.wrongAttempts += 1;

      const errorRate = progress.wrongAttempts / progress.attempts;
      progress.nextReviewAt = new Date(Date.now() + (ans.correct ? (errorRate < 0.2 ? REVIEW_MS_GOOD : REVIEW_MS_OK) : REVIEW_MS_FAIL));

      const wasMastered = progress.status === VocabStatus.mastered;
      progress.status   = computeVocabStatus(progress.attempts, errorRate);
      if (progress.status === VocabStatus.mastered && !wasMastered) masteredNew++;

      pair.attempts     += 1;
      if (!ans.correct) pair.wrongAttempts += 1;
      pair.difficulty    = pair.attempts > 0 ? pair.wrongAttempts / pair.attempts : 0;

      updatedProgress.push(progress);
      updatedPairs.push(pair);
      newLogs.push(this.logRepo.create({
        sessionId: sessionId ?? null,
        pairId:    ans.pairId,
        mode:      ans.mode ?? 'flashcard',
        correct:   ans.correct,
      }));

      if (ans.correct) { correct++; totalXp += 10; } else { totalXp += 3; }
    }

    // Batch save — 3 queries instead of 5N
    await Promise.all([
      this.progressRepo.save(updatedProgress),
      this.pairRepo.save(updatedPairs),
      this.logRepo.save(newLogs),
    ]);

    return { totalCards: answers.length, correct, wrong: answers.length - correct, xpEarned: totalXp, masteredNew, updatedProgress };
  }

  // ─── Student: submit session answers ────────────────────────────────────────

  async submitSession(
    userId: string,
    answers: { pairId: string; correct: boolean; mode?: PracticeMode }[],
    sessionId?: string,
    timeSpentSec?: number,
  ) {
    const { totalCards, correct, wrong, xpEarned, masteredNew } = await this._processAnswers(userId, answers, sessionId);

    if (sessionId) {
      await this.sessionRepo.update({ id: sessionId, userId }, { completedCount: answers.length, timeSpentSec: timeSpentSec ?? 0 });
    }

    return { totalCards, correct, wrong, xpEarned, masteredNew };
  }

  // ─── Student: review single pair (SRS) ──────────────────────────────────────

  async reviewPair(userId: string, pairId: string, correct: boolean) {
    const { xpEarned, updatedProgress } = await this._processAnswers(userId, [{ pairId, correct }]);
    const progress = updatedProgress[0];
    return {
      status:       progress?.status ?? VocabStatus.learning,
      nextReviewAt: progress?.nextReviewAt?.toISOString() ?? null,
      xpEarned,
    };
  }

  // ─── Teacher: student analytics ─────────────────────────────────────────────

  async getStudentAnalytics(studentId: string, lessonId?: string) {
    const where: any = { lang: 'en' };
    if (lessonId) where.lessonId = lessonId;
    const words   = await this.wordRepo.find({ where });
    const wordIds = words.map((w) => w.id);

    const pairs = wordIds.length
      ? await this.pairRepo
          .createQueryBuilder('r')
          .leftJoinAndSelect('r.vocabulary', 'src')
          .leftJoinAndSelect('r.translation', 'trg')
          .where('r.vocabulary_id IN (:...ids)', { ids: wordIds })
          .getMany()
      : [];
    const pairIds = pairs.map((p) => p.id);

    const [progressList, logs] = await Promise.all([
      pairIds.length
        ? this.progressRepo.find({ where: { userId: studentId, pairId: In(pairIds) } })
        : Promise.resolve([]),
      pairIds.length
        ? this.logRepo
            .createQueryBuilder('l')
            .innerJoin('vocabulary_sessions', 's', 's.id = l.session_id AND s.user_id = :studentId AND s.created_at >= :since', { studentId, since: new Date(Date.now() - 30 * 86_400_000) })
            .where('l.pair_id IN (:...pairIds)', { pairIds })
            .orderBy('l.id', 'DESC')
            .getMany()
        : Promise.resolve([]),
    ]);

    const progressMap = new Map(progressList.map((p) => [p.pairId, p]));

    const MODES: PracticeMode[] = ['flashcard', 'multiple_choice', 'typing', 'audio'];
    const byMode: Record<string, { attempts: number; correct: number; accuracy: number }> = {};
    for (const mode of MODES) {
      const modeLogs    = logs.filter((l) => l.mode === mode);
      const modeCorrect = modeLogs.filter((l) => l.correct).length;
      byMode[mode] = {
        attempts: modeLogs.length,
        correct:  modeCorrect,
        accuracy: modeLogs.length > 0 ? Math.round((modeCorrect / modeLogs.length) * 100) : 0,
      };
    }

    const hardWords = pairs
      .flatMap((p) => {
        const prog = progressMap.get(p.id);
        if (!prog || prog.attempts === 0) return [];
        const accuracy = Math.round(((prog.attempts - prog.wrongAttempts) / prog.attempts) * 100);
        if (accuracy >= 50) return [];
        return [{ pairId: p.id, word: p.vocabulary.word, translation: p.translation.word, attempts: prog.attempts, wrongAttempts: prog.wrongAttempts, accuracy }];
      })
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10);

    const pairMap    = new Map(pairs.map((p) => [p.id, p]));
    const recentLogs = logs.slice(0, 20).map((l) => {
      const pair = pairMap.get(l.pairId);
      return {
        pairId:      l.pairId,
        word:        pair?.vocabulary?.word ?? '—',
        translation: pair?.translation?.word ?? '—',
        mode:        l.mode,
        correct:     l.correct,
      };
    });

    const mastered = progressList.filter((p) => p.status === VocabStatus.mastered).length;
    const learning = progressList.filter((p) => p.status === VocabStatus.learning).length;

    return {
      summary: {
        totalPairs: pairs.length,
        mastered,
        learning,
        new:        pairs.length - mastered - learning,
        totalLogs:  logs.length,
        byMode,
      },
      hardWords,
      recentLogs,
    };
  }

  // ─── Student: daily session stats ───────────────────────────────────────────

  async getDailySessionStats(userId: string, date?: string) {
    const day = date ? new Date(date) : new Date();
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.created_at >= :start', { start: startOfDay })
      .andWhere('s.created_at <= :end', { end: endOfDay })
      .orderBy('s.created_at', 'ASC')
      .getMany();

    if (!sessions.length) {
      return { date: startOfDay.toISOString().slice(0, 10), sessionCount: 0, totalCards: 0, totalCorrect: 0, totalWrong: 0, totalDurationSec: 0, avgDurationSec: 0, sessions: [] };
    }

    const sessionIds = sessions.map((s) => s.id);
    const logs = await this.logRepo.find({ where: { sessionId: In(sessionIds) } });

    const logsBySession = new Map<string, VocabularyPracticeLog[]>();
    for (const log of logs) {
      if (!log.sessionId) continue;
      const bucket = logsBySession.get(log.sessionId) ?? [];
      bucket.push(log);
      logsBySession.set(log.sessionId, bucket);
    }

    const sessionList = sessions.map((s) => {
      const sessionLogs  = logsBySession.get(s.id) ?? [];
      const correctCount = sessionLogs.filter((l) => l.correct).length;
      return {
        sessionId:    s.id,
        totalCards:   s.completedCount,
        correctCount,
        wrongCount:   s.completedCount - correctCount,
        accuracy:     s.completedCount > 0 ? Math.round((correctCount / s.completedCount) * 100) : 0,
        durationSec:  s.timeSpentSec,
      };
    });

    const totalDurationSec = sessionList.reduce((sum, s) => sum + s.durationSec, 0);
    const totalCards       = sessionList.reduce((sum, s) => sum + s.totalCards, 0);
    const totalCorrect     = sessionList.reduce((sum, s) => sum + s.correctCount, 0);

    return {
      date:           startOfDay.toISOString().slice(0, 10),
      sessionCount:   sessions.length,
      totalCards,
      totalCorrect,
      totalWrong:     totalCards - totalCorrect,
      totalDurationSec,
      avgDurationSec: sessions.length > 0 ? Math.round(totalDurationSec / sessions.length) : 0,
      sessions:       sessionList,
    };
  }

  // ─── Admin: TTS yo'q so'zlar uchun qayta generatsiya ────────────────────────

  async regenerateMissingTts(): Promise<{ total: number; success: number; failed: number }> {
    const words = await this.wordRepo.find({
      where: { lang: 'en', voiceFileId: IsNull() },
    });

    let success = 0;
    let failed  = 0;

    for (const word of words) {
      const voiceFileId = await this.ttsService.generate(word.word);
      if (voiceFileId) {
        await this.wordRepo.update(word.id, { voiceFileId });
        success++;
      } else {
        failed++;
      }
    }

    return { total: words.length, success, failed };
  }
}

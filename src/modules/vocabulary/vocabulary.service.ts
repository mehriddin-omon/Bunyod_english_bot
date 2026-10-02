import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyRelation } from 'src/common/core/entitys/vocabulary-relation.entity';
import { VocabularyExample } from 'src/common/core/entitys/vocabulary-example.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { VocabularyPracticeLog, PracticeMode } from 'src/common/core/entitys/vocabulary-practice-log.entity';
import { VocabularySession } from 'src/common/core/entitys/vocabulary-session.entity';
import { VocabularyStageProgress } from 'src/common/core/entitys/vocabulary-stage-progress.entity';
import { TtsService } from './tts.service';
import { VocabStatus } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { SessionFilter, SessionMode } from './dto';
import { XpService } from '../gamification/xp.service';

// ── SRS constants ─────────────────────────────────────────────────────────────
const OVERDUE_MS              = 14 * 86_400_000;
const REVIEW_MS_GOOD          = 7 * 86_400_000;
const REVIEW_MS_OK            = 3 * 86_400_000;
const REVIEW_MS_FAIL          = 1 * 86_400_000;

/**
 * TAYYORLOV rejimlaridan keyingi holat.
 *
 * Qoida (2026-09): so'z "mustahkam" (mastered) holatiga FAQAT coinli sinov
 * orqali o'tadi (`VocabularyCoinTestService`). Tayyorlov rejimlari (flashcard,
 * variantli, yozib, audio, aralash) so'zni faqat `new → learning` ga o'tkazadi;
 * allaqachon mustahkam bo'lgan so'z esa tayyorlovda tushirilmaydi ham.
 *
 * Eski qoida (5 urinish, xato < 20% → mastered) bekor qilindi —
 * MASTERED_MIN_ATTEMPTS / MASTERED_MAX_ERROR_RATE endi ishlatilmaydi.
 */
/**
 * LUG'AT BOSQICHLARI (2026-09 qarori).
 *
 * Rejim tanlash (flashcard / variantli / yozib / audio / aralash) olib
 * tashlandi. Dars lug'ati 4 ta KETMA-KET bosqichda yodlanadi; har bosqich
 * dars lug'atidagi HAMMA so'zni so'raydi. Keyingi bosqich oldingisi
 * o'tilgandan keyin ochiladi (qulf serverda tekshiriladi):
 *   1 — oddiy karta:      oxirigacha ko'rib chiqilsa o'tildi (passPercent 0)
 *   2 — variantli test:   80%+
 *   3 — eshitib topish:   80%+ (talaffuzi yo'q so'z variantliga tushadi)
 *   4 — yozib yodlash:    80%+
 *
 * Bosqichlar TAYYORLOV — coin bermaydi. Coin faqat "Coinli sinov"da.
 */
export const VOCAB_STAGES: { stage: number; mode: PracticeMode; passPercent: number }[] = [
  { stage: 1, mode: 'flashcard',       passPercent: 0 },
  { stage: 2, mode: 'multiple_choice', passPercent: 80 },
  { stage: 3, mode: 'audio',           passPercent: 80 },
  { stage: 4, mode: 'typing',          passPercent: 80 },
];

/** "new,learning" → ['new','learning'] (noma'lum qiymatlar tashlanadi) */
function parseStatuses(raw?: string): VocabStatus[] {
  if (!raw) return [];
  const valid = new Set<string>(Object.values(VocabStatus));
  return [...new Set(raw.split(',').map((x) => x.trim()).filter((x) => valid.has(x)))] as VocabStatus[];
}

/**
 * Tavsiya etilgan to'plam qoidasi — `getStudentStats` va `startSession`
 * dagi SQL bilan bir xil bo'lishi SHART (son, ro'yxat, test mos kelsin).
 */
function matchesPreset(
  preset: SessionFilter,
  prog: { attempts: number; wrongAttempts: number; nextReviewAt: Date | null; status: VocabStatus } | undefined,
  nowMs: number,
): boolean {
  switch (preset) {
    case 'new':     return !prog || prog.status === VocabStatus.new;
    case 'today':   return !!prog?.nextReviewAt && prog.nextReviewAt.getTime() <= nowMs;
    case 'overdue': return !!prog?.nextReviewAt && nowMs - prog.nextReviewAt.getTime() > OVERDUE_MS;
    case 'hard':    return !!prog && prog.attempts > 0 && prog.wrongAttempts > prog.attempts / 2;
    default:        return true;
  }
}

function computeVocabStatus(current: VocabStatus | undefined): VocabStatus {
  return current === VocabStatus.mastered ? VocabStatus.mastered : VocabStatus.learning;
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

    @InjectRepository(VocabularyStageProgress)
    private readonly stageRepo: Repository<VocabularyStageProgress>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    private readonly ttsService: TtsService,

    // Coin berish faqat shu servis orqali — daftarga yozilmagan XP yo'q
    private readonly xpService: XpService,
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

  /**
   * Talabaning lug'at ro'yxati (Lug'at → Asosiy, filtr bilan).
   *
   * Filtrlar (hammasi ixtiyoriy, birga ishlaydi):
   *   - `lessonId`  — bitta mavzu (dars);
   *   - `sectionId` — butun bo'lim (unit) darslari; `lessonId` bo'lsa e'tiborsiz;
   *   - `status`    — vergul bilan bir nechta: "new,learning";
   *   - `preset`    — tavsiya etilgan to'plam (hard/overdue/today/new). Qoidalar
   *                   `getStudentStats` va `startSession` bilan AYNAN bir xil —
   *                   filtr oynasidagi son, ro'yxat va test bir-biriga mos kelsin.
   */
  async getStudentVocabulary(userId: string, filters: {
    lessonId?: string;
    sectionId?: string;
    status?: string;
    preset?: string;
  }) {
    const empty = { pairs: [], stats: { total: 0, mastered: 0, learning: 0, new: 0, hard: 0, dueToday: 0, overdue: 0 } };
    const where: any = { lang: 'en' };
    if (filters.lessonId) {
      where.lessonId = filters.lessonId;
    } else if (filters.sectionId) {
      // Bo'lim id si dars id si emas — avval bo'lim darslari olinadi
      const lessons = await this.lessonRepo.find({ where: { unitId: filters.sectionId }, select: { id: true } });
      if (!lessons.length) return empty;
      where.lessonId = In(lessons.map((l) => l.id));
    }
    const statuses = parseStatuses(filters.status);
    const preset   = filters.preset as SessionFilter | undefined;

    const words = await this.wordRepo.find({ where, order: { orderIndex: 'ASC' } });
    const wordIds = words.map((w) => w.id);
    if (!wordIds.length) return empty;

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
    const nowMs = now.getTime();
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
        const prog   = progressMap.get(pair.id);
        const status = prog?.status ?? VocabStatus.new;
        if (statuses.length && !statuses.includes(status)) return false;
        if (preset && !matchesPreset(preset, prog, nowMs)) return false;
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
      overdue:  result.filter((p) => !!p.nextReviewAt && nowMs - p.nextReviewAt.getTime() > OVERDUE_MS).length,
    };

    return { pairs: result, stats };
  }

  // ─── Student: dashboard stats ───────────────────────────────────────────────

  async getStudentStats(userId: string) {
    // Faqat inglizcha so'z juftlari — ro'yxat (`getStudentVocabulary`) ham
    // aynan shularni ko'rsatadi, filtr kartasidagi son ro'yxat bilan mos kelsin
    const [total, progressList] = await Promise.all([
      this.pairRepo
        .createQueryBuilder('r')
        .innerJoin('r.vocabulary', 'src')
        .where('src.lang = :lang', { lang: 'en' })
        .getCount(),
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
    mode?: SessionMode;
    stage?: number;
    lessonId?: string;
    sectionId?: string;
    status?: string;
    limit?: number;
  }) {
    // ── Bosqichli sessiya: tur bosqichdan, so'zlar — dars lug'ati to'liq ────
    const stageDef = params.stage ? VOCAB_STAGES.find((st) => st.stage === params.stage) : undefined;
    if (params.stage && !stageDef) throw new BadRequestException("Noto'g'ri bosqich");
    if (stageDef) {
      if (!params.lessonId) throw new BadRequestException('Bosqich uchun lessonId kerak');
      if (stageDef.stage > 1) {
        const prev = await this.stageRepo.findOne({
          where: { userId, lessonId: params.lessonId, stage: stageDef.stage - 1 },
        });
        if (!prev?.passed) {
          throw new ForbiddenException(`Avval ${stageDef.stage - 1}-bosqichni o'ting`);
        }
      }
      params = { ...params, mode: stageDef.mode, filter: 'custom', status: undefined, sectionId: undefined, limit: 200 };
    }
    if (!params.mode) throw new BadRequestException('Rejim (mode) yoki bosqich (stage) kerak');
    const mode: SessionMode = params.mode;

    // 50 lik chegara darsdagi so'zlar sonidan kichik bo'lib qolardi (70 ta
    // so'zli darsda sessiya umuman boshlanmasdi) — endi 200 tagacha
    const limit = Math.min(params.limit ?? 20, 200);
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
    } else if (params.sectionId) {
      // Bo'lim (unit) bo'yicha — bo'limdagi hamma darslar lug'ati
      idQb.andWhere('src.lesson_id IN (SELECT l.id FROM lessons l WHERE l.unit_id = :sectionId)', {
        sectionId: params.sectionId,
      });
    }

    switch (params.filter) {
      case 'new':
        idQb.andWhere("(uvp.id IS NULL OR uvp.status = 'new')");
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
      case 'custom': {
        // Bir nechta status (vergul bilan): "new,learning"
        const statuses = parseStatuses(params.status);
        if (statuses.length) {
          const others = statuses.filter((st) => st !== VocabStatus.new);
          const conds: string[] = [];
          if (statuses.includes(VocabStatus.new)) conds.push("uvp.id IS NULL OR uvp.status = 'new'");
          if (others.length) conds.push('uvp.status IN (:...statuses)');
          idQb.andWhere(`(${conds.join(' OR ')})`, { statuses: others });
        }
        break;
      }
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

    const cards = pairs.map((pair) => {
      const prog     = progressMap.get(pair.id);
      const hasAudio = !!pair.vocabulary.voiceFileId;

      let cardMode: SessionMode = mode;

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
      this.sessionRepo.create({
        userId,
        completedCount: 0,
        timeSpentSec:   0,
        lessonId:       stageDef ? params.lessonId! : null,
        stage:          stageDef?.stage ?? null,
        totalCards:     cards.length,
      }),
    );

    return { sessionId: session.id, stage: stageDef?.stage ?? null, totalCards: cards.length, cards };
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

    let correct = 0;

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

      // Tayyorlov: faqat new → learning. Mustahkam holat coinli sinovda beriladi.
      progress.status = computeVocabStatus(progress.status);

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

      if (ans.correct) correct++;
    }

    // Batch save — 3 queries instead of 5N
    await Promise.all([
      this.progressRepo.save(updatedProgress),
      this.pairRepo.save(updatedPairs),
      this.logRepo.save(newLogs),
    ]);

    /**
     * TAYYORLOV REJIMLARI COIN BERMAYDI (2026-09 qarori).
     *
     * Lug'at coini faqat COINLI SINOVDA beriladi (`VocabularyCoinTestService`):
     * dars lug'atidagi hamma so'z 10 soniyalik taymer bilan so'raladi, coin
     * urinish raqami va foizga qarab hisoblanadi. Flashcard / variantli / yozib
     * / audio / aralash — sinovga tayyorlanish uchun; ular so'zni faqat
     * "o'rganilmoqda" holatiga o'tkazadi. Shu sababli `xpEarned` = 0 va
     * `masteredNew` = 0 — ilova natija ekranida buni izoh bilan ko'rsatadi.
     *
     * Faollik esa qayd etiladi — streak uzilmasin.
     */
    if (answers.length) await this.xpService.touchActivity(userId);

    return { totalCards: answers.length, correct, wrong: answers.length - correct, xpEarned: 0, masteredNew: 0, updatedProgress };
  }

  // ─── Student: submit session answers ────────────────────────────────────────

  async submitSession(
    userId: string,
    answers: { pairId: string; correct: boolean; mode?: PracticeMode }[],
    sessionId?: string,
    timeSpentSec?: number,
  ) {
    // Sessiya submitdan OLDIN o'qiladi: completedCount > 0 bo'lsa bu takroriy
    // yuborish — bosqich urinishi ikki marta sanalmasin
    const session = sessionId
      ? await this.sessionRepo.findOne({ where: { id: sessionId, userId } })
      : null;

    const { totalCards, correct, wrong, xpEarned, masteredNew } = await this._processAnswers(userId, answers, sessionId);

    if (sessionId) {
      await this.sessionRepo.update({ id: sessionId, userId }, { completedCount: answers.length, timeSpentSec: timeSpentSec ?? 0 });
    }

    const stage = session?.stage && session.lessonId && session.completedCount === 0
      ? await this._recordStageResult(userId, session, answers)
      : null;

    return { totalCards, correct, wrong, xpEarned, masteredNew, stage };
  }

  // ─── Student: lug'at bosqichlari ────────────────────────────────────────────

  /**
   * Bosqich natijasini yozadi. Foiz server tomonda sessiyada berilgan
   * kartalar soniga (`session.totalCards`) nisbatan hisoblanadi — so'z bo'yicha
   * oxirgi javob olinadi, bir so'zni takror yuborib foizni oshirib bo'lmaydi.
   */
  private async _recordStageResult(
    userId: string,
    session: VocabularySession,
    answers: { pairId: string; correct: boolean }[],
  ) {
    const def = VOCAB_STAGES.find((st) => st.stage === session.stage);
    if (!def || !session.lessonId) return null;

    const byPair = new Map<string, boolean>();
    for (const a of answers) byPair.set(a.pairId, a.correct);
    const total      = Math.max(session.totalCards, 1);
    const answered   = Math.min(byPair.size, total);
    const correctCnt = [...byPair.values()].filter(Boolean).length;
    const percent    = Math.min(100, Math.round((correctCnt / total) * 100));
    const completed  = answered >= total;
    const passedNow  = completed && percent >= def.passPercent;

    let row = await this.stageRepo.findOne({
      where: { userId, lessonId: session.lessonId, stage: def.stage },
    });
    if (!row) {
      row = this.stageRepo.create({
        userId, lessonId: session.lessonId, stage: def.stage,
        attempts: 0, lastPercent: 0, bestPercent: 0, passed: false, passedAt: null,
      });
    }
    const wasPassed = row.passed;
    row.attempts   += 1;
    row.lastPercent = percent;
    row.bestPercent = Math.max(row.bestPercent, percent);
    if (passedNow && !row.passed) {
      row.passed   = true;
      row.passedAt = new Date();
    }
    await this.stageRepo.save(row);

    const next = VOCAB_STAGES.find((st) => st.stage === def.stage + 1);
    return {
      stage:       def.stage,
      mode:        def.mode,
      passPercent: def.passPercent,
      percent,
      completed,
      passed:      row.passed,
      justPassed:  row.passed && !wasPassed,
      nextStage:   next && row.passed ? next.stage : null,
    };
  }

  /** GET /vocabulary/stages?lessonId= — bosqichlar holati (qulf, foiz, o'tildi) */
  async getStages(userId: string, lessonId: string) {
    const [rows, totalWords] = await Promise.all([
      this.stageRepo.find({ where: { userId, lessonId } }),
      this.pairRepo
        .createQueryBuilder('r')
        .innerJoin('r.vocabulary', 'src')
        .where('src.lessonId = :lessonId', { lessonId })
        .andWhere('src.lang = :lang', { lang: 'en' })
        .getCount(),
    ]);
    const byStage = new Map(rows.map((r) => [r.stage, r]));

    let prevPassed = true;
    const stages = VOCAB_STAGES.map((def) => {
      const row      = byStage.get(def.stage);
      const unlocked = prevPassed;
      prevPassed     = !!row?.passed;
      return {
        stage:       def.stage,
        mode:        def.mode,
        passPercent: def.passPercent,
        unlocked,
        passed:      !!row?.passed,
        attempts:    row?.attempts ?? 0,
        lastPercent: row?.lastPercent ?? null,
        bestPercent: row?.bestPercent ?? null,
      };
    });

    // Joriy bosqich — birinchi o'tilmagan ochiq bosqich (hammasi o'tilgan bo'lsa null)
    const current = stages.find((st) => st.unlocked && !st.passed)?.stage ?? null;
    return { lessonId, totalWords, currentStage: current, allPassed: current === null, stages };
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

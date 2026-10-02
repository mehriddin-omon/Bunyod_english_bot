import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { ListeningTranscript } from 'src/common/core/entitys/listening-transcript.entity';
import { QuizContent } from 'src/common/core/entitys/quiz-content.entity';
import { Exercise } from 'src/common/core/entitys/exercise.entity';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { XpTransaction } from 'src/common/core/entitys/gamification.entity';
import { LessonProgressStatus, LessonStatus, Role, StudentAnswerBlockType, XpSource } from 'src/common/utils/enum';

/** Dars-oldi ekranidagi bo'lim turlari (ilova tablari bilan bir xil) */
export type SectionType = 'grammar' | 'reading' | 'listening' | 'quiz' | 'vocabulary';

/** Bir bo'limdagi statik mashqlar: nechtasi ishlangan va jami nechta */
type SectionProgress = { done: number; total: number };

/**
 * Grammar bo'limining bajarilish ulushi (0–1).
 *
 * Statik mashqlar bor bo'lsa — ishlangan/jami. Aks holda eski xatti-harakat:
 * `grammarScore` yozilgan bo'lsa 1, yo'q bo'lsa 0.
 */
function grammarRatio(
  progress: LessonProgress | undefined,
  exercises: SectionProgress | undefined,
): number {
  if (exercises && exercises.total > 0) return Math.min(1, exercises.done / exercises.total);
  return progress?.grammarScore != null ? 1 : 0;
}

/**
 * Lug'at bo'limining bajarilish ulushi (0–1).
 *
 * `vocabulary_score` hech qayerda yozilmaydi (lug'atda "topshirish" yo'q),
 * shuning uchun ilgari bu bo'lim dars yakunlanmaguncha doim 0% turardi. Endi
 * o'lchov — darsdagi juftliklardan nechtasi kamida bir marta mashq qilingan
 * (`user_vocabulary_progress.status <> 'new'`). Ilova darsni avto-yakunlashda
 * ham aynan shu qoidani ishlatadi (`stats.new === 0`).
 */
function vocabularyRatio(
  progress: LessonProgress | undefined,
  vocab: SectionProgress | undefined,
): number {
  if (vocab && vocab.total > 0) return Math.min(1, vocab.done / vocab.total);
  return progress?.vocabularyScore != null ? 1 : 0;
}

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,

    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(GrammarContent)
    private readonly grammarRepo: Repository<GrammarContent>,

    @InjectRepository(ReadingContent)
    private readonly readingRepo: Repository<ReadingContent>,

    @InjectRepository(ListeningContent)
    private readonly listeningRepo: Repository<ListeningContent>,

    @InjectRepository(QuizContent)
    private readonly quizRepo: Repository<QuizContent>,

    @InjectRepository(ListeningTranscript)
    private readonly listeningTranscriptRepo: Repository<ListeningTranscript>,

    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,

    @InjectRepository(Vocabulary)
    private readonly vocabularyRepo: Repository<Vocabulary>,

    @InjectRepository(XpTransaction)
    private readonly xpRepo: Repository<XpTransaction>,
  ) { }

  /** Berilgan blok(lar) uchun exercises ni yagona formatda oladi (student output, quiz.md 5.3). */
  private async exercisesFor(ownerType: StudentAnswerBlockType, ownerBlockId: string) {
    const exercises = await this.exerciseRepo.find({
      where: { ownerBlockType: ownerType, ownerBlockId },
      relations: ['items'],
      order: { orderIndex: 'ASC' },
    });
    return exercises.map((e) => ({
      id: e.id,
      type: e.exerciseType,
      title: e.title,
      instructions: e.instructions,
      orderIndex: e.orderIndex,
      items: (e.items ?? [])
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((i) => ({
          id: i.id,
          itemText: i.itemText,
          correctAnswer: i.correctAnswer,
          options: i.options ?? [],
          imageUrl: i.imageUrl,
          explanation: i.explanation,
          orderIndex: i.orderIndex,
        })),
    }));
  }

  async getUnits(userId: string, role: Role) {
    const units = await this.unitRepo.find({ order: { number: 'ASC' } });
    const allLessons = await this.lessonRepo.find({ order: { unitId: 'ASC', orderIndex: 'ASC' } });

    const lessonsByUnit = new Map<string, Lesson[]>();
    allLessons.forEach((l) => {
      const key = l.unitId ?? '';
      if (!lessonsByUnit.has(key)) lessonsByUnit.set(key, []);
      lessonsByUnit.get(key)!.push(l);
    });

    let progressMap = new Map<string, LessonProgress>();
    if (role === Role.student) {
      const allProgress = await this.progressRepo.find({ where: { userId } });
      allProgress.forEach((p) => progressMap.set(p.lessonId, p));
    }

    const unitResults = units.map((unit, index) => {
      const lessons = (lessonsByUnit.get(unit.id) || []).sort((a, b) => a.orderIndex - b.orderIndex);
      const lessonCount = lessons.length;

      if (role !== Role.student) {
        return { id: unit.id, number: unit.number, title: unit.title, lessonCount, progress: 0, status: 'current', currentLesson: null };
      }

      const completedCount = lessons.filter(
        (l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed,
      ).length;

      const progress = lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0;

      let status: string;
      if (completedCount === lessonCount && lessonCount > 0) {
        status = 'completed';
      } else if (completedCount > 0 || lessons.some((l) => progressMap.get(l.id)?.status === LessonProgressStatus.in_progress)) {
        status = 'current';
      } else if (index === 0) {
        status = 'current';
      } else {
        const prevUnit = units[index - 1];
        const prevLessons = lessonsByUnit.get(prevUnit.id) || [];
        const prevCompleted = prevLessons.filter((l) => progressMap.get(l.id)?.status === LessonProgressStatus.completed).length;
        status = prevLessons.length > 0 && prevCompleted === prevLessons.length ? 'current' : 'locked';
      }

      const currentLesson = status !== 'completed'
        ? lessons.find((l) => { const p = progressMap.get(l.id); return !p || p.status !== LessonProgressStatus.completed; }) ?? null
        : null;

      return {
        id: unit.id,
        number: unit.number,
        title: unit.title,
        lessonCount,
        progress,
        status,
        currentLesson: currentLesson
          ? { id: currentLesson.id, lessonCode: `${unit.number}.${currentLesson.orderIndex}`, title: currentLesson.lessonName }
          : null,
      };
    });

    return { units: unitResults };
  }

  async getUnit(unitId: string, userId: string, role: Role) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit topilmadi');

    const lessons = await this.lessonRepo.find({ where: { unitId }, order: { orderIndex: 'ASC' } });

    const progressMap = new Map<string, LessonProgress>();
    if (role === Role.student) {
      const progresses = await this.progressRepo.find({ where: { userId } });
      progresses.forEach((p) => progressMap.set(p.lessonId, p));
    }

    const lessonResults = lessons.map((lesson, index) => {
      const progress = progressMap.get(lesson.id);

      let status: string;
      if (role !== Role.student) {
        status = 'current';
      } else if (progress?.status === LessonProgressStatus.completed) {
        status = 'completed';
      } else if (progress?.status === LessonProgressStatus.in_progress) {
        status = 'current';
      } else if (index === 0) {
        status = 'current';
      } else {
        const prev = lessons[index - 1];
        status = progressMap.get(prev.id)?.status === LessonProgressStatus.completed ? 'current' : 'locked';
      }

      return {
        id: lesson.id,
        number: lesson.orderIndex,
        lessonCode: `${unit.number}.${lesson.orderIndex}`,
        title: lesson.lessonName,
        status,
        score: progress?.score ?? null,
      };
    });

    return { unit: { id: unit.id, number: unit.number, title: unit.title }, lessons: lessonResults };
  }

  async getLessonPages(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const pages = await this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } });
    return { lessonId, pages };
  }

  async getLessonContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const [grammar, reading, listening] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId } }),
      this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.listeningRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
    ]);
    return {
      id: lesson.id,
      title: lesson.lessonName,
      grammar: {
        count: grammar.length,
        items: grammar.map(
          (g) => ({
            id: g.id,
            pageName: g.pageName
          }))
      },
      reading: { count: reading.length, items: reading.map((r) => ({ id: r.id, title: r.title, wordCount: r.wordCount })) },
      listening: { count: listening.length, items: listening.map((l) => ({ id: l.id, title: l.title, durationSeconds: l.durationSeconds })) },
    };
  }

  async getReadingContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const readings = await this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } });
    const content = await Promise.all(
      readings.map(async (r) => ({ ...r, exercises: await this.exercisesFor(StudentAnswerBlockType.reading, r.id) })),
    );
    return { lessonId, content };
  }

  async getListeningContent(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const listenings = await this.listeningRepo.find({ where: { lessonId }, relations: ['transcripts'], order: { orderIndex: 'ASC' } });
    const content = await Promise.all(
      listenings.map(async (l) => ({ ...l, exercises: await this.exercisesFor(StudentAnswerBlockType.listening, l.id) })),
    );
    return { lessonId, content };
  }

  /**
   * Bir dars uchun `blockCounts` va `lesson_progress` dan bajarilganlik
   * foizini hisoblaydi — `getLesson` dagi `sections` mantig'i bilan **bir xil**
   * qoida (ikki joyda ham o'zgartirilishi kerak).
   */
  private computeLessonPercent(
    counts: { grammar: number; reading: number; listening: number; quiz: number; vocabulary: number } | undefined,
    progress: LessonProgress | undefined,
    /** grammar bo'limidagi statik mashqlar: nechtasi ishlangan / jami */
    grammarExercises?: SectionProgress,
    /** lug'at: nechta juftlik kamida bir marta mashq qilingan / jami */
    vocabulary?: SectionProgress,
  ): number {
    if (progress?.status === LessonProgressStatus.completed) return 100;
    if (!counts) return 0;

    // Har bo'lim 0 dan 1 gacha ulush beradi. Ilgari faqat 0 yoki 1 bo'lardi —
    // shu sababli 4 ta grammar mashqidan bittasi ishlangan dars ro'yxatda
    // baribir 0% turardi. Endi grammar va lug'at KASR ulush beradi (1/4 = 0.25).
    const parts: [number, number][] = [
      [counts.grammar, grammarRatio(progress, grammarExercises)],
      [counts.reading, progress?.readingScore != null ? 1 : 0],
      [counts.listening, progress?.listeningScore != null ? 1 : 0],
      [counts.quiz, progress?.quizScore != null ? 1 : 0],
      [counts.vocabulary, vocabularyRatio(progress, vocabulary)],
    ];
    const present = parts.filter(([c]) => c > 0);
    if (present.length === 0) return 0;

    const sum = present.reduce((acc, [, ratio]) => acc + ratio, 0);
    return Math.round((sum / present.length) * 100);
  }

  /**
   * Har dars uchun statik mashqlar bo'yicha bo'lim progressi.
   *
   * `exercise_key` ("lesson1:grammar:ex2") ichida bo'lim nomi turadi, shuning
   * uchun guruhlash uchun alohida ustun kerak emas. Jami esa `section_total`
   * dan: kontent ilovada statik bo'lgani uchun backend mashqlar sonini faqat
   * ilova aytgani bo'yicha biladi. MAX() olinadi — mavzuga yangi mashq
   * qo'shilsa jami o'z-o'zidan yangilanadi.
   *
   * "Ishlangan" = kamida bir marta «Tekshirish» bosilgan (natija yozuvi bor).
   * Bitta GROUP BY so'rov — darslar soniga qarab ko'paymaydi.
   */
  private async exerciseProgressByLesson(
    userId: string,
    lessonIds: string[],
  ): Promise<Map<string, Map<string, SectionProgress>>> {
    const rows: { lesson_id: string; section: string; done: number; total: number }[] =
      await this.xpRepo.query(
        `SELECT lesson_id,
                split_part(exercise_key, ':', 2)     AS section,
                COUNT(DISTINCT exercise_key)::int    AS done,
                COALESCE(MAX(section_total), 0)::int AS total
           FROM exercise_results
          WHERE user_id = $1 AND lesson_id = ANY($2::uuid[])
          GROUP BY lesson_id, split_part(exercise_key, ':', 2)`,
        [userId, lessonIds],
      );

    const byLesson = new Map<string, Map<string, SectionProgress>>();
    for (const row of rows) {
      let sections = byLesson.get(row.lesson_id);
      if (!sections) {
        sections = new Map<string, SectionProgress>();
        byLesson.set(row.lesson_id, sections);
      }
      sections.set(row.section, { done: Number(row.done), total: Number(row.total) });
    }
    return byLesson;
  }

  /**
   * Har dars uchun lug'at progressi: jami JUFTLIK va ulardan nechtasi kamida
   * bir marta mashq qilingan (`user_vocabulary_progress.status <> 'new'`).
   *
   * Jami — `vocabulary_relations` bo'yicha (so'z qatorlari emas): `vocabularys`
   * jadvali so'zni ham, tarjimasini ham ALOHIDA qator qilib saqlaydi
   * (`lang='en'` / `lang='uz'`), ikkalasi bir xil `lesson_id` bilan. Shuning
   * uchun oddiy `count({ where: { lessonId } })` sonni 2 barobar ko'rsatardi.
   * Ilovadagi "Lug'at" tabi ro'yxati ham juftliklardan quriladi
   * (`VocabularyService.getStudentVocabulary`) — jufti yo'q "yetim" so'z u
   * yerda ko'rinmaydi, demak bu yerda ham sanalmaydi.
   *
   * Bitta GROUP BY so'rov — darslar soniga qarab ko'paymaydi.
   */
  private async vocabProgressByLesson(
    userId: string,
    lessonIds: string[],
  ): Promise<Map<string, SectionProgress>> {
    const result = new Map<string, SectionProgress>();
    if (lessonIds.length === 0) return result;

    const rows: { lesson_id: string; total: number; done: number }[] = await this.xpRepo.query(
      `SELECT v.lesson_id,
              COUNT(*)::int AS total,
              COUNT(uvp.id) FILTER (WHERE uvp.status <> 'new')::int AS done
         FROM vocabulary_relations r
         JOIN vocabularys v ON v.id = r.vocabulary_id AND v.lang = 'en'
    LEFT JOIN user_vocabulary_progress uvp ON uvp.pair_id = r.id AND uvp.user_id = $1
        WHERE v.lesson_id = ANY($2::uuid[])
        GROUP BY v.lesson_id`,
      [userId, lessonIds],
    );

    for (const row of rows) {
      result.set(row.lesson_id, { done: Number(row.done), total: Number(row.total) });
    }
    return result;
  }

  /**
   * `lessonIds` bo'yicha har blok turining sonini BITTA `GROUP BY` so'rovi
   * bilan oladi (dars soniga qarab so'rov ko'paymaydi — N+1 emas).
   */
  private async blockCountsByLesson(lessonIds: string[]) {
    const counts = new Map<
      string,
      { grammar: number; reading: number; listening: number; quiz: number; vocabulary: number }
    >();
    if (lessonIds.length === 0) return counts;

    const blank = () => ({ grammar: 0, reading: 0, listening: 0, quiz: 0, vocabulary: 0 });
    // `vocabularys` jadvalida har bir so'z IKKI qator bo'lib yotadi: inglizchasi
    // (`lang='en'`) va tarjimasi (`lang='uz'`), ikkalasi ham bir xil `lesson_id`
    // bilan. Filtrsiz sanash so'z sonini 2 barobar ko'rsatadi.
    const entries: [keyof ReturnType<typeof blank>, Repository<any>, string?][] = [
      ['grammar', this.grammarRepo],
      ['reading', this.readingRepo],
      ['listening', this.listeningRepo],
      ['quiz', this.quizRepo],
      ['vocabulary', this.vocabularyRepo, "b.lang = 'en'"],
    ];

    const results = await Promise.all(
      entries.map(([, repo, extraWhere]) => {
        const qb = repo
          .createQueryBuilder('b')
          .select('b.lessonId', 'lessonId')
          .addSelect('COUNT(*)', 'cnt')
          .where('b.lessonId IN (:...lessonIds)', { lessonIds });
        if (extraWhere) qb.andWhere(extraWhere);
        return qb.groupBy('b.lessonId').getRawMany<{ lessonId: string; cnt: string }>();
      }),
    );

    results.forEach((rows, i) => {
      const key = entries[i][0];
      for (const row of rows) {
        const bucket = counts.get(row.lessonId) ?? blank();
        bucket[key] = Number(row.cnt);
        counts.set(row.lessonId, bucket);
      }
    });
    return counts;
  }

  async getPublishedByUnit(unitNumber: number, userId?: string): Promise<any[]> {
    const unit = await this.unitRepo.findOne({ where: { number: unitNumber } });
    if (!unit) return [];

    const lessons = await this.lessonRepo.find({
      where: { unitId: unit.id, status: LessonStatus.published },
      order: { orderIndex: 'ASC' },
    });
    if (lessons.length === 0) return [];

    const lessonIds = lessons.map((l) => l.id);

    // Diqqat (perf): hech qayerda "har dars uchun bitta so'rov" yo'q. Bloklar
    // soni, progress va XP — hammasi lessonIds bo'yicha yig'ma so'rovlar bilan
    // olinadi, shuning uchun 5 ta darsda ham 50 ta darsda ham so'rov soni bir xil.
    const [blockCounts, progressRows, xpRows, exerciseProgress, vocabProgress] = await Promise.all([
      this.blockCountsByLesson(lessonIds),
      userId
        ? this.progressRepo.find({ where: { userId, lessonId: In(lessonIds) } })
        : Promise.resolve([] as LessonProgress[]),
      userId
        ? this.xpTotalsByLesson(userId, lessonIds)
        : Promise.resolve([] as { lesson_id: string; total: number }[]),
      userId
        ? this.exerciseProgressByLesson(userId, lessonIds)
        : Promise.resolve(new Map<string, Map<string, SectionProgress>>()),
      userId
        ? this.vocabProgressByLesson(userId, lessonIds)
        : Promise.resolve(new Map<string, SectionProgress>()),
    ]);

    const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));
    const xpByLesson = new Map(xpRows.map((r) => [r.lesson_id, Number(r.total)]));

    return lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.lessonName,
      lesson_code: `${unit.number}.${lesson.orderIndex.toString().padStart(2, '0')}`,
      unit_number: unit.number,
      cefr_level: lesson.cefrLevel ?? '',
      status: lesson.status as 'published' | 'draft',
      teacher_id: '',
      group_id: null,
      duration: lesson.estimatedMinutes ?? null,
      /** bajarilgan bo'limlar ulushi, 0-100 */
      progress_percent: this.computeLessonPercent(
        blockCounts.get(lesson.id),
        progressByLesson.get(lesson.id),
        exerciseProgress.get(lesson.id)?.get('grammar'),
        vocabProgress.get(lesson.id),
      ),
      /** shu darsdan to'plangan XP */
      xp_earned: xpByLesson.get(lesson.id) ?? 0,
    }));
  }

  /**
   * Bitta darsdan to'plangan COIN — mashqlar va lug'atdan.
   *
   * Ilgari bu yerda faqat `lesson_complete` sanalardi, shuning uchun dars
   * qatoridagi ⭐ da mashqlardan olingan coin ko'rinmasdi: umumiy hisobda
   * 69 turgan bolaga darsda 50 chiqardi. Endi qoida boshqacha —
   * **darsni yakunlash coin bermaydi**, faqat mashq va lug'at beradi.
   *
   * Manbalar ikki xil bog'lanadi:
   *  - `exercise_complete` va `vocabulary_test` — `reference_id` bevosita
   *    darsning idsi (coinli sinov jarimasi manfiy amount bilan shu yerda);
   *  - `vocabulary_word` (eski qoida) — `reference_id` so'z JUFTI
   *    (vocabulary_relations), dars idsi juft orqali `vocabularys.lesson_id`
   *    dan topiladi.
   *
   * `lesson_complete` ataylab QO'SHILMAYDI: eski bazalarda o'sha manbadan
   * qolgan yozuvlar bo'lishi mumkin, ular endi hisobga olinmasligi kerak
   * (butunlay tozalash uchun `scripts/remove-lesson-complete-xp.js`).
   *
   * Bitta so'rov, GROUP BY bilan — darslar soni nechta bo'lishidan qat'i
   * nazar bazaga bir marta boriladi (N+1 yo'q).
   */
  private xpTotalsByLesson(
    userId: string,
    lessonIds: string[],
  ): Promise<{ lesson_id: string; total: number }[]> {
    return this.xpRepo.query(
      `SELECT lesson_id, SUM(amount)::int AS total
         FROM (
           SELECT x.reference_id AS lesson_id, x.amount
             FROM xp_transactions x
            WHERE x.user_id = $1
              AND x.source IN ($3, $5)
              AND x.reference_id = ANY($2::uuid[])
           UNION ALL
           SELECT v.lesson_id, x.amount
             FROM xp_transactions x
             JOIN vocabulary_relations r ON r.id = x.reference_id
             JOIN vocabularys v ON v.id = r.vocabulary_id
            WHERE x.user_id = $1
              AND x.source = $4
              AND v.lesson_id = ANY($2::uuid[])
         ) t
        GROUP BY lesson_id`,
      [userId, lessonIds, XpSource.exercise_complete, XpSource.vocabulary_word, XpSource.vocabulary_test],
    );
  }

  /**
   * getLessonBlocks uchun juda qisqa TTL'li xotira-ichi keshi. Bir dars
   * (masalan bir guruh darsni bir vaqtda ochganda) uchun so'rovlar DB'ga
   * takror-takror bormasin — "thundering herd"ni yumshatadi. TTL qisqa
   * bo'lgani uchun o'qituvchi tahririni alohida invalidatsiya qilish shart
   * emas (eng ko'pi bilan TTL_MS davomida eski kontent ko'rinishi mumkin).
   */
  private readonly blocksCache = new Map<string, { data: unknown; expires: number }>();
  private readonly BLOCKS_CACHE_TTL_MS = 20_000;

  /** exercisesFor bilan bir xil shaklga o'giradi, lekin oldindan olingan ro'yxatdan (query'siz) */
  private mapExercise(e: Exercise) {
    return {
      id: e.id,
      type: e.exerciseType,
      title: e.title,
      instructions: e.instructions,
      orderIndex: e.orderIndex,
      items: (e.items ?? [])
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((i) => ({
          id: i.id,
          itemText: i.itemText,
          correctAnswer: i.correctAnswer,
          options: i.options ?? [],
          imageUrl: i.imageUrl,
          explanation: i.explanation,
          orderIndex: i.orderIndex,
        })),
    };
  }

  /**
   * Barcha blok turlari (quiz/reading/listening/grammar) uchun AYNAN BIR XIL
   * `exercises` formatida mashqlarni qaytaradi. Qarang: quiz.md 5.3.
   *
   * Diqqat (perf): bloklar soni qancha bo'lishidan qat'i nazar mashqlar
   * BITTA so'rovda (`lessonId` bo'yicha) olinadi va xotirada `ownerBlockId`
   * bo'yicha guruhlanadi — avval har blok uchun alohida so'rov bo'lardi
   * (N+1), bu esa 400-500 bir vaqtdagi foydalanuvchida connection pool'ni
   * tez tugatib, so'rovlarni navbatga tiqib qo'yar edi.
   */
  async getLessonBlocks(lessonId: string) {
    const cached = this.blocksCache.get(lessonId);
    if (cached && cached.expires > Date.now()) return cached.data;

    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const [grammars, readings, listenings, quizzes, allExercises] = await Promise.all([
      this.grammarRepo.find({ where: { lessonId }, order: { createdAt: 'ASC' } }),
      this.readingRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.listeningRepo.find({ where: { lessonId }, relations: ['transcripts'], order: { orderIndex: 'ASC' } }),
      this.quizRepo.find({ where: { lessonId }, order: { orderIndex: 'ASC' } }),
      this.exerciseRepo.find({ where: { lessonId }, relations: ['items'], order: { orderIndex: 'ASC' } }),
    ]);

    const exercisesByOwner = new Map<string, Exercise[]>();
    for (const ex of allExercises) {
      const arr = exercisesByOwner.get(ex.ownerBlockId);
      if (arr) arr.push(ex);
      else exercisesByOwner.set(ex.ownerBlockId, [ex]);
    }
    const exercisesForOwner = (ownerBlockId: string) =>
      (exercisesByOwner.get(ownerBlockId) ?? []).map((e) => this.mapExercise(e));

    // O'qituvchi belgilagan tartib: orderIndex (grammar doim birinchi), teng bo'lsa createdAt
    const sortMeta = new Map<string, { idx: number; created: number }>();
    grammars.forEach((g) => sortMeta.set(g.id, { idx: -1, created: +new Date(g.createdAt) }));
    readings.forEach((r) => sortMeta.set(r.id, { idx: r.orderIndex ?? 0, created: +new Date(r.createdAt) }));
    listenings.forEach((l) => sortMeta.set(l.id, { idx: l.orderIndex ?? 0, created: +new Date(l.createdAt) }));
    quizzes.forEach((q) => sortMeta.set(q.id, { idx: q.orderIndex ?? 0, created: +new Date(q.createdAt) }));

    const grammarBlocks = grammars.map((g) => ({
      id: g.id,
      type: 'grammar' as const,
      order: 0,
      grammarPage: g.pageName,
      exercises: exercisesForOwner(g.id),
    }));
    const readingBlocks = readings.map((r) => ({
      id: r.id,
      type: 'reading' as const,
      order: 0,
      reading: { title: r.title, content: r.textContent, wordCount: r.wordCount, readTimeMinutes: r.readingTimeMinutes },
      exercises: exercisesForOwner(r.id),
    }));
    const listeningBlocks = listenings.map((l) => ({
      id: l.id,
      type: 'listening' as const,
      order: 0,
      listening: {
        title: l.title,
        audioUrl: l.fileId || null,
        imageUrl: l.imageUrl,
        duration: l.durationSeconds,
        transcript: (l.transcripts ?? [])
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((t) => ({ speaker: t.speakerName, timeStart: t.timestampSec, text: t.textContent })),
      },
      exercises: exercisesForOwner(l.id),
    }));
    const quizBlocks = quizzes.map((q) => ({
      id: q.id,
      type: 'quiz' as const,
      order: 0,
      quiz: { title: q.title },
      exercises: exercisesForOwner(q.id),
    }));

    const all = [...grammarBlocks, ...readingBlocks, ...listeningBlocks, ...quizBlocks].sort((a, b) => {
      const A = sortMeta.get(a.id)!;
      const B = sortMeta.get(b.id)!;
      return A.idx - B.idx || A.created - B.created;
    });

    const result = all.map((b, i) => ({ ...b, order: i + 1 }));
    this.blocksCache.set(lessonId, { data: result, expires: Date.now() + this.BLOCKS_CACHE_TTL_MS });
    return result;
  }

  /** O'qituvchi kontentni tahrirlaganda shu darsning keshini darhol bekor qiladi. */
  invalidateLessonBlocksCache(lessonId: string) {
    this.blocksCache.delete(lessonId);
  }

  /**
   * Dars-oldi ("LessonDetail") ekrani uchun YENGIL ma'lumot: dars meta'si +
   * tarkibidagi bo'limlar ro'yxati. Ataylab `getLessonBlocks` dan alohida:
   * u yerda butun kontent (matnlar, transkriptlar, barcha mashqlar) keladi,
   * bu ekranga esa faqat "qanday bo'limlar bor va qaysilari bajarilgan"
   * kerak. Shuning uchun bu yerda `count()` ishlatiladi, `find()` emas.
   */
  async getLesson(lessonId: string, userId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId }, relations: ['unit'] });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const [
      progress,
      grammarCount,
      readingCount,
      listeningCount,
      quizCount,
      exerciseProgress,
      vocabProgress,
    ] = await Promise.all([
      this.progressRepo.findOne({ where: { userId, lessonId } }),
      this.grammarRepo.count({ where: { lessonId } }),
      this.readingRepo.count({ where: { lessonId } }),
      this.listeningRepo.count({ where: { lessonId } }),
      this.quizRepo.count({ where: { lessonId } }),
      this.exerciseProgressByLesson(userId, [lessonId]),
      // Lug'at soni ham shu yerdan: juftliklar soni (ilovadagi tab bilan bir xil)
      this.vocabProgressByLesson(userId, [lessonId]),
    ]);

    const grammarExercises = exerciseProgress.get(lessonId)?.get('grammar');
    const vocabulary = vocabProgress.get(lessonId);
    const vocabularyCount = vocabulary?.total ?? 0;

    // LessonContentScreen'dagi tab tartibi bilan bir xil: grammar doim birinchi,
    // lug'at doim oxirida.
    const rawSections: { type: SectionType; label: string; count: number; score: number | null }[] = [
      { type: 'grammar', label: 'Grammar', count: grammarCount, score: progress?.grammarScore ?? null },
      { type: 'reading', label: 'Reading', count: readingCount, score: progress?.readingScore ?? null },
      { type: 'listening', label: 'Listening', count: listeningCount, score: progress?.listeningScore ?? null },
      { type: 'quiz', label: 'Test', count: quizCount, score: progress?.quizScore ?? null },
      { type: 'vocabulary', label: "Lug'at", count: vocabularyCount, score: progress?.vocabularyScore ?? null },
    ];

    const isCompleted = progress?.status === LessonProgressStatus.completed;
    const sections = rawSections
      .filter((s) => s.count > 0)
      .map((s) => {
        // Hisoblanadigan bo'limlar KASR foiz beradi: grammar — statik mashqlar
        // (4 tadan 1 tasi ishlangan = 25%), lug'at — kamida bir marta mashq
        // qilingan juftliklar. Qolgan bo'limlar 0 yoki 100 — ular ballga qarab
        // "topshirilgan / topshirilmagan" bo'ladi.
        const tracked: SectionProgress | undefined =
          s.type === 'grammar' && grammarExercises && grammarExercises.total > 0
            ? grammarExercises
            : s.type === 'vocabulary' && vocabulary && vocabulary.total > 0
              ? vocabulary
              : undefined;

        const progressPercent = isCompleted
          ? 100
          : tracked
            ? Math.round((Math.min(tracked.done, tracked.total) / tracked.total) * 100)
            : s.score !== null
              ? 100
              : 0;

        return {
          ...s,
          /** bo'limning bajarilish foizi, 0–100 */
          progressPercent,
          /** hisoblanadigan bo'limlarda: bajarilgan / jami (grammar — mashq, lug'at — so'z) */
          doneCount: tracked ? tracked.done : null,
          totalCount: tracked ? tracked.total : null,
          // Ball qo'yilgan bo'lsa — topshirilgan. Grammar/lug'at esa hamma
          // mashqi/so'zi ishlanganda bajarilgan hisoblanadi (ilgari faqat butun
          // dars yakunlanganda "bajarilgan" bo'lardi). Ilova darsni avto-
          // yakunlashda shu `completed` belgisiga tayanadi.
          completed: progressPercent === 100 || s.score !== null || isCompleted,
        };
      });

    const completedSections = sections.filter((s) => s.completed).length;
    const totalSections = sections.length;

    // Qolgan vaqt: umumiy vaqtdan bajarilgan bo'limlar ulushi ayiriladi.
    const estimatedMinutes = lesson.estimatedMinutes ?? 15;
    const remainingMinutes =
      totalSections === 0
        ? estimatedMinutes
        : Math.max(0, Math.round((estimatedMinutes * (totalSections - completedSections)) / totalSections));

    return {
      id: lesson.id,
      lessonCode: lesson.unit ? `${lesson.unit.number}.${lesson.orderIndex}` : String(lesson.orderIndex),
      title: lesson.lessonName,
      orderIndex: lesson.orderIndex,
      status: lesson.status,
      cefrLevel: lesson.cefrLevel,
      unitNumber: lesson.unit?.number ?? null,
      unitTitle: lesson.unit?.title ?? null,
      estimatedMinutes,
      remainingMinutes,
      sections,
      totalSections,
      completedSections,
      userProgress: progress
        ? { status: progress.status, score: progress.score, attempts: progress.attempts, timeSpent: progress.timeSpentSec }
        : null,
    };
  }
}

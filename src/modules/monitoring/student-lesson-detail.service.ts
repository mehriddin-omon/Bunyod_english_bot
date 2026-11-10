import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { chunkRanges } from '../vocabulary/vocabulary-learn.service';
import { COIN_TEST_RULES } from '../vocabulary/vocabulary-coin-test.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from 'src/common/utils/enum';
import type { ExerciseAnswerItem } from 'src/common/core/entitys/exercise-result.entity';
import { RETIRED_GRAMMAR_TITLES, screenInfo } from 'src/common/utils/grammar-exercise-order';
import { computeLessonScore, SECTION_KEYS, sectionScores, vocabularyPercent } from 'src/common/utils/lesson-score';
import { LessonScoreService } from 'src/common/services/lesson-score.service';
import {
  IRREGULAR_VERBS,
  VERB_SET_TITLES,
  VERB_STAGE_TITLES,
  VERBS_GRAMMAR_PAGE,
  parseVerbKey,
  verbOfQuestion,
} from 'src/common/utils/irregular-verbs';

/** Teacher panelga chiqadigan bitta savol natijasi */
export interface DetailItem {
  q: string;
  given: string | null;
  expected: string;
  ok: boolean;
  /** Ballga kirmaydigan savol (tarjima) — to'g'ri/xato deb baholanmaydi */
  ungraded?: boolean;
}

interface Viewer {
  sub: string;
  role: string;
}

const SECTION_LABEL: Record<string, string> = {
  grammar: 'Grammatika',
  vocabulary: "Lug'at",
  reading: 'Reading',
  listening: 'Listening',
  quiz: 'Test',
  speaking: 'Speaking',
};

/** Lug'at bosqichlari — ilovadagi `constants/vocabStages.ts` nomlari bilan bir xil */
const VOCAB_STAGE_TITLES: Record<number, string> = {
  1: 'Variantli test',
  2: 'Eshitib topish',
  3: 'Karta',
  4: 'Yozib yodlash',
};

/** Coinli sinov kartasi (vocabulary_coin_tests.cards) — faqat kerakli maydonlar */
interface CoinCard {
  word: string;
  translation: string;
  mode: 'multiple_choice' | 'audio' | 'typing';
  answer: string | null;
  correct: boolean | null;
  timedOut?: boolean;
}

/** Variantlar `string` yoki `{ text, isCorrect, matchKey }` bo'lishi mumkin */
type Option = string | { text?: string; isCorrect?: boolean; matchKey?: string | null };

function fmtDuration(totalSec: number | null): string | null {
  if (!totalSec) return null;
  const m = Math.max(0, Math.round(totalSec / 60));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}s ${rem}m` : `${h}s`;
}

/** "lesson2:grammar:ex8" → 8 (kalitdagi raqam — ekrandagi tartib EMAS) */
function keyNo(key: string): number {
  return Number(key.split(':')[2]?.replace(/^ex/, '')) || 0;
}

/** "lesson12:grammar:ex1" → 12 */
function keyLesson(key: string): number {
  return Number(key.split(':')[0]?.replace(/^lesson/, '')) || 0;
}

/** Bloklar dars sahifasidagi tartibda: Reading → Listening → Test */
const BLOCK_ORDER_SQL = `CASE sa.block_type WHEN 'reading' THEN 1 WHEN 'listening' THEN 2 WHEN 'quiz' THEN 3 ELSE 4 END`;

/**
 * O'quvchi + bitta dars kesimida «qanday o'zlashtiryapti»:
 *  - bo'limlar bo'yicha ball (lesson_progress)
 *  - grammatika mashqlari: har urinish, foiz va savollar bo'yicha natija (exercise_results)
 *  - reading / listening / test: har savolga oxirgi javob (student_answers + exercise_items)
 *
 * «Mavzular bo'yicha statistika» qatori bosilganda alohida so'rov bilan yuklanadi —
 * o'quvchi sahifasining asosiy so'rovini og'irlashtirmaydi.
 */
@Injectable()
export class StudentLessonDetailService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly lessonScore: LessonScoreService,
  ) {}

  /** Teacher/subTeacher faqat o'z guruhidagi o'quvchini ko'radi (getStudentMonitoring bilan bir xil) */
  private async assertVisible(studentId: string, viewer: Viewer) {
    const [student] = await this.ds.query(`SELECT 1 FROM users WHERE id = $1`, [studentId]);
    if (!student) throw new NotFoundException("O'quvchi topilmadi");
    if (viewer.role === Role.admin || viewer.role === Role.superAdmin) return;
    const [own] = await this.ds.query(
      `SELECT 1
         FROM group_members m
         JOIN groups g ON g.id = m.group_id
        WHERE m.user_id = $1 AND g.teacher_id = $2
        LIMIT 1`,
      [studentId, viewer.sub],
    );
    if (!own) throw new ForbiddenException("Bu o'quvchi sizning guruhingizda emas");
  }

  async getLessonDetail(studentId: string, lessonId: string, viewer: Viewer) {
    await this.assertVisible(studentId, viewer);

    const [lesson] = await this.ds.query(
      `SELECT l.id, l.order_index, l.lesson_name,
              u.number AS unit_number, u.title AS unit_title,
              lp.id AS progress_id, lp.status, lp.score, lp.grammar_score, lp.vocabulary_score, lp.reading_score,
              lp.listening_score, lp.quiz_score, lp.speaking_score,
              lp.time_spent_sec::int AS time_spent_sec, lp.attempts::int AS attempts, lp.completed_at
         FROM lessons l
         LEFT JOIN units u ON u.id = l.unit_id
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
        WHERE l.id = $2`,
      [studentId, lessonId],
    );
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const [resultRows, answerRows, vocab] = await Promise.all([
      this.ds.query(
        `SELECT exercise_key, attempt_number, percent, correct_count, total_count,
                section_total, title, items, answered_at
           FROM exercise_results
          WHERE user_id = $1 AND lesson_id = $2
          ORDER BY answered_at ASC, attempt_number ASC`,
        [studentId, lessonId],
      ),
      // question_id = exercise_items.id (eski polimorf idlar JOIN'dan o'tmaydi — ular endi yo'q)
      this.ds.query(
        `SELECT sa.block_type, sa.block_id, sa.given_answer, sa.is_correct, sa.answered_at,
                ei.item_text, ei.correct_answer, ei.options,
                e.id AS exercise_id, e.title AS exercise_title, e.exercise_type,
                COALESCE(rc.title, lc.title, qc.title) AS block_title,
                COALESCE(rc.order_index, lc.order_index, 0) AS block_order,
                e.order_index AS exercise_order, ei.order_index AS item_order
           FROM student_answers sa
           JOIN exercise_items ei ON ei.id = sa.question_id
           JOIN exercises e ON e.id = ei.exercise_id
           LEFT JOIN reading_contents rc ON rc.id = sa.block_id
           LEFT JOIN listening_contents lc ON lc.id = sa.block_id
           LEFT JOIN quiz_contents qc ON qc.id = sa.block_id
          WHERE sa.user_id = $1 AND sa.lesson_id = $2
          ORDER BY ${BLOCK_ORDER_SQL}, block_order, sa.block_id, e.order_index, ei.order_index`,
        [studentId, lessonId],
      ),
      this.lessonScore.vocabulary(studentId, lessonId),
    ]);

    // Kartalar va ball — bitta formula (utils/lesson-score.ts): ball = kartalar o'rtachasi.
    // Bazadagi ball eskirgan bo'lsa shu yerda tuzatiladi.
    const scoreInput = {
      exerciseBests: this.exerciseBests(resultRows),
      grammarScore: lesson.grammar_score,
      readingScore: lesson.reading_score,
      listeningScore: lesson.listening_score,
      quizScore: lesson.quiz_score,
      speakingScore: lesson.speaking_score,
      vocabularyPercent: vocab.percent,
    };
    const cards = sectionScores(scoreInput);
    const liveScore = computeLessonScore(scoreInput);
    if (lesson.progress_id && liveScore != null && liveScore !== lesson.score) {
      void this.lessonScore.saveScores([{ id: lesson.progress_id, score: liveScore }]);
    }

    return {
      lesson: {
        id: lesson.id,
        code:
          lesson.unit_number != null
            ? `${lesson.unit_number}.${lesson.order_index}`
            : `${lesson.order_index}`,
        title: lesson.lesson_name,
        unitTitle: lesson.unit_title ?? null,
        status: lesson.status ?? 'not_started',
        score: liveScore ?? lesson.score ?? null,
        timeLabel: fmtDuration(lesson.time_spent_sec),
        attempts: lesson.attempts ?? 0,
        completedAt: lesson.completed_at ?? null,
      },
      sections: SECTION_KEYS.map((key) => ({ key, label: SECTION_LABEL[key], score: cards[key] })).filter(
        (s) => s.score != null,
      ),
      // Listening va Reading ham `exercise_results` da (kalit `lessonN:listening|reading:exM`) —
      // grammatikadan ALOHIDA bo'limlar
      grammar: await this.buildGrammar(resultRows.filter((r) => this.sectionOf(r) === 'grammar')),
      listening: await this.buildGrammar(resultRows.filter((r) => this.sectionOf(r) === 'listening')),
      reading: await this.buildGrammar(resultRows.filter((r) => this.sectionOf(r) === 'reading')),
      blocks: this.buildBlocks(answerRows),
    };
  }

  // ── Lug'at ─────────────────────────────────────────────────────────────

  /**
   * O'quvchi + dars: lug'at natijasi — so'zlar holati (user_vocabulary_progress),
   * bosqichlar (vocabulary_stage_progress), coinli sinov urinishlari va har so'zga javob.
   * Sheet'da alohida panel — o'z so'rovi va skeleti bilan.
   *
   * Foiz = mustahkam so'zlar / darsdagi so'zlar («mustahkam» faqat coinli sinovda to'g'ri
   * topilganda beriladi). Ko'nikmalar panelidagi «Lug'at» shu foizlarning o'rtachasi.
   */
  async getLessonVocabulary(studentId: string, lessonId: string, viewer: Viewer) {
    await this.assertVisible(studentId, viewer);

    const [[lesson], words, stages, tests, lentaStates] = await Promise.all([
      this.ds.query(`SELECT id FROM lessons WHERE id = $1`, [lessonId]),
      this.ds.query(
        `SELECT r.id AS pair_id, src.word, trg.word AS translation,
                COALESCE(uvp.status, 'new') AS status,
                COALESCE(uvp.attempts, 0)::int AS attempts,
                COALESCE(uvp.wrong_attempts, 0)::int AS wrong,
                (uvp.seen_at IS NOT NULL) AS seen,
                COALESCE(uvp.growth_cleared, false) AS growth_cleared
           FROM vocabulary_relations r
           JOIN vocabularys src ON src.id = r.vocabulary_id AND src.lang = 'en'
           JOIN vocabularys trg ON trg.id = r.translation_id
      LEFT JOIN user_vocabulary_progress uvp ON uvp.pair_id = r.id AND uvp.user_id = $1
          WHERE src.lesson_id = $2 AND vocab_visible($1, src.lesson_id, src.set_no)
          ORDER BY src.order_index, src.word`,
        [studentId, lessonId],
      ),
      this.ds.query(
        `SELECT stage::int AS stage, attempts::int AS attempts, best_percent::int AS best,
                last_percent::int AS last, passed, passed_at
           FROM vocabulary_stage_progress
          WHERE user_id = $1 AND lesson_id = $2`,
        [studentId, lessonId],
      ),
      this.ds.query(
        `SELECT id, attempt_number::int AS attempt, COALESCE(part, 1)::int AS part, status, percent::int AS percent,
                correct_count::int AS correct, total_words::int AS total,
                coins_earned::int AS coins, cards, created_at, finished_at
           FROM vocabulary_coin_tests
          WHERE user_id = $1 AND lesson_id = $2
          ORDER BY created_at`,
        [studentId, lessonId],
      ),
      // Testlash lentasi holati (bo'laklar): scope `L:<lessonId>:<n>`
      this.ds.query(
        `SELECT scope, state, completed_at FROM vocabulary_lenta_states
          WHERE user_id = $1 AND scope LIKE $2`,
        [studentId, `L:${lessonId}:%`],
      ),
    ]);
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const count = (st: string) => words.filter((w: any) => w.status === st).length;
    const mastered = count('mastered');
    const stageBy = new Map<number, any>(stages.map((r: any) => [r.stage, r]));
    const touched =
      words.some((w: any) => w.attempts > 0 || w.status !== 'new' || w.seen) ||
      stages.length > 0 ||
      tests.length > 0 ||
      lentaStates.length > 0;

    // 2026-11 oqimi: Tanishuv / Testlash (10 tadan bo'lak) / Coinli sinov (35 tadan qism)
    const stateBy = new Map<string, any>(lentaStates.map((r: any) => [r.scope, r]));
    const chunks = chunkRanges(words.length).map((r) => {
      const st = stateBy.get(`L:${lessonId}:${r.n}`);
      const s = (st?.state ?? {}) as Record<string, unknown>;
      return {
        n: r.n,
        from: r.start + 1,
        to: r.end,
        status: (st?.completed_at ? 'done' : st ? 'in_progress' : 'new') as 'done' | 'in_progress' | 'new',
        stage: typeof s.stage === 'number' ? s.stage : null,
        percent: typeof s.percent === 'number' ? s.percent : null,
      };
    });
    const partSize = COIN_TEST_RULES.partSize;
    const parts = Array.from({ length: Math.ceil(words.length / partSize) }, (_, i) => {
      const part = i + 1;
      const done = tests.filter((t: any) => t.part === part && t.status !== 'in_progress');
      return {
        part,
        from: i * partSize + 1,
        to: Math.min(words.length, (i + 1) * partSize),
        attempts: done.length,
        bestPercent: done.length ? Math.max(...done.map((t: any) => t.percent)) : null,
        coins: done.reduce((sum: number, t: any) => sum + (t.coins ?? 0), 0),
      };
    });
    const growth = words.filter(
      (w: any) => w.wrong >= 2 && w.status !== 'mastered' && !w.growth_cleared,
    ).length;

    return {
      total: words.length,
      mastered,
      learning: count('learning'),
      fresh: count('new'),
      /** mustahkam / jami; null — lug'at hali ishlanmagan */
      percent: vocabularyPercent(mastered, words.length, touched),
      tanishuv: { seen: words.filter((w: any) => w.seen).length, total: words.length },
      testlash: { chunks, done: chunks.filter((c) => c.status === 'done').length, growth },
      coinParts: parts,
      /** eskirgan 4 bosqich (2026-11 gacha) — eski ma'lumot uchun */
      stages: [1, 2, 3, 4].map((stage) => {
        const r = stageBy.get(stage);
        return {
          stage,
          title: VOCAB_STAGE_TITLES[stage],
          attempts: r?.attempts ?? 0,
          bestPercent: r ? r.best : null,
          lastPercent: r ? r.last : null,
          passed: !!r?.passed,
        };
      }),
      coinTests: tests.map((t: any) => {
        const cards: CoinCard[] = Array.isArray(t.cards) ? t.cards : [];
        // Davom etayotgan sinovda faqat javob berilgan so'zlar
        const shown = t.status === 'in_progress' ? cards.filter((c) => c.correct !== null) : cards;
        return {
          id: t.id,
          attempt: t.attempt,
          part: t.part,
          status: t.status as 'in_progress' | 'completed' | 'abandoned',
          percent: t.percent,
          correct: t.correct,
          total: t.total,
          coins: t.coins,
          at: t.finished_at ?? t.created_at,
          items: shown.map((c) => this.formatCoinCard(c)),
        };
      }),
      words: words.map((w: any) => ({
        pairId: w.pair_id,
        word: w.word,
        translation: w.translation,
        status: w.status as 'new' | 'learning' | 'mastered',
        attempts: w.attempts,
        wrong: Math.min(w.wrong, w.attempts),
        seen: !!w.seen,
      })),
    };
  }

  /** Coinli sinov kartasi → savol qatori (typing'da tarjima so'raladi, javob — inglizcha so'z) */
  private formatCoinCard(c: CoinCard): DetailItem {
    const typing = c.mode === 'typing';
    const mode = typing ? ' · yozib' : c.mode === 'audio' ? ' · eshitib' : '';
    return {
      q: `${typing ? c.translation : c.word}${mode}`,
      given: c.timedOut && !c.answer ? null : c.answer,
      expected: typing ? c.word : c.translation,
      ok: c.correct === true,
    };
  }

  // ── Grammatika (statik mashqlar) ────────────────────────────────────────

  /** exercise_results qatorlaridan har mashqning eng yaxshi foizi */
  private exerciseBests(rows: any[]) {
    const best = new Map<string, number>();
    for (const r of rows) best.set(r.exercise_key, Math.max(best.get(r.exercise_key) ?? 0, Number(r.percent)));
    return [...best].map(([exerciseKey, b]) => ({ exerciseKey, best: b }));
  }

  /**
   * `lesson1:listening:ex1` → 'listening'. Listening/Reading — ilova ichidagi, grammatikadan alohida.
   * `verbs` (4-darsdagi noto'g'ri fe'llar) — o'z paneli bor (getLessonVerbs), grammatikaga qo'shilmaydi.
   */
  private sectionOf(r: { exercise_key: string }): 'grammar' | 'listening' | 'reading' | 'verbs' {
    const s = String(r.exercise_key).split(':')[1];
    return s === 'listening' || s === 'reading' || s === 'verbs' ? s : 'grammar';
  }

  // ── Noto'g'ri fe'llar (4-dars, ilova ichidagi) ───────────────────────────

  /**
   * O'quvchi + dars: noto'g'ri fe'llar — to'plam × bosqich natijalari, har fe'l bo'yicha javoblar
   * (exercise_results.items, `q = "<V1> · …"`), trenajyordagi takrorlashlar va shu o'quvchining
   * guruhida eng ko'p adashilgan fe'llar. Sheet'da alohida panel — o'z so'rovi va skeleti bilan.
   */
  async getLessonVerbs(studentId: string, lessonId: string, viewer: Viewer) {
    await this.assertVisible(studentId, viewer);

    const isAdmin = viewer.role === Role.admin || viewer.role === Role.superAdmin;
    const [[available], rows, groupRows] = await Promise.all([
      // Bo'lim ilovada `lesson4.tsx` grammatika sahifasi ulangan darsda chiqadi (src/content/irregularVerbs)
      this.ds.query(
        `SELECT 1 AS ok FROM grammar_contents WHERE lesson_id = $1 AND page_name = $2 LIMIT 1`,
        [lessonId, VERBS_GRAMMAR_PAGE],
      ),
      this.ds.query(
        `SELECT exercise_key, attempt_number, percent, correct_count, total_count, items, answered_at
           FROM exercise_results
          WHERE user_id = $1 AND lesson_id = $2 AND split_part(exercise_key, ':', 2) = 'verbs'
          ORDER BY answered_at ASC, attempt_number ASC`,
        [studentId, lessonId],
      ),
      // O'quvchining guruh(lar)idagi hamma o'quvchi: har fe'lda nechtasi adashgan / nechtasi javob bergan.
      // Teacher — faqat o'zi o'qitadigan guruh(lar).
      this.ds.query(
        `WITH grp AS (
           SELECT DISTINCT m2.user_id
             FROM group_members m
             JOIN groups g ON g.id = m.group_id
             JOIN group_members m2 ON m2.group_id = m.group_id
            WHERE m.user_id = $2 AND ($3::boolean OR g.teacher_id = $4)
         ), answers AS (
           SELECT er.user_id,
                  lower(trim(split_part(it->>'q', ' · ', 1))) AS v1,
                  (it->>'ok')::boolean AS ok
             FROM exercise_results er
             JOIN grp ON grp.user_id = er.user_id
            CROSS JOIN LATERAL jsonb_array_elements(
                    CASE WHEN jsonb_typeof(er.items) = 'array' THEN er.items ELSE '[]'::jsonb END) it
            WHERE er.lesson_id = $1 AND split_part(er.exercise_key, ':', 2) = 'verbs'
         )
         SELECT v1,
                COUNT(DISTINCT user_id) FILTER (WHERE ok = false)::int AS wrong_users,
                COUNT(DISTINCT user_id)::int AS users
           FROM answers
          GROUP BY v1
         HAVING COUNT(DISTINCT user_id) FILTER (WHERE ok = false) > 0
          ORDER BY wrong_users DESC, users DESC, v1
          LIMIT 8`,
        [lessonId, studentId, isAdmin, viewer.sub],
      ),
    ]);

    // To'plam × bosqich
    type StageAgg = { attempts: number; best: number; last: number; lastAt: string };
    const stageMap = new Map<string, StageAgg>();
    let reviewAttempts = 0;
    let reviewLastAt: string | null = null;
    // Fe'l bo'yicha javoblar (vaqt tartibida)
    // streak — oxirgi xatodan keyingi ketma-ket to'g'ri javoblar (ilovadagi level bilan bir xil: ≥ 3 — mustahkam)
    type VerbAgg = { answers: number; wrong: number; streak: number; lastOk: boolean; wrongGiven: string[]; lastAt: string };
    const verbMap = new Map<string, VerbAgg>();

    for (const r of rows) {
      const parsed = parseVerbKey(r.exercise_key);
      if (!parsed) continue;
      if ('review' in parsed) {
        reviewAttempts++;
        reviewLastAt = r.answered_at;
      } else {
        const k = `${parsed.set}:${parsed.stage}`;
        const prev = stageMap.get(k);
        const pct = Number(r.percent);
        stageMap.set(k, {
          attempts: (prev?.attempts ?? 0) + 1,
          best: Math.max(prev?.best ?? 0, pct),
          last: pct,
          lastAt: r.answered_at,
        });
      }
      const items: ExerciseAnswerItem[] = Array.isArray(r.items) ? r.items : [];
      for (const it of items) {
        const v1 = verbOfQuestion(it.q);
        if (!v1) continue;
        const a = verbMap.get(v1) ?? { answers: 0, wrong: 0, streak: 0, lastOk: true, wrongGiven: [], lastAt: r.answered_at };
        a.answers++;
        if (it.ok) a.streak++;
        else {
          a.streak = 0;
          a.wrong++;
          const g = (it.given ?? '').trim();
          const label = g || '(javobsiz)';
          a.wrongGiven = [label, ...a.wrongGiven.filter((x) => x !== label)].slice(0, 3);
        }
        a.lastOk = !!it.ok;
        a.lastAt = r.answered_at;
        verbMap.set(v1, a);
      }
    }

    const verbs = IRREGULAR_VERBS.map((v) => {
      const a = verbMap.get(v.v1);
      const status: 'new' | 'learning' | 'wrong' | 'mastered' = !a
        ? 'new'
        : !a.lastOk
          ? 'wrong'
          : a.streak >= 3
            ? 'mastered'
            : 'learning';
      return {
        id: v.id,
        v1: v.v1,
        v2: v.v2,
        v3: v.v3,
        uz: v.uz,
        set: v.set,
        status,
        answers: a?.answers ?? 0,
        wrong: a?.wrong ?? 0,
        /** oxirgi noto'g'ri javoblari (eng yangisi birinchi) */
        wrongGiven: a?.wrongGiven ?? [],
        lastAt: a?.lastAt ?? null,
      };
    });

    const sets = Object.keys(VERB_SET_TITLES).map((no) => {
      const n = Number(no);
      return {
        no: n,
        title: VERB_SET_TITLES[n],
        verbCount: IRREGULAR_VERBS.filter((v) => v.set === n).length,
        stages: [2, 3, 4].map((stage) => {
          const agg = stageMap.get(`${n}:${stage}`);
          return {
            stage,
            title: VERB_STAGE_TITLES[stage],
            attempts: agg?.attempts ?? 0,
            bestPercent: agg ? agg.best : null,
            lastPercent: agg ? agg.last : null,
          };
        }),
      };
    });

    const count = (st: string) => verbs.filter((v) => v.status === st).length;
    const byV1 = new Map(IRREGULAR_VERBS.map((v) => [v.v1, v]));
    return {
      /** darsda shu bo'lim bormi (4-dars) — yo'q va natija ham yo'q bo'lsa panel chiqmaydi */
      available: !!available || rows.length > 0,
      /** o'quvchi bo'limni hali ishlamagan bo'lsa false */
      started: rows.length > 0,
      total: IRREGULAR_VERBS.length,
      mastered: count('mastered'),
      learning: count('learning'),
      wrong: count('wrong'),
      fresh: count('new'),
      review: { attempts: reviewAttempts, lastAt: reviewLastAt },
      sets,
      verbs,
      groupMistakes: groupRows.map((g: any) => ({
        v1: g.v1,
        v2: byV1.get(g.v1)?.v2 ?? null,
        wrongUsers: Number(g.wrong_users),
        users: Number(g.users),
      })),
    };
  }

  private async buildGrammar(rows: any[]) {
    type Attempt = {
      n: number;
      percent: number;
      correct: number | null;
      total: number | null;
      at: string;
      items: ExerciseAnswerItem[] | null;
    };
    const byKey = new Map<
      string,
      { key: string; section: string; title: string | null; sectionTotal: number; attempts: Attempt[] }
    >();

    for (const r of rows) {
      let ex = byKey.get(r.exercise_key);
      if (!ex) {
        ex = {
          key: r.exercise_key,
          section: String(r.exercise_key).split(':')[1] ?? 'grammar',
          title: null,
          sectionTotal: 0,
          attempts: [],
        };
        byKey.set(r.exercise_key, ex);
      }
      if (r.title) ex.title = r.title; // eng so'nggi nom (qatorlar vaqt bo'yicha o'sib boradi)
      ex.sectionTotal = Math.max(ex.sectionTotal, Number(r.section_total) || 0);
      ex.attempts.push({
        n: Number(r.attempt_number),
        percent: Number(r.percent),
        correct: r.correct_count ?? null,
        total: r.total_count ?? null,
        at: r.answered_at,
        items: Array.isArray(r.items) ? r.items : null,
      });
    }

    // Nomi yo'q (eski ilovadan kelgan) mashqlar: avval ekrandagi ro'yxatdan, bo'lmasa
    // boshqa o'quvchilarning yozuvidan olinadi
    for (const ex of byKey.values()) {
      if (!ex.title) ex.title = screenInfo(ex.key)?.title ?? RETIRED_GRAMMAR_TITLES[ex.key] ?? null;
    }
    const missing = [...byKey.values()].filter((e) => !e.title).map((e) => e.key);
    if (missing.length) {
      const titles: { exercise_key: string; title: string }[] = await this.ds.query(
        `SELECT DISTINCT ON (exercise_key) exercise_key, title
           FROM exercise_results
          WHERE exercise_key = ANY($1::varchar[]) AND title IS NOT NULL
          ORDER BY exercise_key, answered_at DESC`,
        [missing],
      );
      for (const t of titles) {
        const ex = byKey.get(t.exercise_key);
        if (ex) ex.title = t.title;
      }
    }

    // Tartib — ilova ekranidagi «Exercise 1, 2, …» (grammar-exercise-order.ts).
    // Ro'yxatda yo'q kalitlar (ekrandan olingan / hali kiritilmagan) — oxirida, kalit raqami bo'yicha.
    const ordered = [...byKey.values()]
      .map((ex) => ({ ex, no: screenInfo(ex.key)?.no ?? null }))
      .sort(
        (a, b) =>
          keyLesson(a.ex.key) - keyLesson(b.ex.key) ||
          Number(a.ex.section !== 'grammar') - Number(b.ex.section !== 'grammar') ||
          a.ex.section.localeCompare(b.ex.section) ||
          (a.no ?? 1000) - (b.no ?? 1000) ||
          keyNo(a.ex.key) - keyNo(b.ex.key),
      );

    const exercises = ordered.map(({ ex, no }) => {
      const first = ex.attempts[0];
      const last = ex.attempts[ex.attempts.length - 1];
      return {
        key: ex.key,
        section: ex.section,
        /** Ilova ekranidagi raqami («Exercise N»); null — ekranda yo'q */
        no,
        // Raqami alohida (`no`) — sarlavhaga qo'shilmaydi
        title: ex.title ?? (no != null ? 'Mashq' : `Mashq (${ex.key.split(':')[2] ?? ex.key})`),
        /** Ilova ekranidan olib tashlangan mashq (eski versiyada ishlangan) */
        retired: ex.key in RETIRED_GRAMMAR_TITLES,
        attemptsCount: ex.attempts.length,
        firstPercent: first.percent,
        bestPercent: Math.max(...ex.attempts.map((a) => a.percent)),
        lastPercent: last.percent,
        lastAt: last.at,
        // Juda ko'p urinishda: birinchi + oxirgi 9 tasi (birinchisi — haqiqiy tushunishni ko'rsatadi)
        attempts:
          ex.attempts.length > 10 ? [first, ...ex.attempts.slice(-9)] : ex.attempts,
      };
    });

    const sectionTotal = Math.max(0, ...[...byKey.values()].map((e) => e.sectionTotal));
    return {
      exercises,
      /** Ekrandagi mashqlardan nechtasi ishlangan (olib tashlangan eski mashqlar sanalmaydi) */
      done: exercises.filter((e) => !e.retired).length,
      /** Bo'limdagi jami mashqlar (ilova aytgani bo'yicha); 0 — noma'lum */
      total: sectionTotal,
      /** Savollar bo'yicha tafsilot bormi (faqat yangi ilova versiyasidan) */
      hasItems: exercises.some((e) => e.attempts.some((a) => a.items?.length)),
    };
  }

  // ── Reading / Listening / Test (bazadagi bloklar) ───────────────────────

  private buildBlocks(rows: any[]) {
    const blocks = new Map<
      string,
      {
        blockId: string;
        type: string;
        title: string;
        exercises: Map<string, { id: string; title: string | null; type: string; items: DetailItem[] }>;
      }
    >();

    for (const r of rows) {
      let b = blocks.get(r.block_id);
      if (!b) {
        b = {
          blockId: r.block_id,
          type: r.block_type,
          title: r.block_title ?? SECTION_LABEL[r.block_type] ?? r.block_type,
          exercises: new Map(),
        };
        blocks.set(r.block_id, b);
      }
      let ex = b.exercises.get(r.exercise_id);
      if (!ex) {
        ex = { id: r.exercise_id, title: r.exercise_title ?? null, type: r.exercise_type, items: [] };
        b.exercises.set(r.exercise_id, ex);
      }
      ex.items.push(this.formatAnswer(r));
    }

    return [...blocks.values()].map((b) => {
      const exercises = [...b.exercises.values()].map((e) => {
        const graded = e.items.filter((i) => !i.ungraded);
        return {
          id: e.id,
          title: e.title,
          type: e.type,
          correct: graded.filter((i) => i.ok).length,
          answered: graded.length,
          items: e.items,
        };
      });
      const correct = exercises.reduce((s, e) => s + e.correct, 0);
      const answered = exercises.reduce((s, e) => s + e.answered, 0);
      return {
        blockId: b.blockId,
        type: b.type,
        label: SECTION_LABEL[b.type] ?? b.type,
        title: b.title,
        correct,
        answered,
        percent: answered ? Math.round((correct / answered) * 100) : null,
        exercises,
      };
    });
  }

  /** Bazadagi javobni o'qiladigan ko'rinishga keltiradi (mashq turiga qarab) */
  private formatAnswer(r: any): DetailItem {
    const options: Option[] = Array.isArray(r.options) ? r.options : [];
    const given: string | null = r.given_answer ?? null;
    const base = { q: r.item_text ?? '', ok: !!r.is_correct };

    switch (r.exercise_type) {
      case 'true_false': {
        const tf = (v: string | null) =>
          v == null ? null : /^t(rue)?$/i.test(v.trim()) ? 'True' : /^f(alse)?$/i.test(v.trim()) ? 'False' : v;
        return { ...base, given: tf(given), expected: tf(r.correct_answer) ?? '' };
      }
      case 'multiple_choice': {
        const right = options.find((o) => typeof o === 'object' && o?.isCorrect);
        const expected = (typeof right === 'object' ? right?.text : null) ?? r.correct_answer ?? '';
        return { ...base, given, expected };
      }
      case 'matching': {
        // Javob JSON: { chapSoz: tanlanganO'ngSoz }
        let submitted: Record<string, string> = {};
        try {
          const parsed = given ? JSON.parse(given) : {};
          if (parsed && typeof parsed === 'object') submitted = parsed;
        } catch {
          /* buzilgan javob — bo'sh deb olinadi */
        }
        const pairs = options.filter(
          (o): o is { text?: string; matchKey?: string | null } => typeof o === 'object' && o?.matchKey != null,
        );
        return {
          ...base,
          given: pairs.length
            ? pairs.map((o) => `${o.text ?? ''} → ${submitted[o.text ?? ''] ?? '—'}`).join('; ')
            : given,
          expected: pairs.map((o) => `${o.text ?? ''} → ${o.matchKey}`).join('; ') || (r.correct_answer ?? ''),
        };
      }
      case 'translation':
        return { ...base, given, expected: r.correct_answer ?? '', ungraded: true };
      default:
        return { ...base, given, expected: r.correct_answer ?? '' };
    }
  }
}

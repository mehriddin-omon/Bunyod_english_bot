import { MigrationInterface, QueryRunner } from 'typeorm';
import { computeLessonScore, ExerciseBest, vocabularyPercent } from 'src/common/utils/lesson-score';

/**
 * DARS BALLINI QAYTA HISOBLASH (2026-10).
 *
 * Avval `lesson_progress.score` ni ilova dars yakunlangan PAYTDA o'zi hisoblab yuborardi
 * (telefon keshidan) va backend uni keyin o'zgartirmasdi — yakunlangandan keyingi urinishlar
 * ballga tushmasdi. Reading/listening/test topshirilganda esa boshqa formula (statik
 * grammatikasiz) yozardi. Endi ball backend'da yagona formula bilan hisoblanadi — bo'lim kartalari
 * (Grammatika, Lug'at, Reading, Listening, Test, Speaking) o'rtachasi
 * (`src/common/utils/lesson-score.ts`, LessonScoreService). Bu migratsiya eski yozuvlarni shu formulaga keltiradi.
 *
 * Hech qaysi bo'lim ishlanmagan yozuvda ball o'zgarmaydi. Idempotent — qayta ishlatsa ham bo'ladi.
 */
export class RecalcLessonScores1790100000000 implements MigrationInterface {
  name = 'RecalcLessonScores1790100000000';

  public async up(q: QueryRunner): Promise<void> {
    const progress: {
      id: string;
      user_id: string;
      lesson_id: string;
      score: number | null;
      grammar_score: number | null;
      reading_score: number | null;
      listening_score: number | null;
      quiz_score: number | null;
      speaking_score: number | null;
    }[] = await q.query(
      `SELECT id, user_id, lesson_id, score, grammar_score, reading_score, listening_score, quiz_score, speaking_score
         FROM lesson_progress`,
    );
    if (!progress.length) return;

    const bestRows: { user_id: string; lesson_id: string; exercise_key: string; best: number }[] = await q.query(
      `SELECT user_id, lesson_id, exercise_key, MAX(percent)::float AS best
         FROM exercise_results
        GROUP BY user_id, lesson_id, exercise_key`,
    );
    const bests = new Map<string, ExerciseBest[]>();
    for (const r of bestRows) {
      const k = `${r.user_id}|${r.lesson_id}`;
      const list = bests.get(k) ?? [];
      list.push({ exerciseKey: r.exercise_key, best: Number(r.best) });
      bests.set(k, list);
    }

    // Lug'at: lug'ati ishlangan (o'quvchi × dars) — jami va mustahkam so'zlar
    const vocabRows: { user_id: string; lesson_id: string; total: number; mastered: number }[] = await q.query(
      `WITH words AS (
         SELECT src.lesson_id, r.id AS pair_id
           FROM vocabulary_relations r
           JOIN vocabularys src ON src.id = r.vocabulary_id AND src.lang = 'en'
          WHERE src.lesson_id IS NOT NULL
       ), totals AS (
         SELECT lesson_id, count(*)::int AS total FROM words GROUP BY lesson_id
       ), touched AS (
         SELECT user_id, lesson_id FROM vocabulary_stage_progress
         UNION
         SELECT user_id, lesson_id FROM vocabulary_coin_tests
         UNION
         SELECT uvp.user_id, w.lesson_id
           FROM user_vocabulary_progress uvp
           JOIN words w ON w.pair_id = uvp.pair_id
          WHERE uvp.attempts > 0 OR uvp.status <> 'new'
       ), mastered AS (
         SELECT uvp.user_id, w.lesson_id, count(*)::int AS mastered
           FROM user_vocabulary_progress uvp
           JOIN words w ON w.pair_id = uvp.pair_id
          WHERE uvp.status = 'mastered'
          GROUP BY uvp.user_id, w.lesson_id
       )
       SELECT t.user_id, t.lesson_id, tt.total, COALESCE(m.mastered, 0) AS mastered
         FROM touched t
         JOIN totals tt ON tt.lesson_id = t.lesson_id
    LEFT JOIN mastered m ON m.user_id = t.user_id AND m.lesson_id = t.lesson_id`,
    );
    const vocab = new Map<string, number | null>(
      vocabRows.map((r) => [`${r.user_id}|${r.lesson_id}`, vocabularyPercent(Number(r.mastered), Number(r.total), true)]),
    );

    const ids: string[] = [];
    const scores: number[] = [];
    for (const p of progress) {
      const score = computeLessonScore({
        exerciseBests: bests.get(`${p.user_id}|${p.lesson_id}`) ?? [],
        grammarScore: p.grammar_score,
        readingScore: p.reading_score,
        listeningScore: p.listening_score,
        quizScore: p.quiz_score,
        speakingScore: p.speaking_score,
        vocabularyPercent: vocab.get(`${p.user_id}|${p.lesson_id}`) ?? null,
      });
      if (score != null && score !== p.score) {
        ids.push(p.id);
        scores.push(score);
      }
    }

    for (let i = 0; i < ids.length; i += 1000) {
      await q.query(
        `UPDATE lesson_progress AS lp
            SET score = v.score, updated_at = now()
           FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS score) v
          WHERE lp.id = v.id`,
        [ids.slice(i, i + 1000), scores.slice(i, i + 1000)],
      );
    }
  }

  public async down(): Promise<void> {
    // Eski (ilova yuborgan) ballar saqlanmagan — qaytarib bo'lmaydi
  }
}

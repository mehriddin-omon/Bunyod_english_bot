import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { computeLessonScore, ExerciseBest, vocabularyPercent } from 'src/common/utils/lesson-score';

type BlockScores = {
  grammarScore: number | null;
  readingScore: number | null;
  listeningScore: number | null;
  quizScore: number | null;
  speakingScore?: number | null;
};

/**
 * Dars ballini (`lesson_progress.score`) backend'da hisoblaydi — formula `utils/lesson-score.ts` da
 * (bo'lim kartalari o'rtachasi).
 *
 * Ball ilova yuborgan qiymatga tayanmaydi va dars yakunlangandan keyin ham yangilanadi:
 * grammatika natijasi (`exercise-results`), reading/listening/test javobi (`student-answers`),
 * lug'at bosqichi va coinli sinov (`vocabulary`), darsni yakunlash (`progress`) — hammasi shu servis orqali.
 */
@Injectable()
export class LessonScoreService {
  private readonly logger = new Logger(LessonScoreService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Statik mashqlar: har kalit bo'yicha eng yaxshi foiz */
  private async exerciseBests(userId: string, lessonId: string): Promise<ExerciseBest[]> {
    const rows: { exercise_key: string; best: number }[] = await this.ds.query(
      `SELECT exercise_key, MAX(percent)::float AS best
         FROM exercise_results
        WHERE user_id = $1 AND lesson_id = $2
        GROUP BY exercise_key`,
      [userId, lessonId],
    );
    return rows.map((r) => ({ exerciseKey: r.exercise_key, best: Number(r.best) }));
  }

  /**
   * Darsning lug'ati: so'zlar soni, mustahkamlari va foiz (`vocabularyPercent`).
   * Lug'at «ishlangan» — bosqich, coinli sinov yoki so'z mashqi bor bo'lsa.
   */
  async vocabulary(userId: string, lessonId: string) {
    const [r] = await this.ds.query(
      `WITH w AS (
         SELECT r.id AS pair_id
           FROM vocabulary_relations r
           JOIN vocabularys src ON src.id = r.vocabulary_id AND src.lang = 'en'
          WHERE src.lesson_id = $2 AND vocab_visible($1, src.lesson_id, src.set_no)
       )
       SELECT (SELECT count(*)::int FROM w) AS total,
              (SELECT count(*)::int FROM user_vocabulary_progress uvp JOIN w ON w.pair_id = uvp.pair_id
                WHERE uvp.user_id = $1 AND uvp.status = 'mastered') AS mastered,
              (EXISTS (SELECT 1 FROM user_vocabulary_progress uvp JOIN w ON w.pair_id = uvp.pair_id
                        WHERE uvp.user_id = $1 AND (uvp.attempts > 0 OR uvp.status <> 'new'))
               OR EXISTS (SELECT 1 FROM vocabulary_stage_progress WHERE user_id = $1 AND lesson_id = $2)
               OR EXISTS (SELECT 1 FROM vocabulary_coin_tests WHERE user_id = $1 AND lesson_id = $2)) AS touched`,
      [userId, lessonId],
    );
    const total = Number(r?.total ?? 0);
    const mastered = Number(r?.mastered ?? 0);
    return { total, mastered, percent: vocabularyPercent(mastered, total, !!r?.touched) };
  }

  /**
   * Ball — berilgan bo'lim ballari (hali saqlanmagan bo'lishi mumkin) + bazadagi statik mashqlar
   * va lug'at. `null` — hech narsa ishlanmagan.
   */
  async compute(userId: string, lessonId: string, blocks: BlockScores | null): Promise<number | null> {
    const [exerciseBests, vocab] = await Promise.all([
      this.exerciseBests(userId, lessonId),
      this.vocabulary(userId, lessonId),
    ]);
    return computeLessonScore({
      exerciseBests,
      grammarScore: blocks?.grammarScore ?? null,
      readingScore: blocks?.readingScore ?? null,
      listeningScore: blocks?.listeningScore ?? null,
      quizScore: blocks?.quizScore ?? null,
      speakingScore: blocks?.speakingScore ?? null,
      vocabularyPercent: vocab.percent,
    });
  }

  /**
   * Bir nechta `lesson_progress.score` ni bitta so'rovda yozadi — o'qish paytida eskirgan
   * ball topilsa (masalan migratsiya hali ishlamagan) shu bilan tuzatiladi. Xato yiqitmaydi.
   */
  async saveScores(rows: { id: string; score: number }[]): Promise<void> {
    if (!rows.length) return;
    try {
      await this.ds.query(
        `UPDATE lesson_progress AS lp
            SET score = v.score, updated_at = now()
           FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS score) v
          WHERE lp.id = v.id AND lp.score IS DISTINCT FROM v.score`,
        [rows.map((r) => r.id), rows.map((r) => r.score)],
      );
    } catch (e) {
      this.logger.warn(`Dars ballarini yozib bo'lmadi: ${(e as Error).message}`);
    }
  }

  /**
   * Bazadagi ballni qayta hisoblab yozadi. `lesson_progress` yozuvi bo'lmasa hech narsa qilmaydi.
   * Xato so'rovni yiqitmaydi (ball — yordamchi ma'lumot), faqat logga yoziladi.
   */
  async refresh(userId: string, lessonId: string): Promise<void> {
    try {
      const [p] = await this.ds.query(
        `SELECT id, score, grammar_score, reading_score, listening_score, quiz_score, speaking_score
           FROM lesson_progress
          WHERE user_id = $1 AND lesson_id = $2`,
        [userId, lessonId],
      );
      if (!p) return;
      const score = await this.compute(userId, lessonId, {
        grammarScore: p.grammar_score,
        readingScore: p.reading_score,
        listeningScore: p.listening_score,
        quizScore: p.quiz_score,
        speakingScore: p.speaking_score,
      });
      if (score != null && score !== p.score) await this.saveScores([{ id: p.id, score }]);
    } catch (e) {
      this.logger.warn(`Dars ballini yangilab bo'lmadi (${userId}, ${lessonId}): ${(e as Error).message}`);
    }
  }
}

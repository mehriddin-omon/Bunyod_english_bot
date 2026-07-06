import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import {
  UserVocabularyProgress,
  VocabStatus,
} from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { LessonProgressStatus } from 'src/common/utils/enum';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(LessonProgress)
    private readonly progressRepo: Repository<LessonProgress>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(UserVocabularyProgress)
    private readonly vocabProgressRepo: Repository<UserVocabularyProgress>,
  ) {}

  /** Foizga qarab taxminiy CEFR darajasi (statik B1 o'rniga). */
  private pctToLevel(pct: number): string {
    if (pct >= 90) return 'C1';
    if (pct >= 75) return 'B2';
    if (pct >= 55) return 'B1';
    if (pct >= 35) return 'A2';
    return 'A1';
  }

  /** Berilgan ustun bo'yicha null bo'lmagan ballar o'rtachasi (0 agar yo'q). */
  private avgOf(rows: LessonProgress[], field: keyof LessonProgress): number {
    const vals = rows
      .map((p) => p[field] as number | null)
      .filter((v): v is number => v != null);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  async getStudentStatistics(userId: string, lessonId: string) {
    const progress = await this.progressRepo.findOne({ where: { userId, lessonId } });

    return {
      lesson_id: lessonId,
      user_id: userId,
      status: progress?.status ?? LessonProgressStatus.not_started,
      score: progress?.score ?? 0,
      completed_at: progress?.completedAt ?? null,
    };
  }

  async getGroupStatistics(groupId: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) return null;

    const memberIds = group.members.map((m) => m.id);
    const progressData = memberIds.length
      ? await this.progressRepo
          .createQueryBuilder('p')
          .where('p.userId IN (:...memberIds)', { memberIds })
          .getMany()
      : [];

    const statisticsByStudent: Record<string, any> = {};
    group.members.forEach((member) => {
      const memberProgress = progressData.filter((p) => p.userId === member.id);
      const completedCount = memberProgress.filter((p) => p.status === LessonProgressStatus.completed).length;
      const avgScore =
        completedCount > 0
          ? (memberProgress.filter((p) => p.score != null).reduce((acc, p) => acc + (p.score ?? 0), 0) / completedCount).toFixed(1)
          : 0;

      statisticsByStudent[member.id] = {
        username: member.username ?? member.id,
        lessons_completed: completedCount,
        average_score: avgScore,
      };
    });

    const totalCompleted = progressData.filter((p) => p.status === LessonProgressStatus.completed).length;
    const classAverageScore =
      totalCompleted > 0
        ? (progressData.filter((p) => p.score != null).reduce((acc, p) => acc + (p.score ?? 0), 0) / totalCompleted).toFixed(1)
        : 0;

    return {
      group_id: groupId,
      group_name: group.name,
      member_count: group.members.length,
      completed_count: totalCompleted,
      class_average_score: classAverageScore,
      statistics_by_student: statisticsByStudent,
    };
  }

  async getLessonStatistics(lessonId: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) return null;

    const progressData = await this.progressRepo.find({ where: { lessonId } });
    const completedCount = progressData.filter((p) => p.status === LessonProgressStatus.completed).length;
    const averageScore =
      completedCount > 0
        ? (progressData.filter((p) => p.score != null).reduce((acc, p) => acc + (p.score ?? 0), 0) / completedCount).toFixed(1)
        : 0;

    return {
      lesson_id: lessonId,
      lessonName: lesson.lessonName,
      total_students: progressData.length,
      completed_students: completedCount,
      average_score: averageScore,
    };
  }

  async getUserOverallStatistics(userId: string) {
    const allProgress = await this.progressRepo.find({ where: { userId } });
    if (allProgress.length === 0) {
      return {
        user_id: userId,
        total_lessons: 0,
        completed_lessons: 0,
        average_score: 0,
      };
    }

    const completedCount = allProgress.filter((p) => p.status === LessonProgressStatus.completed).length;
    const scored = allProgress.filter((p) => p.score != null);
    const averageScore = scored.length
      ? (scored.reduce((acc, p) => acc + (p.score ?? 0), 0) / scored.length).toFixed(1)
      : 0;

    return {
      user_id: userId,
      total_lessons: allProgress.length,
      completed_lessons: completedCount,
      average_score: averageScore,
    };
  }

  async getMyStats(userId: string) {
    const allProgress = await this.progressRepo.find({ where: { userId } });
    const completedCount = allProgress.filter((p) => p.status === LessonProgressStatus.completed).length;
    const scored = allProgress.filter((p) => p.score != null);
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, p) => s + (p.score ?? 0), 0) / scored.length)
      : 0;

    // Skill foizlari endi haqiqiy lesson_progress ustunlaridan hisoblanadi
    // (avval qattiq kodlangan qiymatlar edi — quiz.md 5.3 ga mos).
    const readingPct = this.avgOf(allProgress, 'readingScore');
    const grammarPct = this.avgOf(allProgress, 'grammarScore');
    const listeningPct = this.avgOf(allProgress, 'listeningScore');
    const vocabPct = this.avgOf(allProgress, 'vocabularyScore');
    const speakingPct = this.avgOf(allProgress, 'speakingScore');
    // Writing uchun alohida ustun yo'q — quiz bali proksisi sifatida ishlatamiz
    const writingPct = this.avgOf(allProgress, 'quizScore');

    // Haqiqiy lug'at holati
    const [learnedWords, masteredWords] = await Promise.all([
      this.vocabProgressRepo.count({
        where: [
          { userId, status: VocabStatus.learning },
          { userId, status: VocabStatus.mastered },
        ],
      }),
      this.vocabProgressRepo.count({ where: { userId, status: VocabStatus.mastered } }),
    ]);
    const retention = learnedWords ? Math.round((masteredWords / learnedWords) * 100) : 0;

    const cefrProgress = Math.round(
      (readingPct + grammarPct + listeningPct + vocabPct) / 4,
    );

    return {
      cefr_level: this.pctToLevel(cefrProgress),
      cefr_progress: cefrProgress,
      skills: {
        reading: { level: this.pctToLevel(readingPct), pct: readingPct },
        grammar: { level: this.pctToLevel(grammarPct), pct: grammarPct },
        writing: { level: this.pctToLevel(writingPct), pct: writingPct },
        vocabulary: { level: this.pctToLevel(vocabPct), pct: vocabPct, word_count: learnedWords },
        listening: { level: this.pctToLevel(listeningPct), pct: listeningPct },
        speaking: { level: this.pctToLevel(speakingPct), pct: speakingPct },
      },
      vocabulary: {
        total: learnedWords,
        retention,
        by_level: [],
      },
      activity_heatmap: [],
      weekly_minutes: [],
      gamification: null,
      completed_lessons: completedCount,
      avg_score: avgScore,
    };
  }

  async updateProgress(userId: string, lessonId: string, data: Partial<LessonProgress>) {
    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });

    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId, ...data });
    } else {
      Object.assign(progress, data);
    }

    return this.progressRepo.save(progress);
  }
}

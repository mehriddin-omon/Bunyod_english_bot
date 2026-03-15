import { Repository } from 'typeorm';
import { UserVocabularyStats } from 'src/common/core/entitys/user-vocabulary-stats.entity';

export class VocabularyStatsService {
  constructor(
    private readonly statsRepository: Repository<UserVocabularyStats>,
  ) {}

  async insertUserVocabularyStat(
    userId: string,
    vocabularyRelationId: string,
    lang: string,
    isCorrect: boolean,
  ) {
    // Avval mavjud yozuvni tekshiramiz
    let stat = await this.statsRepository.findOne({
      where: { user_id: userId, vocabulary_relation_id: vocabularyRelationId, lang },
    });

    if (!stat) {
      // Agar yozuv bo‘lmasa, yangisini yaratamiz
      stat = this.statsRepository.create({
        user_id: userId,
        vocabulary_relation_id: vocabularyRelationId,
        lang,
        attempts: 0,
        wrong_attempts: 0,
        last_attempt: new Date(),
      });
    }

    // Statistikani yangilaymiz
    stat.attempts += 1;
    if (!isCorrect) {
      stat.wrong_attempts += 1;
    }
    stat.last_attempt = new Date();

    return this.statsRepository.save(stat);
  }
}
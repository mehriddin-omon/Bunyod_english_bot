import { Repository } from 'typeorm';
import { UserVocabularyStats } from 'src/common/core/entitys/user-vocabulary-stats.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { VocabularyRelations } from 'src/common/core/entitys/vocabulary.entity';

export class VocabularyStatsService {
  constructor(
    private readonly statsRepository: Repository<UserVocabularyStats>,
  ) {}

  async insertUserVocabularyStat(
    user: User,
    vocabularyRelation: VocabularyRelations,
    lang: string,
    isCorrect: boolean,
  ) {
    // Avval mavjud yozuvni tekshiramiz
    let stat = await this.statsRepository.findOne({
      where: {
        user: { id: user.id },
        vocabularyRelation: { id: vocabularyRelation.id },
        lang,
      },
      relations: ['user', 'vocabularyRelation'],
    });

    if (!stat) {
      // Agar yozuv bo‘lmasa, yangisini yaratamiz
      stat = this.statsRepository.create({
        user,
        vocabularyRelation,
        lang,
        attempts: 0,
        wrong_attempts: 0,
        last_attempts: Date.now(),
      });
    }

    // Statistikani yangilaymiz
    stat.attempts += 1;
    if (!isCorrect) {
      stat.wrong_attempts += 1;
    }
    stat.last_attempts = Date.now();

    return this.statsRepository.save(stat);
  }
}
import { Repository } from 'typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { UserVocabularyStats } from 'src/common/core/entitys/user-vocabulary-stats.entity';
import { VocabularyRelations } from 'src/common/core/entitys/vocabulary.entity';
import { CreateUserVocabularyStatsDto } from './dto/create-result.dto';
import { InjectRepository } from '@nestjs/typeorm';

export class VocabularyStatsService {
  constructor(
    @InjectRepository(UserVocabularyStats)
    private readonly statsRepository: Repository<UserVocabularyStats>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(VocabularyRelations)
    private readonly vocabularyRelationsRepository: Repository<VocabularyRelations>,

  ) { }

  async insertUserVocabularyStats(dto: CreateUserVocabularyStatsDto) {
    const user = await this.userRepository.findOne({ where: { id: dto.user_id } });
    const vocabulary_relation = await this.vocabularyRelationsRepository.findOne({
      where: { id: dto.vocabulary_relation_id },
    });

    if (!user || !vocabulary_relation) {
      throw new Error('User yoki VocabularyRelation topilmadi');
    }
    await this.updateVocabularyRelationStats(dto.vocabulary_relation_id, dto.is_correct)

    // Avval mavjud yozuvni tekshiramiz
    let stat = await this.statsRepository
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.user', 'user')
      .leftJoinAndSelect('stats.vocabulary_relation', 'relation')
      .where('user.id = :userId', { userId: dto.user_id })
      .andWhere('relation.id = :relationId', { relationId: dto.vocabulary_relation_id })
      .andWhere('stats.lang = :lang', { lang: dto.lang ?? 'en' })
      .getOne();


    if (!stat) {
      // Agar yozuv bo‘lmasa, yangisini yaratamiz
      stat = this.statsRepository.create({
        user,
        vocabulary_relation,
        lang: dto.lang ?? 'en',
        attempts: 0,
        wrong_attempts: 0
      });
    }

    // Statistikani yangilaymiz
    stat.attempts += 1;
    if (!dto.is_correct) {
      stat.wrong_attempts += 1;
    }

    return await this.statsRepository.save(stat);
  }

  async updateVocabularyRelationStats(
    relation_id: string,
    is_correct: boolean,
  ) {
    const relation = await this.vocabularyRelationsRepository.findOne({
      where: { id: relation_id },
    });

    if (!relation) {
      throw new Error('VocabularyRelation topilmadi');
    }

    // umumiy urinishni oshiramiz
    relation.attempts += 1;

    // xato bo‘lsa wrong_attempts oshadi
    if (!is_correct) {
      relation.wrong_attempts += 1;
    }

    // qiyinchilikni hisoblaymiz
    relation.difficulty = relation.attempts > 0
      ? Math.round((relation.wrong_attempts / relation.attempts * 100) * 100) / 100
      : 0;

    return await this.vocabularyRelationsRepository.save(relation);
  }
}
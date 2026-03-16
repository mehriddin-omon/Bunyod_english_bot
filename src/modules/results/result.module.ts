import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VocabularyStatsService } from "./vocabularystats.service";
import { Vocabulary, VocabularyRelations } from "src/common/core/entitys/vocabulary.entity";
import { User } from "src/common/core/entitys/user.entity";
import { UserVocabularyStats } from "src/common/core/entitys/user-vocabulary-stats.entity";
import { ResultController } from "./result.controller";


@Module({
  imports: [
    TypeOrmModule.forFeature([Vocabulary, VocabularyRelations, User, UserVocabularyStats]),
  ],
  providers: [VocabularyStatsService],
  controllers: [ResultController],
  exports: [VocabularyStatsService],
})
export class VocabularyStatsModule {}
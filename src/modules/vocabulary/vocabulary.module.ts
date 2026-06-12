import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { VocabularyService } from './vocabulary.service';
import { VocabularyController } from './vocabulary.controller';
import { GuardModule } from '@my/common';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([Vocabulary, UserVocabularyProgress]),
  ],
  providers: [VocabularyService],
  controllers: [VocabularyController],
  exports: [VocabularyService],
})
export class VocabularyModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyWord, VocabularyReview } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyService } from './vocabulary.service';
import { VocabularyController } from './vocabulary.controller';
import { GuardModule } from '@my/common';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([VocabularyWord, VocabularyReview]),
  ],
  providers: [VocabularyService],
  controllers: [VocabularyController],
  exports: [VocabularyService],
})
export class VocabularyModule {}

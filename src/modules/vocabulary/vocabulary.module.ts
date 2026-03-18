import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vocabulary, VocabularyRelations } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyService } from './vocabulary.service';
import { VocabularyController } from './vocabulary.controller';
import { Lesson } from 'src/common/core/entitys/lesson.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vocabulary, VocabularyRelations, Lesson]),
  ],
  providers: [VocabularyService],
  controllers: [VocabularyController],
  exports: [VocabularyService],
})
export class VocabularyModule { }
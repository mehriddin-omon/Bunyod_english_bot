import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyRelation } from 'src/common/core/entitys/vocabulary-relation.entity';
import { VocabularyExample } from 'src/common/core/entitys/vocabulary-example.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { VocabularyPracticeLog } from 'src/common/core/entitys/vocabulary-practice-log.entity';
import { VocabularySession } from 'src/common/core/entitys/vocabulary-session.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { VocabularyService } from './vocabulary.service';
import { VocabularyStudentController } from './vocabulary-student.controller';
import { VocabularyTeacherController } from './vocabulary-teacher.controller';
import { TtsService } from './tts.service';
import { GuardModule } from '@my/common';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([Vocabulary, VocabularyRelation, VocabularyExample, UserVocabularyProgress, VocabularyPracticeLog, VocabularySession, Lesson]),
  ],
  providers: [VocabularyService, TtsService],
  controllers: [VocabularyStudentController, VocabularyTeacherController],
  exports: [VocabularyService],
})
export class VocabularyModule {}

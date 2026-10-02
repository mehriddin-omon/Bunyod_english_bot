import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyRelation } from 'src/common/core/entitys/vocabulary-relation.entity';
import { VocabularyExample } from 'src/common/core/entitys/vocabulary-example.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { VocabularyPracticeLog } from 'src/common/core/entitys/vocabulary-practice-log.entity';
import { VocabularySession } from 'src/common/core/entitys/vocabulary-session.entity';
import { VocabularyCoinTest } from 'src/common/core/entitys/vocabulary-coin-test.entity';
import { VocabularyStageProgress } from 'src/common/core/entitys/vocabulary-stage-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { VocabularyService } from './vocabulary.service';
import { VocabularyCoinTestService } from './vocabulary-coin-test.service';
import { VocabularyStudentController } from './vocabulary-student.controller';
import { VocabularyTeacherController } from './vocabulary-teacher.controller';
import { TtsService } from './tts.service';
import { GuardModule } from '@my/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LessonGatingModule } from 'src/common/services/lesson-gating.module';

@Module({
  imports: [
    GuardModule,
    // GamificationModule — coinli sinov coinini saqlash uchun (XpService)
    GamificationModule,
    // LessonGatingModule — sinov muddati: keyingi dars sinfda qachon ochilgan
    LessonGatingModule,
    TypeOrmModule.forFeature([
      Vocabulary,
      VocabularyRelation,
      VocabularyExample,
      UserVocabularyProgress,
      VocabularyPracticeLog,
      VocabularySession,
      VocabularyCoinTest,
      VocabularyStageProgress,
      Lesson,
    ]),
  ],
  providers: [VocabularyService, VocabularyCoinTestService, TtsService],
  controllers: [VocabularyStudentController, VocabularyTeacherController],
  exports: [VocabularyService, VocabularyCoinTestService],
})
export class VocabularyModule {}

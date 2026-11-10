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
import { User } from 'src/common/core/entitys/user.entity';
import { VocabularyComment } from 'src/common/core/entitys/vocabulary-comment.entity';
import { VocabularyCommentLike } from 'src/common/core/entitys/vocabulary-comment-like.entity';
import { VocabularyCommentReport } from 'src/common/core/entitys/vocabulary-comment-report.entity';
import { VocabularySaved } from 'src/common/core/entitys/vocabulary-saved.entity';
import { VocabularyLentaState } from 'src/common/core/entitys/vocabulary-lenta-state.entity';
import { VocabularyLearnService } from './vocabulary-learn.service';
import { VocabularyLearnController } from './vocabulary-learn.controller';
import { VocabularyCommentsService } from './vocabulary-comments.service';
import { VocabularyCommentsController, VocabularyCommentsTeacherController } from './vocabulary-comments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { VocabularyService } from './vocabulary.service';
import { VocabularyCoinTestService } from './vocabulary-coin-test.service';
import { VocabularyStudentController } from './vocabulary-student.controller';
import { VocabularyTeacherController } from './vocabulary-teacher.controller';
import { TtsService } from './tts.service';
import { GuardModule } from '@my/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LessonGatingModule } from 'src/common/services/lesson-gating.module';
import { LessonScoreModule } from 'src/common/services/lesson-score.module';

@Module({
  imports: [
    GuardModule,
    // GamificationModule — coinli sinov coinini saqlash uchun (XpService)
    GamificationModule,
    // LessonGatingModule — dars qulflari (mehmon chegarasi va h.k.)
    LessonGatingModule,
    // LessonScoreModule — lug'at natijasidan keyin dars ballini qayta hisoblash
    LessonScoreModule,
    // NotificationsModule — izoh coin/tasdiq bildirishnomalari
    NotificationsModule,
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
      User,
      VocabularyComment,
      VocabularyCommentLike,
      VocabularyCommentReport,
      VocabularySaved,
      VocabularyLentaState,
    ]),
  ],
  providers: [VocabularyService, VocabularyCoinTestService, VocabularyCommentsService, VocabularyLearnService, TtsService],
  controllers: [
    VocabularyStudentController,
    VocabularyLearnController,
    VocabularyTeacherController,
    VocabularyCommentsController,
    VocabularyCommentsTeacherController,
  ],
  exports: [VocabularyService, VocabularyCoinTestService, VocabularyCommentsService, VocabularyLearnService],
})
export class VocabularyModule {}

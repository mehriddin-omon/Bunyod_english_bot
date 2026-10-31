import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { LessonGatingModule } from 'src/common/services/lesson-gating.module';
import { LessonAccessGuard } from 'src/common/guard/lesson-access.guard';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { ListeningTranscript } from 'src/common/core/entitys/listening-transcript.entity';
import { QuizContent } from 'src/common/core/entitys/quiz-content.entity';
import { Exercise } from 'src/common/core/entitys/exercise.entity';
import { ExerciseItem } from 'src/common/core/entitys/exercise-item.entity';
import { StudentAnswer } from 'src/common/core/entitys/student-answer.entity';
import { UserGamification, XpTransaction } from 'src/common/core/entitys/gamification.entity';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyRelation } from 'src/common/core/entitys/vocabulary-relation.entity';
import { StudentAnswersService } from './student-answers.service';
import { LessonScoreModule } from 'src/common/services/lesson-score.module';

@Module({
  imports: [
    GuardModule,
    LessonScoreModule,
    LessonGatingModule,
    TypeOrmModule.forFeature([
      Lesson,
      Unit,
      LessonProgress,
      GrammarContent,
      ReadingContent,
      ListeningContent,
      ListeningTranscript,
      QuizContent,
      Exercise,
      ExerciseItem,
      StudentAnswer,
      UserGamification,
      Vocabulary,
      VocabularyRelation,
      XpTransaction,
    ]),
  ],
  providers: [LessonsService, StudentAnswersService, LessonAccessGuard],
  controllers: [LessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}

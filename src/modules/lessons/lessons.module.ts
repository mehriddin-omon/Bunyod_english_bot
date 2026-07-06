import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
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
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { StudentAnswersService } from './student-answers.service';

@Module({
  imports: [
    GuardModule,
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
    ]),
  ],
  providers: [LessonsService, StudentAnswersService],
  controllers: [LessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}

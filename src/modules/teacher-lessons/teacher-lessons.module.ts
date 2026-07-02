import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ReadingQuestion } from 'src/common/core/entitys/reading-question.entity';
import { ReadingOption } from 'src/common/core/entitys/reading-option.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { ListeningTranscript } from 'src/common/core/entitys/listening-transcript.entity';
import { ListeningQuestion } from 'src/common/core/entitys/listening-question.entity';
import { ListeningOption } from 'src/common/core/entitys/listening-option.entity';
import { QuizContent } from 'src/common/core/entitys/quiz-content.entity';
import { QuizExercise } from 'src/common/core/entitys/quiz-exercise.entity';
import { QuizItem } from 'src/common/core/entitys/quiz-item.entity';
import { QuizStudentAnswer } from 'src/common/core/entitys/quiz-student-answer.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { TeacherLessonsService } from './teacher-lessons.service';
import { BlocksService } from './blocks.service';
import { TeacherLessonsController } from './teacher-lessons.controller';
import { BlocksController } from './blocks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      Unit,
      GrammarContent,
      Group,
      ReadingContent,
      ReadingQuestion,
      ReadingOption,
      ListeningContent,
      ListeningTranscript,
      ListeningQuestion,
      ListeningOption,
      QuizContent,
      QuizExercise,
      QuizItem,
      QuizStudentAnswer,
    ]),
  ],
  providers: [TeacherLessonsService, BlocksService],
  controllers: [TeacherLessonsController, BlocksController],
})
export class TeacherLessonsModule {}

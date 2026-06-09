import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from 'src/common/core/entitys/teacher-lesson.entity';
import { LessonBlock } from 'src/common/core/entitys/teacher-lesson-block.entity';
import { LessonVocab } from 'src/common/core/entitys/teacher-lesson-vocab.entity';
import { LessonVocabWord } from 'src/common/core/entitys/teacher-lesson-vocab-word.entity';
import { LessonReading } from 'src/common/core/entitys/teacher-lesson-reading.entity';
import { LessonReadingQuestion } from 'src/common/core/entitys/teacher-lesson-reading-question.entity';
import { LessonListening } from 'src/common/core/entitys/teacher-lesson-listening.entity';
import { LessonListeningQuestion } from 'src/common/core/entitys/teacher-lesson-listening-question.entity';
import { LessonSpeaking } from 'src/common/core/entitys/teacher-lesson-speaking.entity';
import { Grammar } from 'src/common/core/entitys/grammar.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { TeacherLessonsService } from './teacher-lessons.service';
import { BlocksService } from './blocks.service';
import { TeacherLessonsController } from './teacher-lessons.controller';
import { BlocksController } from './blocks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      LessonBlock,
      LessonVocab,
      LessonVocabWord,
      LessonReading,
      LessonReadingQuestion,
      LessonListening,
      LessonListeningQuestion,
      LessonSpeaking,
      Grammar,
      Group,
    ]),
  ],
  providers: [TeacherLessonsService, BlocksService],
  controllers: [TeacherLessonsController, BlocksController],
})
export class TeacherLessonsModule {}

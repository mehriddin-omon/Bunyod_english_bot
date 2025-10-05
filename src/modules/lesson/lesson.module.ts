import { forwardRef, Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { Lesson } from '../../common/core/entitys/lesson.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonCreateCommand } from './lesson-create.command';
import { BotModule } from '../bot/bot.module';
import { UserModule } from '../user/user.module';
import { Listening, ListeningModule } from '../listening';
import { LessonViewCommand } from './lesson-view.command';
import { Reading } from '../reading';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { Test } from '../tests';
import { TestsModule } from '../tests/tests.module';
import { Vocabulary } from 'src/common';

@Module({
  imports: [
    forwardRef(() => (BotModule)),
    UserModule,
    ListeningModule,
    VocabularyModule,
    TestsModule,
    TypeOrmModule.forFeature([
      Lesson,
      Listening,
      Reading,
      Vocabulary,
      Test
    ])
  ],
  providers: [
    LessonService,
    LessonViewCommand,
    LessonCreateCommand,
  ],
  exports: [
    LessonService,
    LessonViewCommand,
    LessonCreateCommand
  ]
})
export class LessonModule { }

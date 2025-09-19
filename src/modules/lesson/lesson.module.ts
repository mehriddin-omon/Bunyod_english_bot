import { forwardRef, Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { Lesson } from './entity/lesson.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonCreateCommand } from './lesson-create.command';
import { BotModule } from '../bot/bot.module';
import { UserModule } from '../user/user.module';
import { Listening, ListeningModule } from '../listening';
import { LessonViewCommand } from './lesson-view.command';
import { Reading } from '../reading';
import { WordList } from '../wordlist';
import { WordlistModule } from '../wordlist/wordlist.module';
import { Test } from '../tests';

@Module({
  imports: [
    forwardRef(() => (BotModule)),
    UserModule,
    ListeningModule,
    WordlistModule,
    TypeOrmModule.forFeature([
      Lesson,
      Listening,
      Reading,
      WordList,
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

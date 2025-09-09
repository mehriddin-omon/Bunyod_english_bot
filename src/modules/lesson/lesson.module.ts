import { forwardRef, Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { Lesson } from './entity/lesson.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonCreateCommand } from './lesson-create.command';
import { BotModule } from '../bot/bot.module';
import { UserModule } from '../user/user.module';
import { Listening, ListeningModule } from '../listening';
import { LessonViewCommand } from './lesson-view.command';

@Module({
  imports: [
    BotModule,
    UserModule,
    ListeningModule,
    TypeOrmModule.forFeature([Lesson,Listening])
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

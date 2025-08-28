import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { Lesson } from '../entitys/lesson.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test } from '../entitys/test.entity';
import { LessonResource } from '../entitys/lesson-resource.entity';
import { LessonCreateCommand } from './lesson-create.command';
import { BotModule } from '../bot/bot.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    BotModule,
    UserModule,
    TypeOrmModule.forFeature([
      Lesson,
      LessonResource,
      Test
    ])],
  providers: [LessonService, LessonCreateCommand],
  exports: [
    LessonService,
    TypeOrmModule,
    LessonCreateCommand
  ]
})
export class LessonModule { }

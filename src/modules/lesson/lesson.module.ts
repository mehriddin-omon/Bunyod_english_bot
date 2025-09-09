import { forwardRef, Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { Lesson } from './entity/lesson.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonCreateCommand } from './lesson-create.command';
import { BotModule } from '../bot/bot.module';
import { UserModule } from '../user/user.module';
import { ListeningModule } from '../listening';
import { ListeningHandler } from '../listening/listenining.handler';

@Module({
  imports: [
    BotModule,
    UserModule,
    ListeningModule,
    // forwardRef(() => BotModule),
    TypeOrmModule.forFeature([Lesson])
  ],
  providers: [
    ListeningHandler,
    LessonService, 
    LessonCreateCommand, 
  ],
  exports: [LessonService, LessonCreateCommand]
})
export class LessonModule { }

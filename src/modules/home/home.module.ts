import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([
      LessonProgress,
      Lesson,
      Unit,
      UserGamification,
      DailyTracking,
      Vocabulary,
    ]),
  ],
  providers: [HomeService],
  controllers: [HomeController],
})
export class HomeModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { ExerciseResultsService } from './exercise-results.service';
import { ExerciseResultsController } from './exercise-results.controller';
import { ExerciseResult } from 'src/common/core/entitys/exercise-result.entity';
import { GamificationModule } from '../gamification/gamification.module';
import { LessonScoreModule } from 'src/common/services/lesson-score.module';

@Module({
  // GamificationModule — coin berish uchun (XpService)
  // LessonScoreModule — yangi natijadan keyin dars ballini qayta hisoblash
  imports: [GuardModule, TypeOrmModule.forFeature([ExerciseResult]), GamificationModule, LessonScoreModule],
  providers: [ExerciseResultsService],
  controllers: [ExerciseResultsController],
  exports: [ExerciseResultsService],
})
export class ExerciseResultsModule {}

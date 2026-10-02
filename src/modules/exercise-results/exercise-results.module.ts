import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { ExerciseResultsService } from './exercise-results.service';
import { ExerciseResultsController } from './exercise-results.controller';
import { ExerciseResult } from 'src/common/core/entitys/exercise-result.entity';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  // GamificationModule — coin berish uchun (XpService)
  imports: [GuardModule, TypeOrmModule.forFeature([ExerciseResult]), GamificationModule],
  providers: [ExerciseResultsService],
  controllers: [ExerciseResultsController],
  exports: [ExerciseResultsService],
})
export class ExerciseResultsModule {}

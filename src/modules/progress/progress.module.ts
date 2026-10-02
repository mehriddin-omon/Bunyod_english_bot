import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { UserGamification, XpTransaction } from 'src/common/core/entitys/gamification.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { LessonGatingModule } from 'src/common/services/lesson-gating.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    GuardModule,
    LessonGatingModule,
    // GamificationModule — dars XP si uchun (XpService)
    GamificationModule,
    TypeOrmModule.forFeature([
      LessonProgress,
      Lesson,
      Unit,
      UserGamification,
      XpTransaction,
      DailyTracking,
      UserVocabularyProgress,
    ]),
  ],
  providers: [ProgressService],
  controllers: [ProgressController],
  exports: [ProgressService],
})
export class ProgressModule {}

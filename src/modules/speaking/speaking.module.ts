import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { SpeakingSubmission } from 'src/common/core/entitys/speaking-submission.entity';
import { LessonScoreModule } from 'src/common/services/lesson-score.module';
import { LessonGatingModule } from 'src/common/services/lesson-gating.module';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SpeakingService } from './speaking.service';
import { SpeakingController, SpeakingTeacherController } from './speaking.controller';

/**
 * SPEAKING (2026-11): o'quvchi yozib tayyorlanadi → ovoz bilan aytadi → teacher baholaydi.
 * GamificationModule — coin, LessonScoreModule — dars balli, NotificationsModule — «baholandi» xabari,
 * LessonGatingModule — `LessonAccessGuard`.
 */
@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([SpeakingSubmission]),
    GamificationModule,
    LessonScoreModule,
    LessonGatingModule,
    NotificationsModule,
  ],
  providers: [SpeakingService],
  controllers: [SpeakingController, SpeakingTeacherController],
})
export class SpeakingModule {}

import { Module } from '@nestjs/common';
import { LessonScoreService } from './lesson-score.service';

@Module({
  providers: [LessonScoreService],
  exports: [LessonScoreService],
})
export class LessonScoreModule {}

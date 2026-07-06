import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Assignment, AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { UserGamification, UserSkill } from 'src/common/core/entitys/gamification.entity';
import { ActivityLog, DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([
      User, Group, Lesson, LessonProgress, Assignment, AssignmentSubmission,
      UserGamification, UserSkill, ActivityLog, DailyTracking,
    ]),
  ],
  providers: [MonitoringService],
  controllers: [MonitoringController],
  exports: [MonitoringService],
})
export class MonitoringModule {}

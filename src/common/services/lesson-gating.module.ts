import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { GroupMemberSettings } from 'src/common/core/entitys/group-member-settings.entity';
import { ScheduleSession } from 'src/common/core/entitys/schedule.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { LessonGatingService } from './lesson-gating.service';

@Module({
  imports: [TypeOrmModule.forFeature([Group, GroupMemberSettings, ScheduleSession, Lesson, Unit])],
  providers: [LessonGatingService],
  exports: [LessonGatingService],
})
export class LessonGatingModule {}

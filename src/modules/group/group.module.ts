import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { Schedule } from 'src/common/core/entitys/schedule.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Notification } from 'src/common/core/entitys/notification.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, User, Schedule, LessonProgress, Notification, UserGamification]),
  ],
  providers: [GroupService],
  controllers: [GroupController],
  exports: [GroupService],
})
export class GroupModule {}

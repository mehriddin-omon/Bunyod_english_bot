import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { CurriculumLesson } from 'src/common/core/entitys/lesson.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Group, CurriculumLesson, DailyTracking])],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
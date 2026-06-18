import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { StudentProfile } from 'src/common/core/entitys/student-profile.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Group, Lesson, DailyTracking, StudentProfile])],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}

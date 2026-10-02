import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { TeacherStudentsController } from './teacher-students.controller';
import { TeacherStudentsService } from './teacher-students.service';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { StudentProfile } from 'src/common/core/entitys/student-profile.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { Assignment, AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { Schedule } from 'src/common/core/entitys/schedule.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([
      User,
      Group,
      StudentProfile,
      UserGamification,
      Assignment,
      AssignmentSubmission,
      Schedule,
    ]),
  ],
  controllers: [TeacherStudentsController],
  providers: [TeacherStudentsService],
  exports: [TeacherStudentsService],
})
export class TeacherStudentsModule {}

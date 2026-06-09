import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { Assignment, AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Notification } from 'src/common/core/entitys/notification.entity';

@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([Assignment, AssignmentSubmission, Group, Notification]),
  ],
  providers: [AssignmentsService],
  controllers: [AssignmentsController],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}

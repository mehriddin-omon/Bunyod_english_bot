import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('monitoring')
@UseGuards(GuardService, RolesGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /** GET /monitoring/groups/:groupId?period=week|month|quarter */
  @Get('groups/:groupId')
  @Roles(Role.teacher, Role.admin)
  async getGroupMonitoring(
    @Param('groupId') groupId: string,
    @Query('period') period?: string,
  ) {
    return this.monitoringService.getGroupMonitoring(groupId, period);
  }

  /** GET /monitoring/students/:studentId */
  @Get('students/:studentId')
  @Roles(Role.teacher, Role.admin)
  async getStudentMonitoring(@Param('studentId') studentId: string) {
    return this.monitoringService.getStudentMonitoring(studentId);
  }

  /** GET /monitoring/assignments/:assignmentId/status-breakdown */
  @Get('assignments/:assignmentId/status-breakdown')
  @Roles(Role.teacher, Role.admin)
  async getAssignmentStatusBreakdown(@Param('assignmentId') assignmentId: string) {
    return this.monitoringService.getAssignmentStatusBreakdown(assignmentId);
  }
}

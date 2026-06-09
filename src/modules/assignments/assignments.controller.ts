import { Controller, Get, Post, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto, SubmitAssignmentDto, GradeSubmissionDto } from './dto/assignment.dto';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('assignments')
@UseGuards(GuardService, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /** GET /assignments — Barcha topshiriqlar (rol bo'yicha) */
  @Get()
  @Roles(Role.student, Role.teacher, Role.admin)
  async getAssignments(@Req() req: any) {
    return this.assignmentsService.getAssignments(req.user.sub, req.user.role);
  }

  /** POST /assignments — Yangi topshiriq (Teacher) */
  @Post()
  @Roles(Role.teacher, Role.admin)
  async createAssignment(@Body() dto: CreateAssignmentDto, @Req() req: any) {
    return this.assignmentsService.createAssignment(req.user.sub, dto);
  }

  /** POST /assignments/:id/submit — Topshirish (Student) */
  @Post(':id/submit')
  @Roles(Role.student)
  async submitAssignment(
    @Param('id') id: string,
    @Body() dto: SubmitAssignmentDto,
    @Req() req: any,
  ) {
    return this.assignmentsService.submitAssignment(id, req.user.sub, dto);
  }

  /** GET /assignments/:id/submissions — Ko'rish (Teacher) */
  @Get(':id/submissions')
  @Roles(Role.teacher, Role.admin)
  async getSubmissions(@Param('id') id: string, @Req() req: any) {
    return this.assignmentsService.getSubmissions(id, req.user.sub);
  }

  /** PUT /assignments/:assignmentId/submissions/:submissionId/grade — Baholash (Teacher) */
  @Put(':assignmentId/submissions/:submissionId/grade')
  @Roles(Role.teacher, Role.admin)
  async gradeSubmission(
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeSubmissionDto,
    @Req() req: any,
  ) {
    return this.assignmentsService.gradeSubmission(assignmentId, submissionId, req.user.sub, dto);
  }
}

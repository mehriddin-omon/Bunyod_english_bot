import { Controller, Get, Param, ParseUUIDPipe, Query, Request, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { StudentLessonDetailService } from './student-lesson-detail.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('monitoring')
@UseGuards(GuardService, RolesGuard)
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly lessonDetail: StudentLessonDetailService,
  ) {}

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
  @Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
  async getStudentMonitoring(@Param('studentId') studentId: string, @Request() req: any) {
    // Teacher faqat o'z guruhidagi o'quvchini ko'radi — tekshiruv servisda
    return this.monitoringService.getStudentMonitoring(studentId, req.user);
  }

  /**
   * GET /monitoring/students/:studentId/lessons/:lessonId — bitta mavzuni qanday
   * o'zlashtirgani: bo'lim ballari, grammatika mashqlari (urinishlar, savollar
   * bo'yicha xatolar), reading/listening/test javoblari.
   */
  @Get('students/:studentId/lessons/:lessonId')
  @Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
  async getStudentLessonDetail(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Request() req: any,
  ) {
    return this.lessonDetail.getLessonDetail(studentId, lessonId, req.user);
  }

  /**
   * GET /monitoring/students/:studentId/lessons/:lessonId/vocabulary — shu darsning lug'ati:
   * so'zlar holati, bosqichlar, coinli sinov urinishlari (har so'zga javob).
   */
  @Get('students/:studentId/lessons/:lessonId/vocabulary')
  @Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
  async getStudentLessonVocabulary(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Request() req: any,
  ) {
    return this.lessonDetail.getLessonVocabulary(studentId, lessonId, req.user);
  }

  /**
   * GET /monitoring/students/:studentId/lessons/:lessonId/verbs — 4-darsdagi «Noto'g'ri fe'llar»:
   * to'plam × bosqich natijalari, har fe'l bo'yicha xatolar, guruhda eng ko'p adashilgan fe'llar.
   */
  @Get('students/:studentId/lessons/:lessonId/verbs')
  @Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
  async getStudentLessonVerbs(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Request() req: any,
  ) {
    return this.lessonDetail.getLessonVerbs(studentId, lessonId, req.user);
  }

  /** GET /monitoring/assignments/:assignmentId/status-breakdown */
  @Get('assignments/:assignmentId/status-breakdown')
  @Roles(Role.teacher, Role.admin)
  async getAssignmentStatusBreakdown(@Param('assignmentId') assignmentId: string) {
    return this.monitoringService.getAssignmentStatusBreakdown(assignmentId);
  }
}

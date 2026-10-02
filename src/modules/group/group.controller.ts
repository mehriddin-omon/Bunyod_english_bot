import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { GroupService } from './group.service';
import { GroupPanelsService } from './group-panels.service';
import {
  CreateGroupDto,
  UpdateGroupDto,
  AddStudentsDto,
  SetAutoAdvanceDto,
  SetManualCeilingDto,
  SetStudentFreeDto,
  UnlockNextDto,
} from './dto/group.dto';

@Controller('groups')
@UseGuards(GuardService, RolesGuard)
export class GroupController {
  constructor(
    private readonly groupService: GroupService,
    private readonly panels: GroupPanelsService,
  ) {}

  @Get()
  @Roles(Role.admin, Role.teacher)
  async getAllGroups(@Request() req) {
    return this.groupService.getAllGroups(req.user.sub, req.user.role);
  }

  @Post()
  @Roles(Role.admin, Role.teacher)
  async createGroup(@Body() dto: CreateGroupDto, @Request() req) {
    return this.groupService.createGroup(dto, req.user.sub);
  }

  @Get(':id')
  @Roles(Role.admin, Role.teacher)
  async getGroupById(@Param('id') id: string) {
    return this.groupService.getGroupById(id);
  }

  // ── Guruhni boshqarish sahifasi panellari ─────────────────────────────────
  // Har biri alohida so'rov: bitta sekin panel butun sahifani bloklamaydi.

  /** Sarlavha + KPI kartochkalari (davomat, o'rtacha ball, faollik, ...) */
  @Get(':id/overview')
  @Roles(Role.admin, Role.teacher, Role.subTeacher)
  async getOverview(@Param('id') id: string, @Request() req) {
    return this.panels.getOverview(id, req.user.sub, req.user.role);
  }

  /** O'quvchilar ko'rsatkichlari jadvali (progress, ball, davomat, XP) */
  @Get(':id/students-metrics')
  @Roles(Role.admin, Role.teacher, Role.subTeacher)
  async getStudentMetrics(@Param('id') id: string, @Request() req) {
    return this.panels.getStudents(id, req.user.sub, req.user.role);
  }

  /** Davomat matritsasi: oxirgi N sessiya × o'quvchi */
  @Get(':id/attendance')
  @Roles(Role.admin, Role.teacher, Role.subTeacher)
  async getAttendance(@Param('id') id: string, @Query('sessions') sessions: string, @Request() req) {
    return this.panels.getAttendance(id, req.user.sub, req.user.role, Number(sessions) || 10);
  }

  /** O'tgan va kelgusi dars sessiyalari */
  @Get(':id/sessions')
  @Roles(Role.admin, Role.teacher, Role.subTeacher)
  async getSessions(
    @Param('id') id: string,
    @Query('past') past: string,
    @Query('future') future: string,
    @Request() req,
  ) {
    return this.panels.getSessions(id, req.user.sub, req.user.role, Number(past) || 10, Number(future) || 6);
  }

  /** Guruh topshiriqlari va topshirilgan/tekshirilgan holati */
  @Get(':id/assignments')
  @Roles(Role.admin, Role.teacher, Role.subTeacher)
  async getAssignments(@Param('id') id: string, @Request() req) {
    return this.panels.getAssignments(id, req.user.sub, req.user.role);
  }

  // ──────────────────────────────────────────────────────────────────────────

  @Put(':id')
  @Roles(Role.admin, Role.teacher)
  async updateGroup(@Param('id') id: string, @Body() dto: UpdateGroupDto, @Request() req) {
    return this.groupService.updateGroup(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.admin)
  async deleteGroup(@Param('id') id: string) {
    await this.groupService.deleteGroup(id);
    return { message: "Guruh o'chirildi" };
  }

  @Post(':id/students')
  @Roles(Role.admin, Role.teacher)
  async addStudents(@Param('id') id: string, @Body() dto: AddStudentsDto) {
    return this.groupService.addStudents(id, dto);
  }

  @Delete(':id/students/:studentId')
  @Roles(Role.admin, Role.teacher)
  async removeStudent(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.groupService.removeStudent(id, studentId);
  }

  @Get(':id/schedule')
  @Roles(Role.admin, Role.teacher, Role.subTeacher, Role.student)
  async getGroupSchedule(@Param('id') id: string, @Request() req) {
    return this.groupService.getGroupSchedule(id, req.user.sub, req.user.role);
  }

  @Put(':id/auto-advance')
  @Roles(Role.admin, Role.teacher)
  async setAutoAdvance(@Param('id') id: string, @Body() dto: SetAutoAdvanceDto, @Request() req) {
    return this.groupService.setAutoAdvance(id, dto, req.user.sub, req.user.role);
  }

  @Put(':id/ceiling')
  @Roles(Role.admin, Role.teacher)
  async setManualCeiling(@Param('id') id: string, @Body() dto: SetManualCeilingDto, @Request() req) {
    return this.groupService.setManualCeiling(id, dto, req.user.sub, req.user.role);
  }

  @Get(':id/gating-status')
  @Roles(Role.admin, Role.teacher)
  async getGatingStatus(@Param('id') id: string, @Request() req) {
    return this.groupService.getGatingStatus(id, req.user.sub, req.user.role);
  }

  @Put(':id/students/:studentId/free')
  @Roles(Role.admin, Role.teacher)
  async setStudentFree(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: SetStudentFreeDto,
    @Request() req,
  ) {
    return this.groupService.setStudentFree(id, studentId, dto, req.user.sub, req.user.role);
  }

  @Post(':id/students/unlock-next')
  @Roles(Role.admin, Role.teacher)
  async unlockNextForStudents(@Param('id') id: string, @Body() dto: UnlockNextDto, @Request() req) {
    return this.groupService.unlockNextForStudents(id, dto, req.user.sub, req.user.role);
  }
}

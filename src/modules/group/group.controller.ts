import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { GroupService } from './group.service';
import { CreateGroupDto, UpdateGroupDto, AddStudentsDto } from './dto/group.dto';

@Controller('groups')
@UseGuards(GuardService, RolesGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

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
}

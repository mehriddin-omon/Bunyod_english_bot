import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { GroupService } from './group.service';
import { CreateGroupDto, UpdateGroupDto, AddMembersDto, AddLessonsDto } from './dto/group.dto';

@Controller('api/v1/group')
@UseGuards(GuardService, RolesGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  /**
   * Yangi guruh yaratish (Faqat teacher)
   */
  @Post('create')
  @Roles(Role.teacher, Role.admin)
  async createGroup(@Body() dto: CreateGroupDto, @Request() req) {
    return {
      statusCode: 201,
      message: 'Group created successfully',
      data: await this.groupService.createGroup(dto, req.user.id),
    };
  }

  /**
   * Barcha guruhlarni olish (Teacher yoki Admin)
   */
  @Get('all')
  @Roles(Role.teacher, Role.admin)
  async getAllGroups(@Request() req) {
    const groups = await this.groupService.getAllGroups(req.user.id);
    return {
      statusCode: 200,
      message: 'Groups retrieved',
      data: groups,
    };
  }

  /**
   * Guruh bo'yicha ma'lumotlarni olish
   */
  @Get(':groupId')
  @Roles(Role.teacher, Role.admin, Role.student)
  async getGroupById(@Param('groupId') groupId: string) {
    return {
      statusCode: 200,
      message: 'Group retrieved',
      data: await this.groupService.getGroupById(groupId),
    };
  }

  /**
   * Guruhni yangilash
   */
  @Put(':groupId')
  @Roles(Role.teacher, Role.admin)
  async updateGroup(@Param('groupId') groupId: string, @Body() dto: UpdateGroupDto) {
    return {
      statusCode: 200,
      message: 'Group updated successfully',
      data: await this.groupService.updateGroup(groupId, dto),
    };
  }

  /**
   * A'zolarni qo'shish
   */
  @Post(':groupId/members/add')
  @Roles(Role.teacher, Role.admin)
  async addMembers(@Param('groupId') groupId: string, @Body() dto: AddMembersDto) {
    return {
      statusCode: 200,
      message: 'Members added successfully',
      data: await this.groupService.addMembers(groupId, dto),
    };
  }

  /**
   * Darslarni qo'shish
   */
  @Post(':groupId/lessons/add')
  @Roles(Role.teacher, Role.admin)
  async addLessons(@Param('groupId') groupId: string, @Body() dto: AddLessonsDto) {
    return {
      statusCode: 200,
      message: 'Lessons added successfully',
      data: await this.groupService.addLessons(groupId, dto),
    };
  }

  /**
   * Guruhdagi a'zoni o'chirish
   */
  @Delete(':groupId/members/:memberId')
  @Roles(Role.teacher, Role.admin)
  async removeMember(@Param('groupId') groupId: string, @Param('memberId') memberId: string) {
    return {
      statusCode: 200,
      message: 'Member removed successfully',
      data: await this.groupService.removeMember(groupId, memberId),
    };
  }

  /**
   * Guruhni o'chirish
   */
  @Delete(':groupId')
  @Roles(Role.teacher, Role.admin)
  async deleteGroup(@Param('groupId') groupId: string) {
    await this.groupService.deleteGroup(groupId);
    return {
      statusCode: 200,
      message: 'Group deleted successfully',
      data: null,
    };
  }
}

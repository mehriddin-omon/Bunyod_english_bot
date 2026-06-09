import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('schedule')
@UseGuards(GuardService, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** GET /schedule?week=2026-05-25 */
  @Get()
  @Roles(Role.teacher, Role.admin)
  async getWeeklySchedule(@Req() req: any, @Query('week') week?: string) {
    return this.scheduleService.getWeeklySchedule(req.user.sub, week);
  }

  /** POST /schedule */
  @Post()
  @Roles(Role.teacher, Role.admin)
  async createSchedule(@Body() dto: CreateScheduleDto, @Req() req: any) {
    return this.scheduleService.createSchedule(req.user.sub, dto);
  }

  /** PUT /schedule/:id */
  @Put(':id')
  @Roles(Role.teacher, Role.admin)
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @Req() req: any,
  ) {
    return this.scheduleService.updateSchedule(id, req.user.sub, dto);
  }

  /** DELETE /schedule/:id */
  @Delete(':id')
  @Roles(Role.teacher, Role.admin)
  async deleteSchedule(@Param('id') id: string, @Req() req: any) {
    await this.scheduleService.deleteSchedule(id, req.user.sub);
    return { message: "Jadval o'chirildi" };
  }
}

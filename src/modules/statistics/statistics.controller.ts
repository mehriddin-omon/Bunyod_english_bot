import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { StatisticsService } from './statistics.service';

@Controller('stats')
@UseGuards(GuardService, RolesGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  /** GET /stats/my — Student o'z statistikasi */
  @Get('my')
  @Roles(Role.student)
  async getMyStats(@Req() req: any) {
    return this.statisticsService.getMyStats(req.user.sub);
  }

  @Get('student/:userId/lesson/:lessonId')
  @Roles(Role.teacher, Role.admin)
  async getStudentStatistics(@Param('userId') userId: string, @Param('lessonId') lessonId: string) {
    return this.statisticsService.getStudentStatistics(userId, lessonId);
  }

  @Get('group/:groupId')
  @Roles(Role.teacher, Role.admin)
  async getGroupStatistics(@Param('groupId') groupId: string) {
    return this.statisticsService.getGroupStatistics(groupId);
  }

  @Get('lesson/:lessonId')
  @Roles(Role.teacher, Role.admin)
  async getLessonStatistics(@Param('lessonId') lessonId: string) {
    return this.statisticsService.getLessonStatistics(lessonId);
  }

  @Get('user/:userId/overall')
  @Roles(Role.teacher, Role.admin)
  async getUserOverallStatistics(@Param('userId') userId: string) {
    return this.statisticsService.getUserOverallStatistics(userId);
  }

  @Post('progress/update')
  @Roles(Role.teacher, Role.admin)
  async updateProgress(
    @Body()
    data: {
      userId: string;
      lessonId: string;
      score?: number;
      status?: string;
      timeSpentSec?: number;
    },
  ) {
    return this.statisticsService.updateProgress(data.userId, data.lessonId, {
      score: data.score,
      status: data.status as any,
      timeSpentSec: data.timeSpentSec,
    });
  }
}

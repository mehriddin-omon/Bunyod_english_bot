import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CompleteLessonDto, ReportTimeDto, UpsertProgressDto } from './dto/progress.dto';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('progress')
@UseGuards(GuardService, RolesGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /** POST /progress/lessons/:lessonId/start */
  @Post('lessons/:lessonId/start')
  @Roles(Role.student)
  async startLesson(@Param('lessonId') lessonId: string, @Req() req: any) {
    return this.progressService.startLesson(req.user.sub, lessonId);
  }

  /** POST /progress/lessons/:lessonId/complete */
  @Post('lessons/:lessonId/complete')
  @Roles(Role.student)
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: CompleteLessonDto,
    @Req() req: any,
  ) {
    return this.progressService.completeLesson(req.user.sub, lessonId, dto);
  }

  /** POST /progress/lessons/:lessonId/time — darsda o'tkazilgan vaqtni (soniya) qo'shadi */
  @Post('lessons/:lessonId/time')
  @Roles(Role.student)
  async reportTime(
    @Param('lessonId') lessonId: string,
    @Body() dto: ReportTimeDto,
    @Req() req: any,
  ) {
    return this.progressService.addTimeSpent(req.user.sub, lessonId, dto.seconds);
  }

  /** GET /progress/overview */
  @Get('overview')
  @Roles(Role.student)
  async getOverview(@Req() req: any) {
    return this.progressService.getOverview(req.user.sub);
  }

  /** GET /progress/me — React Native uchun: barcha yakunlangan darslar */
  @Get('me')
  async getMyProgress(@Req() req: any) {
    return this.progressService.getMyProgress(req.user.sub);
  }

  /** POST /progress — React Native uchun: upsert (lessonId + score) */
  @Post()
  async upsertProgress(@Body() dto: UpsertProgressDto, @Req() req: any) {
    return this.progressService.upsertProgress(req.user.sub, dto);
  }
}

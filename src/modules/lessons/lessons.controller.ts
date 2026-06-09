import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('lessons')
@UseGuards(GuardService, RolesGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  /** GET /lessons/units */
  @Get('units')
  async getUnits(@Req() req: any) {
    return this.lessonsService.getUnits(req.user.sub, req.user.role);
  }

  /** GET /lessons/units/:unitId */
  @Get('units/:unitId')
  async getUnit(@Param('unitId') unitId: string, @Req() req: any) {
    return this.lessonsService.getUnit(unitId, req.user.sub, req.user.role);
  }

  /** GET /lessons/units/:unitId/lessons/:lessonId/reading */
  @Get('units/:unitId/lessons/:lessonId/reading')
  async getReading(
    @Param('lessonId') lessonId: string,
    @Req() req: any,
  ) {
    return this.lessonsService.getReadingContent(lessonId);
  }

  /** GET /lessons/units/:unitId/lessons/:lessonId/listening */
  @Get('units/:unitId/lessons/:lessonId/listening')
  async getListening(
    @Param('lessonId') lessonId: string,
    @Req() req: any,
  ) {
    return this.lessonsService.getListeningContent(lessonId);
  }

  /** GET /lessons/:lessonId */
  @Get(':lessonId')
  async getLesson(@Param('lessonId') lessonId: string, @Req() req: any) {
    return this.lessonsService.getLesson(lessonId, req.user.sub);
  }
}

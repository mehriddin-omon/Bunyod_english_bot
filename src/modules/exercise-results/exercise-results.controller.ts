import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ExerciseResultsService } from './exercise-results.service';
import { SubmitExerciseResultsDto } from './dto/exercise-results.dto';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('exercise-results')
@UseGuards(GuardService, RolesGuard)
export class ExerciseResultsController {
  constructor(private readonly exerciseResultsService: ExerciseResultsService) {}

  /** POST /exercise-results/batch — ilovadagi offline navbatni qabul qiladi */
  @Post('batch')
  @Roles(Role.student)
  async submitBatch(@Body() dto: SubmitExerciseResultsDto, @Req() req: any) {
    return this.exerciseResultsService.submitBatch(req.user.sub, dto);
  }

  /** GET /exercise-results/my?lessonId= — o'quvchining o'z natijalari */
  @Get('my')
  @Roles(Role.student)
  async getMy(@Req() req: any, @Query('lessonId') lessonId?: string) {
    return this.exerciseResultsService.getMy(req.user.sub, lessonId || undefined);
  }

  /** GET /exercise-results/lesson/:lessonId/summary — teacher panel yig'masi */
  @Get('lesson/:lessonId/summary')
  @Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
  async getLessonSummary(@Param('lessonId') lessonId: string) {
    return this.exerciseResultsService.getLessonSummary(lessonId);
  }
}

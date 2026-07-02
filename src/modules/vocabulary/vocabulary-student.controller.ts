import { Controller, Post, Get, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { StartSessionDto, SubmitSessionDto, ReviewPairDto } from './dto';

@Controller('vocabulary')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.student, Role.teacher, Role.admin)
export class VocabularyStudentController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  // ─── Word list & stats ─────────────────────────────────────────────────────

  @Get('home')
  getVocabularyHome(
    @Req() req: any,
    @Query('lessonId') lessonId?: string,
  ) {
    return this.vocabularyService.getVocabularyHome(req.user.sub, lessonId);
  }

  @Get()
  getVocabulary(
    @Req() req: any,
    @Query('lessonId') lessonId?: string,
    @Query('status')   status?:   string,
  ) {
    return this.vocabularyService.getStudentVocabulary(req.user.sub, { lessonId, status });
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.vocabularyService.getStudentStats(req.user.sub);
  }

  @Get('lessons-summary')
  getLessonsSummary(@Req() req: any) {
    return this.vocabularyService.getLessonsSummary(req.user.sub);
  }

  // ─── Session ───────────────────────────────────────────────────────────────

  @Post('sessions/start')
  startSession(@Req() req: any, @Body() body: StartSessionDto) {
    return this.vocabularyService.startSession(req.user.sub, body);
  }

  @Post('sessions/submit')
  submitSession(@Req() req: any, @Body() body: SubmitSessionDto) {
    return this.vocabularyService.submitSession(req.user.sub, body.answers ?? [], body.sessionId, body.timeSpentSec);
  }

  @Get('sessions/today')
  getTodaySessions(@Req() req: any, @Query('date') date?: string) {
    return this.vocabularyService.getDailySessionStats(req.user.sub, date);
  }

  // ─── Pair detail & SRS review ─────────────────────────────────────────────

  @Get('pairs/:pairId')
  getPairDetail(@Param('pairId') pairId: string, @Req() req: any) {
    return this.vocabularyService.getPairDetail(pairId, req.user?.sub);
  }

  @Post('pairs/:pairId/review')
  reviewPair(
    @Param('pairId') pairId: string,
    @Body() body: ReviewPairDto,
    @Req() req: any,
  ) {
    return this.vocabularyService.reviewPair(req.user.sub, pairId, body.correct);
  }
}

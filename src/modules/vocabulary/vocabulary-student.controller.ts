import { Controller, Post, Get, Body, Param, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { VocabularyCoinTestService } from './vocabulary-coin-test.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { StartSessionDto, SubmitSessionDto, ReviewPairDto, StartCoinTestDto, CoinTestAnswerDto } from './dto';

@Controller('vocabulary')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.student, Role.teacher, Role.admin)
export class VocabularyStudentController {
  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly coinTestService: VocabularyCoinTestService,
  ) {}

  // ─── Coinli sinov ──────────────────────────────────────────────────────────
  // Diqqat: `coin-test/status` va `coin-test/start` yo'llari `pairs/:pairId`
  // dan oldin turishi shart emas (prefiks boshqa), lekin `:testId` li yo'llar
  // aniq segmentlardan KEYIN e'lon qilinadi.

  /** GET /vocabulary/coin-test/status?lessonId= — karta holati */
  @Get('coin-test/status')
  getCoinTestStatus(@Req() req: any, @Query('lessonId') lessonId?: string) {
    if (!lessonId) throw new BadRequestException('lessonId kerak');
    return this.coinTestService.getStatus(req.user.sub, lessonId);
  }

  /** POST /vocabulary/coin-test/start — yangi urinish */
  @Post('coin-test/start')
  startCoinTest(@Req() req: any, @Body() body: StartCoinTestDto) {
    return this.coinTestService.start(req.user.sub, body.lessonId);
  }

  /** POST /vocabulary/coin-test/:testId/answer — bitta so'zga javob (server vaqtni tekshiradi) */
  @Post('coin-test/:testId/answer')
  answerCoinTest(@Req() req: any, @Param('testId') testId: string, @Body() body: CoinTestAnswerDto) {
    return this.coinTestService.answer(req.user.sub, testId, body.pairId, body.answer ?? null);
  }

  /** POST /vocabulary/coin-test/:testId/abandon — ✕: urinish sarflanadi */
  @Post('coin-test/:testId/abandon')
  abandonCoinTest(@Req() req: any, @Param('testId') testId: string) {
    return this.coinTestService.abandon(req.user.sub, testId);
  }

  // ─── Word list & stats ─────────────────────────────────────────────────────

  @Get('home')
  getVocabularyHome(
    @Req() req: any,
    @Query('lessonId') lessonId?: string,
  ) {
    return this.vocabularyService.getVocabularyHome(req.user.sub, lessonId);
  }

  /**
   * GET /vocabulary?lessonId=&sectionId=&status=new,learning&preset=hard
   * `preset` — hard | overdue | today | new | priority (qoidalar statistika bilan bir xil)
   */
  @Get()
  getVocabulary(
    @Req() req: any,
    @Query('lessonId')  lessonId?:  string,
    @Query('sectionId') sectionId?: string,
    @Query('status')    status?:    string,
    @Query('preset')    preset?:    string,
  ) {
    return this.vocabularyService.getStudentVocabulary(req.user.sub, { lessonId, sectionId, status, preset });
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.vocabularyService.getStudentStats(req.user.sub);
  }

  @Get('lessons-summary')
  getLessonsSummary(@Req() req: any) {
    return this.vocabularyService.getLessonsSummary(req.user.sub);
  }

  // ─── Lug'at bosqichlari ────────────────────────────────────────────────────

  /** GET /vocabulary/stages?lessonId= — 4 bosqich holati (qulf, foiz, o'tildi) */
  @Get('stages')
  getStages(@Req() req: any, @Query('lessonId') lessonId?: string) {
    if (!lessonId) throw new BadRequestException('lessonId kerak');
    return this.vocabularyService.getStages(req.user.sub, lessonId);
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

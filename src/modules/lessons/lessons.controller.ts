import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { StudentAnswersService, SubmittedAnswer } from './student-answers.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('lessons')
@UseGuards(GuardService, RolesGuard)
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly answersService: StudentAnswersService,
  ) {}

  /** Eski payload ({itemId}) va yangisini ({questionId}) birdek qabul qiladi */
  private static normalizeAnswers(
    answers: ({ questionId?: string; itemId?: string; answer: string } | null)[] | undefined,
  ): SubmittedAnswer[] {
    return (answers ?? [])
      .map((a) => ({ questionId: a?.questionId ?? a?.itemId ?? '', answer: a?.answer ?? '' }))
      .filter((a) => a.questionId);
  }

  /** GET /lessons?unit_number=1  — React Native ilova uchun */
  @Get()
  async getPublished(@Query('unit_number') unitNumber: string) {
    const num = Number(unitNumber);
    if (isNaN(num) || num < 1) return [];
    return this.lessonsService.getPublishedByUnit(num);
  }

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

  /** GET /lessons/:lessonId/pages */
  @Get(':lessonId/pages')
  async getLessonPages(@Param('lessonId') lessonId: string) {
    return this.lessonsService.getLessonPages(lessonId);
  }

  /** GET /lessons/:lessonId/content */
  @Get(':lessonId/content')
  async getLessonContent(@Param('lessonId') lessonId: string) {
    return this.lessonsService.getLessonContent(lessonId);
  }

  /** GET /lessons/:lessonId/blocks */
  @Get(':lessonId/blocks')
  async getLessonBlocks(@Param('lessonId') lessonId: string) {
    return this.lessonsService.getLessonBlocks(lessonId);
  }

  /**
   * POST /lessons/:lessonId/blocks/:blockId/submit — UNIVERSAL submit
   * (quiz | reading | listening | grammar — server blok turini o'zi aniqlaydi)
   */
  @Post(':lessonId/blocks/:blockId/submit')
  async submitBlock(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Body() body: { answers?: { questionId?: string; itemId?: string; answer: string }[] },
    @Req() req: any,
  ) {
    return this.answersService.submitBlock(
      lessonId,
      blockId,
      req.user.sub,
      LessonsController.normalizeAnswers(body?.answers),
    );
  }

  /** POST /lessons/:lessonId/quiz/:quizId/submit — quiz javoblarini topshirish (eski, saqlanadi) */
  @Post(':lessonId/quiz/:quizId/submit')
  async submitQuiz(
    @Param('lessonId') lessonId: string,
    @Param('quizId') quizId: string,
    @Body() body: { answers?: { questionId?: string; itemId?: string; answer: string }[] },
    @Req() req: any,
  ) {
    return this.answersService.submitQuiz(
      lessonId,
      quizId,
      req.user.sub,
      LessonsController.normalizeAnswers(body?.answers),
    );
  }

  /** POST /lessons/:lessonId/reading/:blockId/submit — reading javoblari */
  @Post(':lessonId/reading/:blockId/submit')
  async submitReading(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Body() body: { answers?: { questionId?: string; itemId?: string; answer: string }[] },
    @Req() req: any,
  ) {
    return this.answersService.submitReading(
      lessonId,
      blockId,
      req.user.sub,
      LessonsController.normalizeAnswers(body?.answers),
    );
  }

  /** POST /lessons/:lessonId/listening/:blockId/submit — listening javoblari */
  @Post(':lessonId/listening/:blockId/submit')
  async submitListening(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Body() body: { answers?: { questionId?: string; itemId?: string; answer: string }[] },
    @Req() req: any,
  ) {
    return this.answersService.submitListening(
      lessonId,
      blockId,
      req.user.sub,
      LessonsController.normalizeAnswers(body?.answers),
    );
  }

  /** GET /lessons/:lessonId */
  @Get(':lessonId')
  async getLesson(@Param('lessonId') lessonId: string, @Req() req: any) {
    return this.lessonsService.getLesson(lessonId, req.user.sub);
  }
}

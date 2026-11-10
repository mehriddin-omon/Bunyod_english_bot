import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { VocabularyLearnService } from './vocabulary-learn.service';
import { MarkSeenDto, ReviewAnswerDto, SaveLentaDto, SubmitShortsPracticeDto } from './dto';

/**
 * Lug'at — yangi o'qish oqimi (2026-11): dars lug'ati (Tanishuv / Testlash),
 * Testlash lentasi holati, SRS lentasi («Lug'at» tabi), saqlangan so'zlar,
 * «O'sish nuqtalari». Qoidalar `VocabularyLearnService` da.
 */
@Controller('vocabulary')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.student, Role.teacher, Role.admin)
export class VocabularyLearnController {
  constructor(private readonly learn: VocabularyLearnService) {}

  /** GET /vocabulary/lessons/:lessonId/hub — Tanishuv / Testlash / Coinli sinov holati */
  @Get('lessons/:lessonId/hub')
  hub(@Req() req: any, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.learn.getLessonHub(req.user.sub, lessonId);
  }

  /** GET /vocabulary/lessons/:lessonId/words — dars so'zlari tartibda (shorts) */
  @Get('lessons/:lessonId/words')
  words(@Req() req: any, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.learn.getLessonWords(req.user.sub, lessonId);
  }

  /** GET /vocabulary/all-words — qidiruv: yetib kelgan darslar so'zlari */
  @Get('all-words')
  allWords(@Req() req: any) {
    return this.learn.getAllWords(req.user.sub);
  }

  /** GET /vocabulary/lessons-progress — «Darslar lug'ati» ro'yxati */
  @Get('lessons-progress')
  lessonsProgress(@Req() req: any) {
    return this.learn.getLessonsProgress(req.user.sub);
  }

  /** POST /vocabulary/seen — shorts kartalari ko'rildi */
  @Post('seen')
  seen(@Req() req: any, @Body() body: MarkSeenDto) {
    return this.learn.markSeen(req.user.sub, body.pairIds);
  }

  /** GET /vocabulary/lenta?scope= — Testlash lentasi holati va so'zlari */
  @Get('lenta')
  getLenta(@Req() req: any, @Query('scope') scope?: string) {
    if (!scope) throw new BadRequestException('scope kerak');
    return this.learn.getLenta(req.user.sub, scope);
  }

  /** PUT /vocabulary/lenta — holatni saqlash + javoblar */
  @Put('lenta')
  saveLenta(@Req() req: any, @Body() body: SaveLentaDto) {
    return this.learn.saveLenta(req.user.sub, body);
  }

  /** GET /vocabulary/growth?lessonId= — «O'sish nuqtalari» */
  @Get('growth')
  growth(@Req() req: any, @Query('lessonId') lessonId?: string) {
    return this.learn.getGrowth(req.user.sub, lessonId || undefined);
  }

  /** GET /vocabulary/review/summary — bugun nechta takror qoldi */
  @Get('review/summary')
  reviewSummary(@Req() req: any) {
    return this.learn.getReviewSummary(req.user.sub);
  }

  /** GET /vocabulary/review/today — bugungi SRS lentasi */
  @Get('review/today')
  reviewToday(@Req() req: any) {
    return this.learn.getReviewToday(req.user.sub);
  }

  /** POST /vocabulary/review/answer — «Esladim» / «Eslay olmadim» */
  @Post('review/answer')
  reviewAnswer(@Req() req: any, @Body() body: ReviewAnswerDto) {
    return this.learn.answerReview(req.user.sub, body.pairId, body.remembered);
  }

  /** GET /vocabulary/saved — saqlangan so'zlar */
  @Get('saved')
  saved(@Req() req: any) {
    return this.learn.getSaved(req.user.sub);
  }

  @Post('saved/:pairId')
  save(@Req() req: any, @Param('pairId', ParseUUIDPipe) pairId: string) {
    return this.learn.save(req.user.sub, pairId);
  }

  @Delete('saved/:pairId')
  unsave(@Req() req: any, @Param('pairId', ParseUUIDPipe) pairId: string) {
    return this.learn.unsave(req.user.sub, pairId);
  }

  // ─── Shorts + mashq birlashtirilgan oqim ─────────────────────────────

  /** GET /vocabulary/shorts-feed — sortlangan, paginatsiyali so'zlar */
  @Get('shorts-feed')
  shortsFeed(
    @Req() req: any,
    @Query('lessonId') lessonId?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.learn.getShortsFeed(req.user.sub, {
      lessonId: lessonId || undefined,
      offset: offset ? Number(offset) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** POST /vocabulary/shorts-practice — 3 pog'onali mashq natijalari */
  @Post('shorts-practice')
  shortsPractice(@Req() req: any, @Body() body: SubmitShortsPracticeDto) {
    return this.learn.submitShortsPractice(req.user.sub, body);
  }
}

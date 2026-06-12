import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role, QuestionType } from 'src/common/utils/enum';
import { BlocksService } from './blocks.service';

@Controller('teacher/lessons/:lessonId')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.admin)
export class BlocksController {
  constructor(private readonly svc: BlocksService) {}

  // ─── Grammar ─────────────────────────────────────────────────

  @Get('grammar')
  getGrammar(@Param('lessonId') lessonId: string) {
    return this.svc.getGrammarContents(lessonId);
  }

  @Post('grammar')
  @HttpCode(HttpStatus.CREATED)
  addGrammar(@Param('lessonId') lessonId: string, @Body('pageName') pageName: string) {
    return this.svc.addGrammarContent(lessonId, pageName);
  }

  @Put('grammar/:contentId')
  updateGrammar(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string, @Body('pageName') pageName: string) {
    return this.svc.updateGrammarContent(lessonId, contentId, pageName);
  }

  @Delete('grammar/:contentId')
  deleteGrammar(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string) {
    return this.svc.deleteGrammarContent(lessonId, contentId);
  }

  // ─── Reading ─────────────────────────────────────────────────

  @Get('reading')
  getReadingList(@Param('lessonId') lessonId: string) {
    return this.svc.getReadingContents(lessonId);
  }

  @Post('reading')
  @HttpCode(HttpStatus.CREATED)
  addReading(@Param('lessonId') lessonId: string, @Body() dto: { title: string; textContent?: string; orderIndex?: number }) {
    return this.svc.addReadingContent(lessonId, dto);
  }

  @Get('reading/:contentId')
  getReading(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string) {
    return this.svc.getReadingWithQuestions(lessonId, contentId);
  }

  @Put('reading/:contentId')
  saveReading(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string, @Body() dto: any) {
    return this.svc.saveReadingContent(lessonId, contentId, dto);
  }

  @Delete('reading/:contentId')
  deleteReading(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string) {
    return this.svc.deleteReadingContent(lessonId, contentId);
  }

  @Post('reading/:contentId/questions')
  @HttpCode(HttpStatus.CREATED)
  addReadingQuestion(
    @Param('lessonId') lessonId: string,
    @Param('contentId') contentId: string,
    @Body() dto: { questionText: string; questionType: QuestionType; correctExplanation?: string },
  ) {
    return this.svc.addReadingQuestion(lessonId, contentId, dto);
  }

  @Put('reading/:contentId/questions/:qId')
  updateReadingQuestion(
    @Param('lessonId') lessonId: string,
    @Param('contentId') contentId: string,
    @Param('qId') qId: string,
    @Body() dto: any,
  ) {
    return this.svc.updateReadingQuestion(lessonId, contentId, qId, dto);
  }

  @Delete('reading/:contentId/questions/:qId')
  deleteReadingQuestion(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string, @Param('qId') qId: string) {
    return this.svc.deleteReadingQuestion(lessonId, contentId, qId);
  }

  @Post('reading/:contentId/questions/:qId/options')
  @HttpCode(HttpStatus.CREATED)
  addReadingOption(@Param('qId') qId: string, @Body() dto: { optionText: string; isCorrect: boolean }) {
    return this.svc.addReadingOption(qId, dto);
  }

  @Delete('reading/options/:optionId')
  deleteReadingOption(@Param('optionId') optionId: string) {
    return this.svc.deleteReadingOption(optionId);
  }

  // ─── Listening ───────────────────────────────────────────────

  @Get('listening')
  getListeningList(@Param('lessonId') lessonId: string) {
    return this.svc.getListeningContents(lessonId);
  }

  @Post('listening')
  @HttpCode(HttpStatus.CREATED)
  addListening(@Param('lessonId') lessonId: string, @Body() dto: { title: string; fileId: string; durationSeconds?: number; speakerCount?: number; orderIndex?: number }) {
    return this.svc.addListeningContent(lessonId, dto);
  }

  @Get('listening/:contentId')
  getListening(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string) {
    return this.svc.getListeningWithDetails(lessonId, contentId);
  }

  @Put('listening/:contentId')
  saveListening(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string, @Body() dto: any) {
    return this.svc.saveListeningContent(lessonId, contentId, dto);
  }

  @Delete('listening/:contentId')
  deleteListening(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string) {
    return this.svc.deleteListeningContent(lessonId, contentId);
  }

  @Post('listening/:contentId/transcripts')
  @HttpCode(HttpStatus.CREATED)
  addTranscript(
    @Param('lessonId') lessonId: string,
    @Param('contentId') contentId: string,
    @Body() dto: { speakerName?: string; timestampSec?: number; textContent: string },
  ) {
    return this.svc.addTranscript(lessonId, contentId, dto);
  }

  @Delete('listening/transcripts/:transcriptId')
  deleteTranscript(@Param('transcriptId') transcriptId: string) {
    return this.svc.deleteTranscript(transcriptId);
  }

  @Post('listening/:contentId/questions')
  @HttpCode(HttpStatus.CREATED)
  addListeningQuestion(
    @Param('lessonId') lessonId: string,
    @Param('contentId') contentId: string,
    @Body() dto: { questionText: string; questionType: QuestionType; correctExplanation?: string },
  ) {
    return this.svc.addListeningQuestion(lessonId, contentId, dto);
  }

  @Put('listening/:contentId/questions/:qId')
  updateListeningQuestion(
    @Param('lessonId') lessonId: string,
    @Param('contentId') contentId: string,
    @Param('qId') qId: string,
    @Body() dto: any,
  ) {
    return this.svc.updateListeningQuestion(lessonId, contentId, qId, dto);
  }

  @Delete('listening/:contentId/questions/:qId')
  deleteListeningQuestion(@Param('lessonId') lessonId: string, @Param('contentId') contentId: string, @Param('qId') qId: string) {
    return this.svc.deleteListeningQuestion(lessonId, contentId, qId);
  }

  @Post('listening/:contentId/questions/:qId/options')
  @HttpCode(HttpStatus.CREATED)
  addListeningOption(@Param('qId') qId: string, @Body() dto: { optionText: string; isCorrect: boolean }) {
    return this.svc.addListeningOption(qId, dto);
  }

  @Delete('listening/options/:optionId')
  deleteListeningOption(@Param('optionId') optionId: string) {
    return this.svc.deleteListeningOption(optionId);
  }
}

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

  // ─── Block CRUD ───────────────────────────────────────────────

  @Get('blocks')
  getBlocks(@Param('lessonId') lessonId: string) {
    return this.svc.getBlocks(lessonId);
  }

  @Post('blocks')
  @HttpCode(HttpStatus.CREATED)
  addBlock(
    @Param('lessonId') lessonId: string,
    @Body() dto: { type: string; grammarPage?: string; title?: string; textContent?: string; fileId?: string },
  ) {
    return this.svc.addBlock(lessonId, dto);
  }

  @Delete('blocks/:blockId')
  deleteBlock(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string) {
    return this.svc.deleteBlock(lessonId, blockId);
  }

  @Put('blocks/reorder')
  reorderBlocks(@Param('lessonId') lessonId: string, @Body('blockIds') blockIds: string[]) {
    return this.svc.reorderBlocks(lessonId, blockIds);
  }

  // ─── Grammar ──────────────────────────────────────────────────

  @Put('blocks/:blockId/grammar-page')
  updateGrammarPage(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Body('grammarPage') pageName: string,
  ) {
    return this.svc.updateGrammarPage(lessonId, blockId, pageName);
  }

  // ─── Reading ──────────────────────────────────────────────────

  @Get('blocks/:blockId/reading')
  getReading(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string) {
    return this.svc.getReading(lessonId, blockId);
  }

  @Put('blocks/:blockId/reading')
  saveReading(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: any) {
    return this.svc.saveReading(lessonId, blockId, dto);
  }

  @Post('blocks/:blockId/reading/questions')
  @HttpCode(HttpStatus.CREATED)
  addReadingQuestion(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Body() dto: { questionText: string; questionType: QuestionType; correctExplanation?: string },
  ) {
    return this.svc.addReadingQuestion(lessonId, blockId, dto);
  }

  @Put('blocks/:blockId/reading/questions/:qId')
  updateReadingQuestion(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Param('qId') qId: string,
    @Body() dto: any,
  ) {
    return this.svc.updateReadingQuestion(lessonId, blockId, qId, dto);
  }

  @Delete('blocks/:blockId/reading/questions/:qId')
  deleteReadingQuestion(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Param('qId') qId: string,
  ) {
    return this.svc.deleteReadingQuestion(lessonId, blockId, qId);
  }

  @Post('blocks/:blockId/reading/questions/:qId/options')
  @HttpCode(HttpStatus.CREATED)
  addReadingOption(@Param('qId') qId: string, @Body() dto: { optionText: string; isCorrect: boolean }) {
    return this.svc.addReadingOption(qId, dto);
  }

  // ─── Listening ────────────────────────────────────────────────

  @Get('blocks/:blockId/listening')
  getListening(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string) {
    return this.svc.getListening(lessonId, blockId);
  }

  @Put('blocks/:blockId/listening')
  saveListening(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: any) {
    return this.svc.saveListening(lessonId, blockId, dto);
  }

  @Post('blocks/:blockId/listening/questions')
  @HttpCode(HttpStatus.CREATED)
  addListeningQuestion(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Body() dto: any,
  ) {
    return this.svc.addListeningQuestion(lessonId, blockId, dto);
  }

  @Put('blocks/:blockId/listening/questions/:qId')
  updateListeningQuestion(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Param('qId') qId: string,
    @Body() dto: any,
  ) {
    return this.svc.updateListeningQuestion(lessonId, blockId, qId, dto);
  }

  @Delete('blocks/:blockId/listening/questions/:qId')
  deleteListeningQuestion(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Param('qId') qId: string,
  ) {
    return this.svc.deleteListeningQuestion(lessonId, blockId, qId);
  }

  @Post('blocks/:blockId/listening/questions/:qId/options')
  @HttpCode(HttpStatus.CREATED)
  addListeningOption(@Param('qId') qId: string, @Body() dto: { optionText: string; isCorrect: boolean; imageUrl?: string; matchKey?: string }) {
    return this.svc.addListeningOption(qId, dto);
  }
}

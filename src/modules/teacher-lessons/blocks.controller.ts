import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { SaveVocabWordDto } from './dto/save-vocab-word.dto';
import { BulkImportDto } from './dto/bulk-import.dto';
import { SaveReadingDto } from './dto/save-reading.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SaveListeningDto } from './dto/save-listening.dto';
import { SaveSpeakingDto } from './dto/save-speaking.dto';

@Controller('teacher/lessons/:lessonId')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.admin)
export class BlocksController {
  constructor(private readonly svc: BlocksService) {}

  // ─── Blocks ──────────────────────────────────────────────────
  @Post('blocks')
  @HttpCode(HttpStatus.CREATED)
  createBlock(@Param('lessonId') lessonId: string, @Body() dto: CreateBlockDto, @Request() req) {
    return this.svc.createBlock(lessonId, dto, req.user.sub);
  }

  @Delete('blocks/:blockId')
  deleteBlock(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Request() req) {
    return this.svc.deleteBlock(lessonId, blockId, req.user.sub);
  }

  @Put('blocks/reorder')
  reorderBlocks(@Param('lessonId') lessonId: string, @Body('blockIds') blockIds: string[], @Request() req) {
    return this.svc.reorderBlocks(lessonId, blockIds, req.user.sub);
  }

  // ─── Vocabulary ──────────────────────────────────────────────
  @Get('blocks/:blockId/vocabulary')
  getVocab(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string) {
    return this.svc.getVocab(lessonId, blockId);
  }

  @Post('blocks/:blockId/vocabulary/words')
  @HttpCode(HttpStatus.CREATED)
  addWord(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: SaveVocabWordDto) {
    return this.svc.addWord(lessonId, blockId, dto);
  }

  @Put('blocks/:blockId/vocabulary/words/:wordId')
  updateWord(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Param('wordId') wordId: string,
    @Body() dto: Partial<SaveVocabWordDto>,
  ) {
    return this.svc.updateWord(lessonId, blockId, wordId, dto);
  }

  @Delete('blocks/:blockId/vocabulary/words/:wordId')
  deleteWord(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Param('wordId') wordId: string) {
    return this.svc.deleteWord(lessonId, blockId, wordId);
  }

  @Post('blocks/:blockId/vocabulary/import')
  @HttpCode(HttpStatus.CREATED)
  bulkImport(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: BulkImportDto) {
    return this.svc.bulkImportWords(lessonId, blockId, dto);
  }

  @Put('blocks/:blockId/vocabulary/settings')
  updateVocabSettings(
    @Param('lessonId') lessonId: string,
    @Param('blockId') blockId: string,
    @Body('exerciseTypes') exerciseTypes: string[],
  ) {
    return this.svc.updateVocabSettings(lessonId, blockId, exerciseTypes);
  }

  // ─── Reading ─────────────────────────────────────────────────
  @Get('blocks/:blockId/reading')
  getReading(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string) {
    return this.svc.getReading_(lessonId, blockId);
  }

  @Put('blocks/:blockId/reading')
  saveReading(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: SaveReadingDto) {
    return this.svc.saveReading(lessonId, blockId, dto);
  }

  @Post('blocks/:blockId/reading/questions')
  @HttpCode(HttpStatus.CREATED)
  addReadingQ(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: CreateQuestionDto) {
    return this.svc.addReadingQuestion(lessonId, blockId, dto);
  }

  @Put('blocks/:blockId/reading/questions/:qId')
  updateReadingQ(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Param('qId') qId: string, @Body() dto: Partial<CreateQuestionDto>) {
    return this.svc.updateReadingQuestion(lessonId, blockId, qId, dto);
  }

  @Delete('blocks/:blockId/reading/questions/:qId')
  deleteReadingQ(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Param('qId') qId: string) {
    return this.svc.deleteReadingQuestion(lessonId, blockId, qId);
  }

  // ─── Listening ───────────────────────────────────────────────
  @Get('blocks/:blockId/listening')
  getListening(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string) {
    return this.svc.getListening_(lessonId, blockId);
  }

  @Put('blocks/:blockId/listening')
  saveListening(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: SaveListeningDto) {
    return this.svc.saveListening(lessonId, blockId, dto);
  }

  @Post('blocks/:blockId/listening/questions')
  @HttpCode(HttpStatus.CREATED)
  addListeningQ(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: CreateQuestionDto) {
    return this.svc.addListeningQuestion(lessonId, blockId, dto);
  }

  @Put('blocks/:blockId/listening/questions/:qId')
  updateListeningQ(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Param('qId') qId: string, @Body() dto: Partial<CreateQuestionDto>) {
    return this.svc.updateListeningQuestion(lessonId, blockId, qId, dto);
  }

  @Delete('blocks/:blockId/listening/questions/:qId')
  deleteListeningQ(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Param('qId') qId: string) {
    return this.svc.deleteListeningQuestion(lessonId, blockId, qId);
  }

  // ─── Speaking ────────────────────────────────────────────────
  @Get('blocks/:blockId/speaking')
  getSpeaking(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string) {
    return this.svc.getSpeaking_(lessonId, blockId);
  }

  @Put('blocks/:blockId/speaking')
  saveSpeaking(@Param('lessonId') lessonId: string, @Param('blockId') blockId: string, @Body() dto: SaveSpeakingDto) {
    return this.svc.saveSpeaking(lessonId, blockId, dto);
  }
}

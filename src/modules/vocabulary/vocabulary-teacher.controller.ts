import { Controller, Post, Get, Patch, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { CreateWordDto, UpdateWordDto, CreatePairDto, UpsertExamplesDto } from './dto';

@Controller('vocabulary')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.admin)
export class VocabularyTeacherController {
  constructor(
    private readonly vocabularyService: VocabularyService
  ) {}

  // ─── Words ─────────────────────────────────────────────────────────────────

  @Post('words')
  createWord(@Body() body: CreateWordDto) {
    return this.vocabularyService.createWord(body);
  }

  @Patch('words/:wordId')
  updateWord(@Param('wordId') wordId: string, @Body() body: UpdateWordDto) {
    return this.vocabularyService.updateWord(wordId, body);
  }

  // ─── Pairs ─────────────────────────────────────────────────────────────────

  @Post('pairs')
  createPair(@Body() body: CreatePairDto) {
    return this.vocabularyService.createPair(body);
  }

  @Put('pairs/:pairId/examples')
  upsertExamples(@Param('pairId') pairId: string, @Body() body: UpsertExamplesDto) {
    return this.vocabularyService.upsertExamples(pairId, body.examples ?? []);
  }

  @Delete('pairs/:pairId')
  deletePair(@Param('pairId') pairId: string) {
    return this.vocabularyService.deletePair(pairId);
  }

  // ─── Lesson pairs ──────────────────────────────────────────────────────────

  @Get('lesson/:lessonId/pairs')
  getPairsForLesson(@Param('lessonId') lessonId: string) {
    return this.vocabularyService.getPairsForLesson(lessonId);
  }

  // ─── Student analytics ─────────────────────────────────────────────────────

  @Get('teacher/student/:studentId/analytics')
  getStudentAnalytics(
    @Param('studentId') studentId: string,
    @Query('lessonId') lessonId?: string,
  ) {
    return this.vocabularyService.getStudentAnalytics(studentId, lessonId);
  }

  // ─── TTS qayta generatsiya (admin) ─────────────────────────────────────────

  @Post('admin/regenerate-tts')
  @Roles(Role.admin)
  regenerateMissingTts() {
    return this.vocabularyService.regenerateMissingTts();
  }
}

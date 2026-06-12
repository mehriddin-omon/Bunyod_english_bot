import { Controller, Post, Get, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { CreateVocabularyDto } from './dto/create-vocabulary.dto';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('vocabulary')
@UseGuards(GuardService, RolesGuard)
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  /** GET /vocabulary?topic=xxx&cefrLevel=B1&status=new */
  @Get()
  @Roles(Role.student, Role.teacher, Role.admin)
  async getVocabulary(
    @Req() req: any,
    @Query('topic') topic?: string,
    @Query('cefrLevel') cefrLevel?: string,
    @Query('status') status?: string,
  ) {
    return this.vocabularyService.getVocabularyForStudent(req.user.sub, { topic, cefrLevel, status });
  }

  /** POST /vocabulary/:wordId/review — SRS takrorlash */
  @Post(':wordId/review')
  @Roles(Role.student)
  async reviewWord(
    @Param('wordId') wordId: string,
    @Body('quality') quality: number,
    @Req() req: any,
  ) {
    return this.vocabularyService.reviewWord(req.user.sub, wordId, quality);
  }

  @Public()
  @Post('create')
  async create(@Body() dto: CreateVocabularyDto) {
    return this.vocabularyService.create(dto);
  }

  @Public()
  @Post('import-text')
  async import_text(@Body('text') text: string) {
    return this.vocabularyService.importFromText(text);
  }

  @Public()
  @Get('all')
  async getAll() {
    return this.vocabularyService.findAll();
  }

  @Public()
  @Get('findVocabularyPairs')
  async getFindVocabularyPairs() {
    return this.vocabularyService.findVocabularyPairs();
  }

  @Public()
  @Get('generateVocabularyQuiz')
  async getgenerateVocabularyQuiz() {
    return this.vocabularyService.generateVocabularyQuiz();
  }
}

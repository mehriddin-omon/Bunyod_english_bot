import { Controller, Post, Body, Get } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { CreateVocabularyDto } from './dto/create-vocabulary.dto';
import { Public } from 'src/common/decorators/jwt-public.decorator';

@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) { }

  @Public()
  @Post('create')
  async create(@Body() dto: CreateVocabularyDto) {
    return await this.vocabularyService.create(dto);
  }

  @Public()
  @Post('import-text')
  async import_text(@Body('text') text: string) {
    return await this.vocabularyService.importFromText(text)
  }

  @Public()
  @Get('all')
  async getAll() {
    return this.vocabularyService.findAllWithTranslations();
  }

}
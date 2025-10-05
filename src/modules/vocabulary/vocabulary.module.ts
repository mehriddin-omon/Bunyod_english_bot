import { Module } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';

@Module({
  providers: [VocabularyService],
  exports:[VocabularyService],
})
export class VocabularyModule {}
import { Module } from '@nestjs/common';
import { WordlistService } from './wordlist.service';

@Module({
  providers: [WordlistService],
  exports:[WordlistService],
})
export class WordlistModule {}
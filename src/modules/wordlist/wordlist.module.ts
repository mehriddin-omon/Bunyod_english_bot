import { Module } from '@nestjs/common';
import { WordlistService } from './wordlist.service';

@Module({
  controllers: [],
  providers: [WordlistService],
})
export class WordlistModule {}
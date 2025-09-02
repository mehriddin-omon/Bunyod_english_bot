import { Module } from '@nestjs/common';
import { WordlistService } from './wordlist.service';
import { WordlistController } from './wordlist.controller';

@Module({
  controllers: [WordlistController],
  providers: [WordlistService],
})
export class WordlistModule {}

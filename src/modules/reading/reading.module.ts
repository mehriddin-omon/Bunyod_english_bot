import { Module } from '@nestjs/common';
import { ReadingService } from './reading.service';

@Module({
  controllers: [],
  providers: [ReadingService],
})
export class ReadingModule {}

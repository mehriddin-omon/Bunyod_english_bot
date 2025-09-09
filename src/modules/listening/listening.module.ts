import { Module } from '@nestjs/common';
import { ListeningService } from './listening.service';

@Module({
  controllers: [],
  providers: [ListeningService],
  exports: [ListeningService]
})
export class ListeningModule { }

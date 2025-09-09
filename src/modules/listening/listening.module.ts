import { Module } from '@nestjs/common';
import { ListeningService } from './listening.service';
import { ListeningHandler } from './listenining.handler';

@Module({
  controllers: [],
  providers: [ListeningService, ListeningHandler],
  exports:[ListeningHandler, ListeningService]
})
export class ListeningModule {}

import { Module } from '@nestjs/common';
import { TestsService } from './tests.service';

@Module({
  controllers: [],
  providers: [TestsService],
})
export class TestsModule {}

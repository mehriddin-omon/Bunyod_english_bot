import { Module } from '@nestjs/common';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

@Module({
  providers: [AppVersionService],
  controllers: [AppVersionController],
})
export class AppVersionModule {}

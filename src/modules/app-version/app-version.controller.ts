import { Controller, Get, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { AppVersionService } from './app-version.service';

@Controller('app')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  /**
   * GET /app/version?platform=android&build=4
   * Login talab qilinmaydi — Welcome/Login ekranida ham majburiy yangilash ishlashi uchun.
   */
  @Public()
  @Get('version')
  getVersion(@Query('platform') platform?: string, @Query('build') build?: string) {
    return this.appVersionService.getVersion(platform, build);
  }
}

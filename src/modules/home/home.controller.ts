import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { HomeService } from './home.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('home')
@UseGuards(GuardService, RolesGuard)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  /** GET /home/stats */
  @Get('stats')
  async getStats(@Req() req: any) {
    return this.homeService.getStats(req.user.sub);
  }

  /** GET /home/streak */
  @Get('streak')
  async getStreak(@Req() req: any) {
    return this.homeService.getStreak(req.user.sub);
  }

  /** GET /home/current-lesson */
  @Get('current-lesson')
  async getCurrentLesson(@Req() req: any) {
    return this.homeService.getCurrentLesson(req.user.sub);
  }

  /** GET /home/daily-goals */
  @Get('daily-goals')
  async getDailyGoals(@Req() req: any) {
    return this.homeService.getDailyGoals(req.user.sub);
  }
}

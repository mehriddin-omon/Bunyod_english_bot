import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { RatingPeriod, RatingService } from './rating.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('gamification')
@UseGuards(GuardService, RolesGuard)
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly ratingService: RatingService,
  ) {}

  // ─── Reyting (ilova "Reyting" ekrani, 2026-10) ───────────────────────────

  /** GET /gamification/rating/group?period=week|all — o'z guruhim */
  @Get('rating/group')
  @Roles(Role.student, Role.teacher, Role.admin)
  getGroupRating(@Req() req: any, @Query('period') period?: string) {
    return this.ratingService.getGroupRating(req.user.sub, this.period(period));
  }

  /** GET /gamification/rating/overall?period=week|all — top 10 + atrofimdagilar */
  @Get('rating/overall')
  @Roles(Role.student, Role.teacher, Role.admin)
  getOverallRating(@Req() req: any, @Query('period') period?: string) {
    return this.ratingService.getOverallRating(req.user.sub, this.period(period));
  }

  /** GET /gamification/rating/users/:id — ro'yxatda bosilgan o'quvchi kartasi */
  @Get('rating/users/:id')
  @Roles(Role.student, Role.teacher, Role.admin)
  getUserCard(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.ratingService.getUserCard(req.user.sub, id);
  }

  /** GET /gamification/rating/week-result — o'tgan hafta natijasi (yoki null) */
  @Get('rating/week-result')
  @Roles(Role.student)
  getWeekResult(@Req() req: any) {
    return this.ratingService.getWeekResult(req.user.sub);
  }

  /** POST /gamification/rating/week-result/seen {weekStart} — "Hafta yakuni" oynasi ko'rildi */
  @Post('rating/week-result/seen')
  @Roles(Role.student)
  markWeekResultSeen(@Req() req: any, @Body('weekStart') weekStart: string) {
    return this.ratingService.markWeekResultSeen(req.user.sub, weekStart);
  }

  private period(p?: string): RatingPeriod {
    return p === 'all' ? 'all' : 'week';
  }

  /** GET /gamification/leaderboard?groupId=uuid&period=week|all */
  @Get('leaderboard')
  @Roles(Role.student, Role.teacher, Role.admin)
  async getLeaderboard(
    @Req() req: any,
    @Query('groupId') groupId?: string,
    @Query('period') period?: string,
  ) {
    return this.gamificationService.getLeaderboard(req.user.sub, groupId, period);
  }

  /** GET /gamification/my */
  @Get('my')
  @Roles(Role.student)
  async getMyGamification(@Req() req: any) {
    return this.gamificationService.getMyGamification(req.user.sub);
  }
}

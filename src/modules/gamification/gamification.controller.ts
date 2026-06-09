import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';

@Controller('gamification')
@UseGuards(GuardService, RolesGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

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

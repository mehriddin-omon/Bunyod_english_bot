import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { UserAchievement, Achievement } from 'src/common/core/entitys/achievement.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { League } from 'src/common/utils/enum';

const LEAGUE_NAMES = ['Bronza', 'Kumush', 'Oltin', 'Platina', 'Olmos'];

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,

    @InjectRepository(UserAchievement)
    private readonly userAchievementRepo: Repository<UserAchievement>,

    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

  ) {}

  async getLeaderboard(userId: string, groupId?: string, period: string = 'week'): Promise<any> {
    let members: User[] = [];

    if (groupId) {
      const group = await this.groupRepo.findOne({
        where: { id: groupId },
        relations: ['members'],
      });
      members = group?.members ?? [];
    } else {
      const groups = await this.groupRepo.find({
        where: { members: { id: userId } },
        relations: ['members'],
      });
      members = groups[0]?.members ?? [];
    }

    const board: any[] = [];
    for (const member of members) {
      const gamification = await this.gamificationRepo.findOne({ where: { userId: member.id } });
      if (!gamification) continue;

      const firstName = member.firstName ?? '';
      const lastName = member.lastName ?? '';
      board.push({
        user_id: member.id,
        first_name: firstName,
        last_name: lastName,
        initials: `${(firstName[0] ?? ' ')}${(lastName[0] ?? ' ')}`.toUpperCase(),
        level: gamification.level,
        xp_in_level: Math.round(((gamification.xpTotal % 100) / 100) * 100),
        total_xp: gamification.xpTotal,
        weekly_xp: gamification.xpWeekly,
        league: this.leagueIndex(gamification.league),
        league_name: LEAGUE_NAMES[this.leagueIndex(gamification.league)],
        streak: gamification.streakCurrent,
        weekly_rank_change: 0,
        is_current_user: member.id === userId,
      });
    }

    board.sort((a, b) =>
      period === 'week' ? b.weekly_xp - a.weekly_xp : b.total_xp - a.total_xp,
    );

    board.forEach((b, i) => { b.rank = i + 1; });

    const totalXp = board.reduce((s, b) => s + b.weekly_xp, 0);
    const targetXp = 5000;

    return {
      period,
      current_user_id: userId,
      board,
      group_challenge: {
        target_xp: targetXp,
        current_xp: totalXp,
        days_left: 3,
        reward: "Qo'shimcha so'z paketi",
      },
    };
  }

  async getMyGamification(userId: string): Promise<any> {
    let gamification = await this.gamificationRepo.findOne({ where: { userId } });
    if (!gamification) {
      gamification = this.gamificationRepo.create({
        userId, level: 1, xpTotal: 0, xpWeekly: 0, streakCurrent: 0,
        streakMax: 0, league: League.bronze,
      });
      await this.gamificationRepo.save(gamification);
    }

    const userAchievements = await this.userAchievementRepo.find({
      where: { userId },
      relations: ['achievement'],
    });

    const allAchievements = await this.achievementRepo.find();

    const leagueIdx = this.leagueIndex(gamification.league);
    const xpInCurrentLevel = gamification.xpTotal % 100;
    const xpToNextLevel = 100 - xpInCurrentLevel;

    const groups = await this.groupRepo.find({
      where: { members: { id: userId } },
      relations: ['members'],
    });
    let rankInGroup: number | null = null;
    if (groups[0]) {
      const memberGamifications = await Promise.all(
        groups[0].members.map((m) => this.gamificationRepo.findOne({ where: { userId: m.id } })),
      );
      const sorted = memberGamifications
        .filter(Boolean)
        .sort((a, b) => b!.xpTotal - a!.xpTotal);
      rankInGroup = sorted.findIndex((g) => g?.userId === userId) + 1 || null;
    }

    return {
      xp: gamification.xpTotal,
      level: gamification.level,
      xp_in_level: xpInCurrentLevel,
      xp_to_next_level: xpToNextLevel,
      league: leagueIdx,
      league_name: LEAGUE_NAMES[leagueIdx],
      streak: gamification.streakCurrent,
      weekly_xp: gamification.xpWeekly,
      rank_in_group: rankInGroup,
      achievements: allAchievements.map((a) => {
        const earned = userAchievements.find((ua) => ua.achievementId === a.id);
        return {
          id: a.id,
          title: a.title,
          icon: a.icon,
          unlocked: !!earned,
          unlocked_at: earned?.earnedAt ?? null,
        };
      }),
    };
  }

  private leagueIndex(league: League): number {
    const map: Record<League, number> = {
      [League.bronze]: 0,
      [League.silver]: 1,
      [League.gold]: 2,
      [League.platinum]: 3,
      [League.diamond]: 4,
    };
    return map[league] ?? 0;
  }
}

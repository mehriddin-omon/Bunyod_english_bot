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
      let gamification = await this.gamificationRepo.findOne({ where: { userId: member.id } });
      if (!gamification) continue;

      gamification = await this.rolloverWeekSnapshotIfNeeded(gamification);

      const firstName = member.firstName ?? '';
      const lastName = member.lastName ?? '';
      board.push({
        userId: member.id,
        firstName,
        lastName,
        initials: `${(firstName[0] ?? ' ')}${(lastName[0] ?? ' ')}`.toUpperCase(),
        level: gamification.level,
        xpInLevel: Math.round(((gamification.xpTotal % 100) / 100) * 100),
        totalXp: gamification.xpTotal,
        weeklyXp: gamification.xpWeekly,
        league: this.leagueIndex(gamification.league),
        leagueName: LEAGUE_NAMES[this.leagueIndex(gamification.league)],
        streak: gamification.streakCurrent,
        _previousRankWeekly: gamification.previousRankWeekly,
        isCurrentUser: member.id === userId,
      });
    }

    board.sort((a, b) =>
      period === 'week' ? b.weeklyXp - a.weeklyXp : b.totalXp - a.totalXp,
    );

    board.forEach((b, i) => {
      b.rank = i + 1;
      // Musbat qiymat — reytingda yuqoriga ko'tarilgan (o'tgan hafta o'rni - joriy o'rin)
      b.weeklyRankChange =
        b._previousRankWeekly != null ? b._previousRankWeekly - b.rank : 0;
      delete b._previousRankWeekly;
    });

    const totalXp = board.reduce((s, b) => s + b.weeklyXp, 0);
    const targetXp = 5000;

    return {
      period,
      currentUserId: userId,
      board,
      groupChallenge: {
        targetXp,
        currentXp: totalXp,
        daysLeft: this.daysLeftInWeek(),
        reward: "Qo'shimcha so'z paketi",
      },
    };
  }

  /** Hafta almashganda (haftaning boshiga kelganda) joriy xp_weekly/rank_weekly
   *  qiymatlarini "previous" snapshotga ko'chiradi. To'liq tarixiy jadval
   *  o'rniga eng arzon yechim: lazy — o'qishda tekshirib, kerak bo'lsa yangilaymiz. */
  private async rolloverWeekSnapshotIfNeeded(
    gamification: UserGamification,
  ): Promise<UserGamification> {
    const mondayThisWeek = this.startOfWeek(new Date());
    const lastSnapshot = gamification.weekSnapshotAt ? new Date(gamification.weekSnapshotAt) : null;

    if (!lastSnapshot || lastSnapshot < mondayThisWeek) {
      gamification.previousWeekXp = gamification.xpWeekly;
      gamification.previousRankWeekly = gamification.rankWeekly ?? null;
      gamification.weekSnapshotAt = mondayThisWeek;
      await this.gamificationRepo.save(gamification);
    }

    return gamification;
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    const dayOfWeek = (d.getDay() + 6) % 7; // 0=Monday
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - dayOfWeek);
    return d;
  }

  /** Joriy hafta (dushanba-yakshanba) tugashiga necha kun qolganini hisoblaydi. */
  private daysLeftInWeek(): number {
    const now = new Date();
    const monday = this.startOfWeek(now);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return Math.max(0, Math.ceil((nextMonday.getTime() - now.getTime()) / 86400000));
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
      xpInLevel: xpInCurrentLevel,
      xpToNextLevel: xpToNextLevel,
      league: leagueIdx,
      leagueName: LEAGUE_NAMES[leagueIdx],
      streak: gamification.streakCurrent,
      weeklyXp: gamification.xpWeekly,
      rankInGroup: rankInGroup,
      achievements: allAchievements.map((a) => {
        const earned = userAchievements.find((ua) => ua.achievementId === a.id);
        return {
          id: a.id,
          title: a.title,
          icon: a.icon,
          unlocked: !!earned,
          unlockedAt: earned?.earnedAt ?? null,
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

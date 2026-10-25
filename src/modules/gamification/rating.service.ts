import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { League } from 'src/common/utils/enum';

/**
 * REYTING (2026-10) — ilovadagi "Reyting" ekrani uchun.
 *
 * Qoidalar:
 * - Ball = coin (`xp_transactions` / `user_gamification.xp_total`).
 * - "Bu hafta" — Toshkent vaqti bilan dushanba 00:00 dan beri yig'ilgan coin,
 *   to'g'ridan-to'g'ri `xp_transactions` dan (`xp_weekly` haftada nollanmaydi).
 * - Ro'yxatda faqat faol studentlar; mehmonlar boshqalarga ko'rinmaydi
 *   (o'zi so'raganda o'zi hisobga olinadi — `/home/rating` bilan bir xil).
 * - O'rin `RANK()` — teng coinli talabalar bir xil o'rinda (Bosh sahifadagi
 *   reyting kartasi bilan mos).
 * - Liga: guruhning o'tgan haftasi birinchi so'rovda "yopiladi"
 *   (`settleGroupWeek`) — top 3 (coini > 0) bir liga yuqoriga chiqadi.
 *   Tushish YO'Q («Iliq o'sish» qarori, 2026-10).
 */

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Toshkent UTC+5, yozgi vaqt yo'q
const DAY_MS = 24 * 60 * 60 * 1000;

export const LEAGUES: League[] = [League.bronze, League.silver, League.gold, League.platinum, League.diamond];
export const LEAGUE_NAMES = ['Bronza', 'Kumush', 'Oltin', 'Platina', 'Olmos'];

/** Hafta yakunida shuncha talaba keyingi ligaga ko'tariladi */
export const PROMOTE_COUNT = 3;
/** Umumiy reytingdagi "Eng yaxshilar" soni */
const OVERALL_TOP = 10;

export type RatingPeriod = 'week' | 'all';

interface WeekWindow {
  /** joriy hafta boshi (dushanba 00:00 Toshkent) */
  start: Date;
  /** o'tgan hafta boshi */
  prevStart: Date;
  /** 'YYYY-MM-DD' — joriy va o'tgan hafta dushanbasi (Toshkent sanasi) */
  startDate: string;
  prevStartDate: string;
  prevPrevStartDate: string;
  /** kechagi sana — streak uzilganmi tekshirish uchun */
  yesterday: string;
  daysLeft: number;
}

function weekWindow(now = new Date()): WeekWindow {
  // UTC maydonlari = Toshkent vaqti
  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  const dow = (local.getUTCDay() + 6) % 7; // 0 = dushanba
  const todayMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const mondayMs = todayMs - dow * DAY_MS;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const start = new Date(mondayMs - TZ_OFFSET_MS);
  const next = start.getTime() + 7 * DAY_MS;
  return {
    start,
    prevStart: new Date(start.getTime() - 7 * DAY_MS),
    startDate: iso(mondayMs),
    prevStartDate: iso(mondayMs - 7 * DAY_MS),
    prevPrevStartDate: iso(mondayMs - 14 * DAY_MS),
    yesterday: iso(todayMs - DAY_MS),
    daysLeft: Math.max(1, Math.ceil((next - now.getTime()) / DAY_MS)),
  };
}

function leagueIdx(league: string | null | undefined): number {
  const i = LEAGUES.indexOf(league as League);
  return i < 0 ? 0 : i;
}

function leagueInfo(league: string | null | undefined) {
  const index = leagueIdx(league);
  return { index, name: LEAGUE_NAMES[index] };
}

/** Faol student filtri (mehmon faqat o'zi uchun) — `u` = users, `$me` = so'rovchi */
const studentFilter = (me: string) =>
  `u.role = 'student' AND u.is_active = true AND (u.is_guest = false OR u.id = ${me})`;

/** Streak oxirgi faollik kecha yoki bugun bo'lsagina hisoblanadi */
const streakExpr = (yesterday: string) =>
  `CASE WHEN g.last_activity_date >= ${yesterday}::date THEN COALESCE(g.streak_current, 0) ELSE 0 END`;

export interface RatingRow {
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  avatarUrl: string | null;
  rank: number;
  /** tanlangan davr bo'yicha coin (hafta yoki jami) */
  coins: number;
  totalCoins: number;
  weekCoins: number;
  level: number;
  streak: number;
  league: { index: number; name: string };
  /** musbat — yuqoriga ko'tarilgan; null — solishtirish yo'q */
  rankChange: number | null;
  groupName: string | null;
  isMe: boolean;
}

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
  ) {}

  // ─── Guruh reytingi ──────────────────────────────────────────────────────
  async getGroupRating(userId: string, period: RatingPeriod) {
    const w = weekWindow();
    const group = await this.findGroup(userId);
    if (!group) {
      return {
        period, group: null, daysLeft: w.daysLeft, promoteCount: PROMOTE_COUNT,
        total: 0, board: [] as RatingRow[], me: null, coinsToNext: null, myLeague: leagueInfo(null),
      };
    }

    await this.settleGroupWeek(group.id, w);

    const score = period === 'week' ? 's.week_coins' : 's.total_coins';
    const raw: any[] = await this.groupRepo.query(
      `WITH members AS (
         SELECT u.id, u.first_name, u.last_name, u.avatar_url,
                COALESCE(g.xp_total, 0)::int AS total_coins,
                COALESCE(g.level, 1)::int AS level,
                COALESCE(g.league, 'bronze') AS league,
                ${streakExpr('$4')}::int AS streak
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
           LEFT JOIN user_gamification g ON g.user_id = u.id
          WHERE gm.group_id = $1 AND ${studentFilter('$2')}
       ),
       week AS (
         SELECT x.user_id, SUM(x.amount)::int AS coins
           FROM xp_transactions x
          WHERE x.created_at >= $3 AND x.user_id IN (SELECT id FROM members)
          GROUP BY x.user_id
       ),
       scored AS (
         SELECT m.*, GREATEST(COALESCE(w.coins, 0), 0)::int AS week_coins
           FROM members m LEFT JOIN week w ON w.user_id = m.id
       )
       SELECT s.*, ${score} AS score,
              RANK() OVER (ORDER BY ${score} DESC)::int AS rank,
              RANK() OVER (ORDER BY s.total_coins - s.week_coins DESC)::int AS start_rank,
              r.rank AS prev_rank
         FROM scored s
         LEFT JOIN rating_week_results r ON r.user_id = s.id AND r.week_start = $5::date
        ORDER BY ${score} DESC, s.total_coins DESC, s.first_name ASC NULLS LAST`,
      [group.id, userId, w.start, w.yesterday, w.prevStartDate],
    );

    const board = raw.map((r) => this.toRow(r, userId, period, group.name));
    const meRaw = raw.find((r) => r.id === userId);
    const me = board.find((b) => b.isMe) ?? null;

    return {
      period,
      group: { id: group.id, name: group.name },
      daysLeft: w.daysLeft,
      promoteCount: PROMOTE_COUNT,
      total: board.length,
      board,
      me,
      coinsToNext: meRaw ? this.coinsToNext(raw.map((r) => Number(r.score)), Number(meRaw.score)) : null,
      myLeague: leagueInfo(meRaw?.league),
    };
  }

  // ─── Umumiy reyting ──────────────────────────────────────────────────────
  async getOverallRating(userId: string, period: RatingPeriod) {
    const w = weekWindow();
    const score = period === 'week' ? 's.week_coins' : 's.total_coins';
    const raw: any[] = await this.groupRepo.query(
      `WITH base AS (
         SELECT u.id, u.first_name, u.last_name, u.avatar_url,
                COALESCE(g.xp_total, 0)::int AS total_coins,
                COALESCE(g.level, 1)::int AS level,
                COALESCE(g.league, 'bronze') AS league,
                ${streakExpr('$3')}::int AS streak
           FROM users u
           LEFT JOIN user_gamification g ON g.user_id = u.id
          WHERE ${studentFilter('$1')}
       ),
       week AS (
         SELECT x.user_id, SUM(x.amount)::int AS coins
           FROM xp_transactions x
          WHERE x.created_at >= $2
          GROUP BY x.user_id
       ),
       scored AS (
         SELECT b.*, GREATEST(COALESCE(w.coins, 0), 0)::int AS week_coins
           FROM base b LEFT JOIN week w ON w.user_id = b.id
       ),
       ranked AS (
         SELECT s.*, ${score} AS score,
                RANK() OVER (ORDER BY ${score} DESC)::int AS rank,
                RANK() OVER (ORDER BY s.total_coins - s.week_coins DESC)::int AS start_rank,
                ROW_NUMBER() OVER (ORDER BY ${score} DESC, s.total_coins DESC, s.id)::int AS pos,
                COUNT(*) OVER ()::int AS total
           FROM scored s
       ),
       me AS (SELECT pos, score FROM ranked WHERE id = $1)
       SELECT r.*, NULL::int AS prev_rank,
              (SELECT MIN(x.score) FROM ranked x WHERE x.score > (SELECT score FROM me)) AS next_score,
              (SELECT gr.name FROM group_members gm JOIN groups gr ON gr.id = gm.group_id
                WHERE gm.user_id = r.id ORDER BY gr.created_at LIMIT 1) AS group_name
         FROM ranked r
        WHERE r.pos <= $4
           OR r.pos BETWEEN (SELECT pos FROM me) - 1 AND (SELECT pos FROM me) + 1
        ORDER BY r.pos`,
      [userId, w.start, w.yesterday, OVERALL_TOP],
    );

    const total = raw[0] ? Number(raw[0].total) : 0;
    const rows = raw.map((r) => ({ pos: Number(r.pos), row: this.toRow(r, userId, period, r.group_name ?? null) }));
    const meRaw = raw.find((r) => r.id === userId);
    const me = rows.find((r) => r.row.isMe)?.row ?? null;

    return {
      period,
      total,
      daysLeft: w.daysLeft,
      me: me
        ? {
            ...me,
            topPercent: total > 0 ? Math.max(1, Math.ceil((me.rank / total) * 100)) : 100,
            coinsToNext:
              meRaw?.next_score != null ? Number(meRaw.next_score) - Number(meRaw.score) + 1 : null,
          }
        : null,
      top: rows.filter((r) => r.pos <= OVERALL_TOP).map((r) => r.row),
      /** sizning atrofingiz (top ichida bo'lmasa) */
      around: rows.filter((r) => r.pos > OVERALL_TOP).map((r) => r.row),
    };
  }

  // ─── O'quvchi kartasi ────────────────────────────────────────────────────
  async getUserCard(viewerId: string, targetId: string) {
    const w = weekWindow();
    const [u] = await this.groupRepo.query(
      `SELECT u.id, u.first_name, u.last_name, u.avatar_url,
              COALESCE(g.xp_total, 0)::int AS total_coins,
              COALESCE(g.level, 1)::int AS level,
              COALESCE(g.league, 'bronze') AS league,
              ${streakExpr('$4')}::int AS streak,
              (SELECT GREATEST(COALESCE(SUM(x.amount), 0), 0)::int FROM xp_transactions x
                WHERE x.user_id = u.id AND x.created_at >= $2) AS week_coins
         FROM users u
         LEFT JOIN user_gamification g ON g.user_id = u.id
        WHERE u.id = $1 AND ${studentFilter('$3')}`,
      [targetId, w.start, viewerId, w.yesterday],
    );
    if (!u) throw new NotFoundException("O'quvchi topilmadi");

    const group = await this.findGroup(targetId);
    let groupRank: number | null = null;
    if (group) {
      const [row] = await this.groupRepo.query(
        `SELECT COUNT(*)::int AS ahead FROM (
           SELECT gm.user_id, GREATEST(COALESCE(SUM(x.amount), 0), 0) AS c
             FROM group_members gm
             JOIN users u ON u.id = gm.user_id
             LEFT JOIN xp_transactions x ON x.user_id = gm.user_id AND x.created_at >= $2
            WHERE gm.group_id = $1 AND ${studentFilter('$4')}
            GROUP BY gm.user_id
         ) t WHERE t.c > $3`,
        [group.id, w.start, Number(u.week_coins), viewerId],
      );
      groupRank = Number(row?.ahead ?? 0) + 1;
    }

    const [ach] = await this.groupRepo.query(
      `SELECT (SELECT COUNT(*)::int FROM achievements) AS total,
              (SELECT COUNT(*)::int FROM user_achievements WHERE user_id = $1) AS earned`,
      [targetId],
    );
    const recent: { title: string; icon: string | null }[] = await this.groupRepo.query(
      `SELECT a.title, a.icon FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = $1 ORDER BY ua.earned_at DESC LIMIT 3`,
      [targetId],
    );

    let myWeekCoins: number | null = null;
    if (viewerId !== targetId) {
      const [mine] = await this.groupRepo.query(
        `SELECT GREATEST(COALESCE(SUM(amount), 0), 0)::int AS c FROM xp_transactions
          WHERE user_id = $1 AND created_at >= $2`,
        [viewerId, w.start],
      );
      myWeekCoins = Number(mine?.c ?? 0);
    }

    const firstName = u.first_name ?? '';
    const lastName = u.last_name ?? '';
    const totalCoins = Number(u.total_coins);
    return {
      userId: u.id,
      firstName,
      lastName,
      initials: this.initials(firstName, lastName),
      avatarUrl: u.avatar_url ?? null,
      groupName: group?.name ?? null,
      groupRank,
      league: leagueInfo(u.league),
      weekCoins: Number(u.week_coins),
      totalCoins,
      streak: Number(u.streak),
      level: Number(u.level),
      xpInLevel: totalCoins % 100,
      achievements: { earned: Number(ach?.earned ?? 0), total: Number(ach?.total ?? 0), recent },
      isMe: viewerId === targetId,
      myWeekCoins,
    };
  }

  // ─── Hafta yakuni ────────────────────────────────────────────────────────
  /** O'tgan haftaning natijasi. Guruhsiz yoki o'tgan hafta coin yig'magan bo'lsa — null. */
  async getWeekResult(userId: string) {
    const w = weekWindow();
    const group = await this.findGroup(userId);
    if (!group) return null;
    await this.settleGroupWeek(group.id, w);

    const [r] = await this.groupRepo.query(
      `SELECT to_char(week_start, 'YYYY-MM-DD') AS week_start, rank, total, coins,
              league_before, league_after, promoted, seen_at
         FROM rating_week_results WHERE user_id = $1 AND week_start = $2::date`,
      [userId, w.prevStartDate],
    );
    if (!r || Number(r.coins) <= 0) return null;

    const [before] = await this.groupRepo.query(
      `SELECT rank FROM rating_week_results WHERE user_id = $1 AND week_start = $2::date`,
      [userId, w.prevPrevStartDate],
    );
    const [g] = await this.groupRepo.query(
      `SELECT ${streakExpr('$2')}::int AS streak FROM user_gamification g WHERE g.user_id = $1`,
      [userId, w.yesterday],
    );

    return {
      weekStart: r.week_start as string,
      groupName: group.name,
      rank: Number(r.rank),
      total: Number(r.total),
      coins: Number(r.coins),
      rankChange: before ? Number(before.rank) - Number(r.rank) : null,
      leagueBefore: leagueInfo(r.league_before),
      leagueAfter: leagueInfo(r.league_after),
      promoted: !!r.promoted,
      streak: Number(g?.streak ?? 0),
      seen: r.seen_at != null,
    };
  }

  async markWeekResultSeen(userId: string, weekStart: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart ?? '')) return { ok: false };
    await this.groupRepo.query(
      `UPDATE rating_week_results SET seen_at = now()
        WHERE user_id = $1 AND week_start = $2::date AND seen_at IS NULL`,
      [userId, weekStart],
    );
    return { ok: true };
  }

  // ─── Ichki ───────────────────────────────────────────────────────────────

  /**
   * Guruhning O'TGAN haftasini yopadi: o'rinlarni `rating_week_results` ga yozadi
   * va top 3 ni (coini > 0) keyingi ligaga ko'taradi. Idempotent — bir hafta bir
   * marta yopiladi (advisory lock + mavjudlik tekshiruvi + UNIQUE(user_id, week_start)).
   * Guruhdan hech kim bir necha hafta kirmasa, faqat oxirgi o'tgan hafta yopiladi.
   */
  private async settleGroupWeek(groupId: string, w: WeekWindow): Promise<void> {
    const existsSql = `SELECT 1 FROM rating_week_results WHERE group_id = $1 AND week_start = $2::date LIMIT 1`;
    const done = await this.groupRepo.query(existsSql, [groupId, w.prevStartDate]);
    if (done.length) return;

    await this.groupRepo.manager.transaction(async (m: EntityManager) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`rating-week:${groupId}:${w.prevStartDate}`]);
      const again = await m.query(existsSql, [groupId, w.prevStartDate]);
      if (again.length) return;

      const rows: { id: string; league: string; coins: number; rank: number; total: number }[] = await m.query(
        `WITH members AS (
           SELECT u.id, COALESCE(g.league, 'bronze') AS league
             FROM group_members gm
             JOIN users u ON u.id = gm.user_id
             LEFT JOIN user_gamification g ON g.user_id = u.id
            WHERE gm.group_id = $1 AND u.role = 'student' AND u.is_active = true AND u.is_guest = false
         ),
         week AS (
           SELECT x.user_id, SUM(x.amount)::int AS coins
             FROM xp_transactions x
            WHERE x.created_at >= $2 AND x.created_at < $3 AND x.user_id IN (SELECT id FROM members)
            GROUP BY x.user_id
         )
         SELECT m.id, m.league,
                GREATEST(COALESCE(w.coins, 0), 0)::int AS coins,
                RANK() OVER (ORDER BY GREATEST(COALESCE(w.coins, 0), 0) DESC)::int AS rank,
                COUNT(*) OVER ()::int AS total
           FROM members m LEFT JOIN week w ON w.user_id = m.id`,
        [groupId, w.prevStart, w.start],
      );
      if (!rows.length) return;

      const params: any[] = [];
      const values = rows.map((r) => {
        const idx = leagueIdx(r.league);
        const promoted = Number(r.rank) <= PROMOTE_COUNT && Number(r.coins) > 0 && idx < LEAGUES.length - 1;
        params.push(
          r.id, groupId, w.prevStartDate, Number(r.rank), Number(r.total), Number(r.coins),
          LEAGUES[idx], promoted ? LEAGUES[idx + 1] : LEAGUES[idx], promoted,
        );
        const b = params.length - 9;
        return `($${b + 1}, $${b + 2}, $${b + 3}::date, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9})`;
      });

      const inserted: { user_id: string; league_after: string }[] = await m.query(
        `INSERT INTO rating_week_results
           (user_id, group_id, week_start, rank, total, coins, league_before, league_after, promoted)
         VALUES ${values.join(', ')}
         ON CONFLICT (user_id, week_start) DO NOTHING
         RETURNING user_id, league_after, promoted`,
        params,
      );

      // Liga faqat shu yerda yozilgan (ikki guruhda bo'lsa ham bir marta) talabalarga
      for (const row of inserted as any[]) {
        if (!row.promoted) continue;
        await m.query(`UPDATE user_gamification SET league = $2 WHERE user_id = $1`, [row.user_id, row.league_after]);
      }
    });
  }

  private findGroup(userId: string): Promise<Group | null> {
    return this.groupRepo
      .createQueryBuilder('g')
      .innerJoin('g.members', 'm', 'm.id = :userId', { userId })
      .getOne();
  }

  private toRow(r: any, meId: string, period: RatingPeriod, groupName: string | null): RatingRow {
    const firstName = r.first_name ?? '';
    const lastName = r.last_name ?? '';
    const rank = Number(r.rank);
    const score = Number(r.score);
    let rankChange: number | null = null;
    if (period === 'all') {
      rankChange = Number(r.start_rank) - rank; // shu hafta boshidan beri
    } else if (r.prev_rank != null && score > 0) {
      rankChange = Number(r.prev_rank) - rank; // o'tgan hafta yakunidagi o'ringa nisbatan
    }
    return {
      userId: r.id,
      firstName,
      lastName,
      initials: this.initials(firstName, lastName),
      avatarUrl: r.avatar_url ?? null,
      rank,
      coins: score,
      totalCoins: Number(r.total_coins),
      weekCoins: Number(r.week_coins),
      level: Number(r.level ?? 1),
      streak: Number(r.streak ?? 0),
      league: leagueInfo(r.league),
      rankChange,
      groupName,
      isMe: r.id === meId,
    };
  }

  /** Keyingi (yuqoridagi) o'ringa chiqish uchun kerak coin; 1-o'rinda null */
  private coinsToNext(scores: number[], mine: number): number | null {
    const above = scores.filter((s) => s > mine);
    return above.length ? Math.min(...above) - mine + 1 : null;
  }

  private initials(firstName: string, lastName: string): string {
    return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
  }
}

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from 'src/common/utils/enum';
import type { AudienceSpec } from 'src/common/core/entitys/notification-broadcast.entity';

export interface Requester {
  sub: string;
  role: Role | string;
}

const STAFF_ALL_GROUPS: string[] = [Role.admin, Role.superAdmin, Role.subTeacher];

/**
 * «Kimga yuboriladi» — bildirishnoma va onlayn dars taklifi uchun YAGONA joy (2026-11).
 *
 *  - `all`    — markazdagi barcha faol o'quvchilar (+ mehmonlar, `includeGuests` standart true)
 *  - `groups` — tanlangan guruhlar a'zolari (teacher faqat O'Z guruhlarini tanlay oladi)
 *               + `includeGuests` bo'lsa barcha mehmonlar
 *  - `users`  — qo'lda tanlanganlar: o'quvchilar va mehmonlar bitta ro'yxatda
 *
 * Bloklangan (`is_active=false`) userlar hech qachon kirmaydi.
 */
@Injectable()
export class AudienceService {
  constructor(private readonly ds: DataSource) {}

  async resolve(audience: AudienceSpec, requester: Requester): Promise<string[]> {
    const ids = new Set<string>();
    const mode = audience?.mode;

    if (mode === 'all') {
      const includeGuests = audience.includeGuests ?? true;
      const rows: { id: string }[] = await this.ds.query(
        `SELECT id FROM users WHERE role = 'student' AND is_active = true ${includeGuests ? '' : 'AND is_guest = false'}`,
      );
      rows.forEach((r) => ids.add(r.id));
      return [...ids];
    }

    if (mode === 'groups') {
      const groupIds = [...new Set(audience.groupIds ?? [])];
      if (!groupIds.length && !audience.includeGuests) {
        throw new BadRequestException('Kamida bitta guruh tanlang');
      }
      if (groupIds.length) {
        await this.assertGroupsAllowed(groupIds, requester);
        const rows: { id: string }[] = await this.ds.query(
          `SELECT DISTINCT u.id
             FROM group_members gm
             JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ANY($1::uuid[])
              AND u.role = 'student' AND u.is_active = true`,
          [groupIds],
        );
        rows.forEach((r) => ids.add(r.id));
      }
      if (audience.includeGuests) {
        const guests: { id: string }[] = await this.ds.query(
          `SELECT id FROM users WHERE role = 'student' AND is_guest = true AND is_active = true`,
        );
        guests.forEach((r) => ids.add(r.id));
      }
      return [...ids];
    }

    if (mode === 'users') {
      const userIds = [...new Set(audience.userIds ?? [])];
      if (!userIds.length) throw new BadRequestException("Kamida bitta o'quvchi tanlang");
      const rows: { id: string }[] = await this.ds.query(
        `SELECT id FROM users WHERE id = ANY($1::uuid[]) AND role = 'student' AND is_active = true`,
        [userIds],
      );
      rows.forEach((r) => ids.add(r.id));
      return [...ids];
    }

    throw new BadRequestException("Qabul qiluvchilar noto'g'ri tanlangan");
  }

  /** Qabul qiluvchilar soni va ulardan nechtasida push yoqilgan */
  async preview(audience: AudienceSpec, requester: Requester) {
    const userIds = await this.resolve(audience, requester);
    if (!userIds.length) return { recipientCount: 0, pushCount: 0, guestCount: 0 };
    const [row]: { push: string; guests: string }[] = await this.ds.query(
      `SELECT
         (SELECT COUNT(DISTINCT pt.user_id) FROM push_tokens pt
           WHERE pt.user_id = ANY($1::uuid[]) AND pt.is_active = true) AS push,
         (SELECT COUNT(*) FROM users WHERE id = ANY($1::uuid[]) AND is_guest = true) AS guests`,
      [userIds],
    );
    return {
      recipientCount: userIds.length,
      pushCount: Number(row?.push ?? 0),
      guestCount: Number(row?.guests ?? 0),
    };
  }

  /** Tanlov oynasi uchun: guruhlar (soni bilan) va umumiy sonlar */
  async options(requester: Requester) {
    const ownOnly = !STAFF_ALL_GROUPS.includes(requester.role as string);
    const groups: any[] = await this.ds.query(
      `SELECT g.id, g.name, g.color,
              COUNT(u.id) FILTER (WHERE u.role = 'student' AND u.is_active = true) AS student_count
         FROM groups g
         LEFT JOIN group_members gm ON gm.group_id = g.id
         LEFT JOIN users u ON u.id = gm.user_id
        WHERE g.status = 'active' ${ownOnly ? 'AND g.teacher_id = $1' : ''}
        GROUP BY g.id
        ORDER BY g.name ASC`,
      ownOnly ? [requester.sub] : [],
    );
    const [totals]: any[] = await this.ds.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_guest = false) AS students,
         COUNT(*) FILTER (WHERE is_guest = true) AS guests
         FROM users WHERE role = 'student' AND is_active = true`,
    );
    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color ?? null,
        studentCount: Number(g.student_count ?? 0),
      })),
      totals: {
        students: Number(totals?.students ?? 0),
        guests: Number(totals?.guests ?? 0),
      },
    };
  }

  /** O'quvchi qidiruvi — o'quvchilar va mehmonlar BITTA ro'yxatda («mehmon» belgisi bilan) */
  async searchUsers(search: string | undefined, limit = 20) {
    const q = (search ?? '').trim();
    const params: any[] = [];
    let where = `u.role = 'student' AND u.is_active = true`;
    if (q) {
      params.push(`%${q}%`);
      const guestNo = q.replace(/^#/, '');
      params.push(`%${guestNo}%`);
      where += ` AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.username ILIKE $1
                   OR u.phone_number ILIKE $1 OR (u.first_name || ' ' || COALESCE(u.last_name, '')) ILIKE $1
                   OR (u.is_guest = true AND RIGHT(u.id::text, 6) ILIKE $2))`;
    }
    params.push(Math.min(Math.max(limit, 1), 50));
    const rows: any[] = await this.ds.query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.is_guest, u.avatar_url,
              ug.last_activity_date,
              (SELECT g.name FROM group_members gm JOIN groups g ON g.id = gm.group_id
                WHERE gm.user_id = u.id ORDER BY g.created_at ASC LIMIT 1) AS group_name
         FROM users u
         LEFT JOIN user_gamification ug ON ug.user_id = u.id
        WHERE ${where}
        ORDER BY u.is_guest ASC, ug.last_activity_date DESC NULLS LAST, u.created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.formatUser(r));
  }

  /** Tanlangan id'lar bo'yicha (qoralamani tahrirlashda chiplarni tiklash uchun) */
  async usersByIds(ids: string[]) {
    const list = [...new Set(ids)].filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 2000);
    if (!list.length) return [];
    const rows: any[] = await this.ds.query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.is_guest, u.avatar_url,
              ug.last_activity_date,
              (SELECT g.name FROM group_members gm JOIN groups g ON g.id = gm.group_id
                WHERE gm.user_id = u.id ORDER BY g.created_at ASC LIMIT 1) AS group_name
         FROM users u
         LEFT JOIN user_gamification ug ON ug.user_id = u.id
        WHERE u.id = ANY($1::uuid[]) AND u.role = 'student'`,
      [list],
    );
    return rows.map((r) => this.formatUser(r));
  }

  /** «Barcha mehmonlarni qo'shish» — faol mehmonlar (eng faollari birinchi) */
  async allGuests() {
    const rows: any[] = await this.ds.query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.is_guest, u.avatar_url,
              ug.last_activity_date, NULL AS group_name
         FROM users u
         LEFT JOIN user_gamification ug ON ug.user_id = u.id
        WHERE u.role = 'student' AND u.is_guest = true AND u.is_active = true
        ORDER BY ug.last_activity_date DESC NULLS LAST, u.created_at DESC
        LIMIT 2000`,
    );
    return rows.map((r) => this.formatUser(r));
  }

  private formatUser(r: any) {
    return {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      username: r.username,
      isGuest: !!r.is_guest,
      /** Mehmonni ro'yxatda ajratish uchun qisqa raqam: «Mehmon · #a1b2c3» */
      guestCode: r.is_guest ? String(r.id).slice(-6) : null,
      avatarUrl: r.avatar_url ?? null,
      groupName: r.group_name ?? null,
      lastActivityDate: r.last_activity_date ?? null,
    };
  }

  private async assertGroupsAllowed(groupIds: string[], requester: Requester) {
    if (STAFF_ALL_GROUPS.includes(requester.role as string)) return;
    const rows: { id: string }[] = await this.ds.query(
      `SELECT id FROM groups WHERE id = ANY($1::uuid[]) AND teacher_id = $2`,
      [groupIds, requester.sub],
    );
    if (rows.length !== groupIds.length) {
      throw new ForbiddenException('Faqat o\'zingizning guruhlaringizni tanlay olasiz');
    }
  }
}

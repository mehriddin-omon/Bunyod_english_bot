import * as bcrypt from 'bcrypt';
import * as fsSync from 'fs';
import { join, resolve, sep } from 'path';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Role, SubmissionStatus } from 'src/common/utils/enum';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { StudentProfile } from 'src/common/core/entitys/student-profile.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { Schedule } from 'src/common/core/entitys/schedule.entity';
import {
  CreateStudentDto,
  ResetStudentPasswordDto,
  SetStudentAccessDto,
  UpdateStudentDto,
} from './dto/teacher-students.dto';

/** Du=0 … Ya=6 (schedules.days_of_week shu formatda saqlanadi) */
const DAY_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

/** "16:30:00" → "16:30" */
function hhmm(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/** "16:30" + 90 daqiqa → "18:00" */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = hhmm(time).split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** JS getDay() (0=Yakshanba) → loyiha formati (0=Dushanba) */
function todayIndex(now = new Date()): number {
  return (now.getDay() + 6) % 7;
}

function parseDays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d) => typeof d === 'number') : [];
  } catch {
    return [];
  }
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

/** "2 soat oldin", "Kecha", "5 kun oldin" */
function relativeLabel(date: Date | null): string {
  if (!date) return 'Hech qachon';
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Hozir';
  if (min < 60) return `${min} daqiqa oldin`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kecha';
  return `${days} kun oldin`;
}

/** Ro'yxat filtrlari — endi mijozda emas, bazada qo'llanadi (sahifalash uchun) */
export type RosterAccessFilter = 'all' | 'active' | 'blocked';
export type RosterAddedFilter = 'all' | 'today' | '7d' | '30d';
/** Mehmon akkauntlar: barchasi (standart) · faqat mehmonlar · mehmonsiz */
export type RosterGuestFilter = 'all' | 'only' | 'exclude';

export type RosterSortKey = 'name' | 'phone' | 'address' | 'level' | 'added' | 'status';
export type RosterSortOrder = 'asc' | 'desc';

export interface RosterQuery {
  search?: string;
  page?: number;
  limit?: number;
  access?: RosterAccessFilter;
  added?: RosterAddedFilter;
  guests?: RosterGuestFilter;
  sort?: RosterSortKey;
  order?: RosterSortOrder;
}

/**
 * Jadval ustuni → saralash ustunlari (entity PROPERTY nomlari — take/skip bilan
 * ustun nomi xato beradi, CLAUDE.md). CEFR qiymatlari (A1…C2) alifbo bo'yicha
 * ham to'g'ri tartibda. Holat: asc → bloklanganlar birinchi.
 */
const ROSTER_SORT_COLUMNS: Record<RosterSortKey, string[]> = {
  name: ['u.firstName', 'u.lastName'],
  phone: ['u.phoneNumber'],
  address: ['sp.address'],
  level: ['sp.cefrLevel'],
  added: ['u.createdAt'],
  status: ['u.isActive'],
};

/** Bir sahifadagi standart o'quvchilar soni */
const DEFAULT_ROSTER_LIMIT = 25;

/** "Qo'shilgan sana" filtri uchun boshlang'ich vaqt */
function rosterAddedSince(filter: RosterAddedFilter): Date | null {
  if (filter === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (filter === '7d') return daysAgo(7);
  if (filter === '30d') return daysAgo(30);
  return null;
}

/** 2026-03-12 → "12.03.2026" */
function dateLabel(date: Date | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * Bazadagi BARCHA uuid ustunlar (jadval + ustun + null bo'la oladimi).
 * O'quvchini o'chirishda shu ro'yxatdan foydalaniladi — jadvallar kodda qo'lda
 * sanalmaydi, shuning uchun keyin qo'shilgan jadval ham o'zidan-o'zi kiradi.
 *
 * DIQQAT: tashqi kalitlar bo'yicha yurib bo'lmaydi. Bazada TypeORM qoldirgan
 * eski camelCase ustunlar bor (`notifications.userId`) va FK ko'pincha O'SHANDA,
 * ma'lumot esa `user_id` da. FK bo'yicha yurilsa, asl qator o'chmay qolardi.
 */
const UUID_COLUMNS_SQL = `
  SELECT c.table_name AS table, c.column_name AS column, (c.is_nullable = 'YES') AS nullable
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema
   AND t.table_name = c.table_name
   AND t.table_type = 'BASE TABLE'
  WHERE c.table_schema = current_schema()
    AND c.data_type = 'uuid'
`;

/** information_schema dan kelgan nom SQL ga qo'yilishidan oldin tekshiriladi */
const SAFE_NAME = /^[A-Za-z0-9_]+$/;

/**
 * Qator EGASI shu foydalanuvchi bo'lgan ustunlar — bunday qatorlar o'chiriladi.
 * (snake_case — asl ustun, camelCase — TypeORM qoldirgan eski nusxasi)
 */
const OWNER_COLUMNS = new Set([
  'user_id', 'userId',
  'sender_id', 'senderId',
  'receiver_id', 'receiverId',
  'student_id', 'studentId',
  'reporter_id',
  'blocked_user_id', 'blockedUserId',
]);

/**
 * Qator BOSHQANIKI, foydalanuvchi esa unda faqat «ishtirokchi» (kim baholadi,
 * kim o'chirdi, kim yaratdi): qator o'chirilmaydi, ustun NULL ga tushadi.
 * NOT NULL bo'lsa — tegilmaydi (u o'qituvchi kontenti, o'quvchida uchramaydi).
 */
const ACTOR_COLUMNS = new Set([
  'created_by', 'createdBy',
  'deleted_by', 'deletedBy',
  'resolved_by', 'resolvedBy',
  'graded_by', 'gradedBy', 'graderId', 'grader_id',
  'teacher_id', 'teacherId',
]);

/**
 * O'QITUVCHI kontenti: egalik ustuni bor bo'lsa ham qatorlari o'chirilmaydi.
 * O'quvchida bunday yozuv bo'lmaydi — ehtiyot chorasi (tasodifan shu id uchrasa
 * ham o'qituvchining xabarnomasi qo'ldan o'chmaydi).
 */
const TEACHER_OWNED_TABLES = new Set([
  'notification_broadcasts',
  'assignments',
  'schedules',
  'schedule_sessions',
  'online_lessons',
  'groups',
  'phrases',
]);

/** `/uploads/...` → diskdagi fayl (faqat uploads/ ichidagisi o'chiriladi) */
function removeUploadFile(url: string | null | undefined): void {
  if (!url) return;
  try {
    const relative = url.replace(/^https?:\/\/[^/]+/, '');
    const root = resolve(join(process.cwd(), 'uploads'));
    const filePath = resolve(join(process.cwd(), relative));
    // Path traversal himoyasi
    if (!filePath.startsWith(root + sep)) return;
    if (fsSync.existsSync(filePath)) fsSync.unlinkSync(filePath);
  } catch {
    // fayl o'chmasa — akkaunt baribir o'chgan, jarayon to'xtatilmaydi
  }
}

@Injectable()
export class TeacherStudentsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
    @InjectRepository(StudentProfile) private readonly profileRepo: Repository<StudentProfile>,
    @InjectRepository(UserGamification) private readonly gamificationRepo: Repository<UserGamification>,
    @InjectRepository(AssignmentSubmission) private readonly submissionRepo: Repository<AssignmentSubmission>,
    @InjectRepository(Schedule) private readonly scheduleRepo: Repository<Schedule>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  private readonly logger = new Logger(TeacherStudentsService.name);

  private isPrivileged(role: Role): boolean {
    return role === Role.admin || role === Role.superAdmin;
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /teacher/students/groups
  // ────────────────────────────────────────────────────────────────────────
  async getGroups(userId: string, role: Role) {
    const groups = await this.loadTeacherGroups(userId, role);
    if (!groups.length) return [];

    const schedules = await this.scheduleRepo.find({
      where: { groupId: In(groups.map((g) => g.id)) },
    });

    const scheduleByGroup = new Map<string, Schedule[]>();
    for (const s of schedules) {
      if (!scheduleByGroup.has(s.groupId)) scheduleByGroup.set(s.groupId, []);
      scheduleByGroup.get(s.groupId)!.push(s);
    }

    return groups.map((g) => {
      const rows = scheduleByGroup.get(g.id) ?? [];
      const first = rows[0] ?? null;
      const days = first ? parseDays(first.daysOfWeek) : [];
      return {
        id: g.id,
        name: g.name,
        color: g.color,
        studentCount: g.members?.length ?? 0,
        days,
        startTime: first ? hhmm(first.startTime) : null,
        // "Du/Ch 16:30" — dizayndagi sarlavha uchun tayyor matn
        scheduleLabel: first
          ? `${days.map((d) => DAY_SHORT[d] ?? '').filter(Boolean).join('/')} ${hhmm(first.startTime)}`.trim()
          : null,
      };
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /teacher/students/summary
  //
  // Bu bo'lim ma'muriy: nechta o'quvchi bor, nechtasi kira oladi, nechtasi
  // bloklangan, bu hafta nechtasi qo'shilgan. O'rtacha ball / davomat kabi
  // o'quv ko'rsatkichlari Nazorat bo'limida.
  // ────────────────────────────────────────────────────────────────────────
  async getSummary(userId: string, role: Role) {
    const [groups, total, blocked, newThisWeek, guests] = await Promise.all([
      this.loadTeacherGroups(userId, role),
      this.userRepo.count({ where: { role: Role.student } }),
      this.userRepo.count({ where: { role: Role.student, isActive: false } }),
      this.countNewStudents(daysAgo(7)),
      this.userRepo.count({ where: { role: Role.student, isGuest: true } }),
    ]);

    return {
      groupCount: groups.length,
      totalStudents: total,
      // totalStudents ichida — ilovada "Boshlash" bilan akkaunt ochmagan mehmonlar
      guestStudents: guests,
      activeStudents: total - blocked,
      blockedStudents: blocked,
      newStudentsThisWeek: newThisWeek,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /teacher/students/roster?search=
  //
  // Teacher uchun "o'quvchilar" = markazdagi role='student' bo'lgan BARCHA
  // foydalanuvchilar. Guruh yoki yaratuvchi bo'yicha cheklov yo'q.
  //
  // Bu bo'lim SHAXSIY ma'lumot uchun: telefon, manzil, daraja, kim va qachon
  // qo'shgani, tizimga kira olish holati. O'quv faolligi/progres — Nazorat bo'limida.
  // ────────────────────────────────────────────────────────────────────────
  async getRoster(query: RosterQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(query.limit) || DEFAULT_ROSTER_LIMIT));
    const access = query.access ?? 'all';
    const added = query.added ?? 'all';
    const guests = query.guests ?? 'all';
    const search = query.search?.trim();

    const usersQb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.studentProfile', 'sp')
      .addSelect(['sp.id', 'sp.address', 'sp.cefrLevel'])
      .where('u.role = :role', { role: Role.student });

    if (search) {
      usersQb.andWhere(
        // Mehmonning ismi yo'q — uni kodi (id oxirgi 6 belgisi) bilan ham topish mumkin
        `(u.username ILIKE :s OR u.first_name ILIKE :s OR u.last_name ILIKE :s OR u.phone_number ILIKE :s
          OR (u.is_guest = true AND RIGHT(u.id::text, 6) ILIKE :s))`,
        { s: `%${search}%` },
      );
    }

    // Holat filtri (tizimga kira olish) — endi bazada, sahifalash to'g'ri ishlashi uchun
    if (access === 'active') usersQb.andWhere('u.is_active = true');
    if (access === 'blocked') usersQb.andWhere('u.is_active = false');

    // Mehmonlar filtri
    if (guests === 'only') usersQb.andWhere('u.is_guest = true');
    if (guests === 'exclude') usersQb.andWhere('u.is_guest = false');

    // Qo'shilgan sana filtri
    const since = rosterAddedSince(added);
    if (since) usersQb.andWhere('u.created_at >= :since', { since });

    // Saralash: tanlangan ustun, keyin ism va id — sahifalar orasida tartib barqaror
    // bo'lishi uchun. Bo'sh qiymatlar (telefon, manzil, daraja) doim oxirida.
    // DIQQAT: take/skip bilan orderBy'da entity property nomi bo'lishi shart
    // (ustun nomi berilsa TypeORM "databaseName" xatosini beradi) — CLAUDE.md.
    // TypeORM orderBy'ni kalit bo'yicha saqlaydi — bir ustun ikki marta qo'shilmaydi.
    const sortKey: RosterSortKey = query.sort && query.sort in ROSTER_SORT_COLUMNS ? query.sort : 'name';
    const direction = query.order === 'desc' ? 'DESC' : 'ASC';
    const primary = ROSTER_SORT_COLUMNS[sortKey];
    const tiebreak = ['u.firstName', 'u.lastName', 'u.id'].filter((c) => !primary.includes(c));
    primary.forEach((col, i) =>
      i === 0
        ? usersQb.orderBy(col, direction, 'NULLS LAST')
        : usersQb.addOrderBy(col, direction, 'NULLS LAST'),
    );
    tiebreak.forEach((col) => usersQb.addOrderBy(col, 'ASC'));

    const [users, total] = await usersQb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const pageCount = Math.max(1, Math.ceil(total / limit));
    if (!users.length) return { total, page, limit, pageCount, students: [] };

    // "Kim qo'shgan" — created_by oddiy uuid ustuni, relation emas.
    // Har bir qator uchun alohida so'rov o'rniga bitta so'rovda nomlarni olamiz.
    const creatorIds = [...new Set(users.map((u) => u.createdBy).filter((id): id is string => !!id))];
    const creators = creatorIds.length
      ? await this.userRepo.find({ where: { id: In(creatorIds) } })
      : [];
    const creatorMap = new Map(
      creators.map((c) => [
        c.id,
        { id: c.id, name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.username, role: c.role },
      ]),
    );

    const students = users.map((u) => ({
      id: u.id,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      username: u.username,
      avatarUrl: u.avatarUrl,
      isGuest: !!u.isGuest,
      // Mehmonni ro'yxatda ajratish uchun qisqa kod (Audience'dagi bilan bir xil)
      guestCode: u.isGuest ? String(u.id).slice(-6) : null,
      phone: u.phoneNumber,
      email: u.email,
      address: u.studentProfile?.address ?? null,
      cefrLevel: u.studentProfile?.cefrLevel ?? null,
      createdBy: u.createdBy ? creatorMap.get(u.createdBy) ?? null : null,
      createdAt: u.createdAt ? u.createdAt.toISOString() : null,
      createdAtLabel: dateLabel(u.createdAt),
      // Holat = tizimga kira olishi (faollik emas)
      isActive: u.isActive !== false,
    }));

    return { total, page, limit, pageCount, students };
  }

  // ────────────────────────────────────────────────────────────────────────
  // POST /teacher/students — yangi o'quvchi qo'shish
  //
  // O'qituvchi faqat role='student' yarata oladi (rol dto'dan olinmaydi).
  // created_by — yaratgan o'qituvchi, jadvalda "Qo'shgan" ustunida ko'rinadi.
  // ────────────────────────────────────────────────────────────────────────
  async createStudent(dto: CreateStudentDto, creatorId: string) {
    const usernameBusy = await this.userRepo.findOne({ where: { username: dto.username } });
    if (usernameBusy) throw new ConflictException('Bu login allaqachon band');

    if (dto.phone) {
      const phoneBusy = await this.userRepo.findOne({ where: { phoneNumber: dto.phone } });
      if (phoneBusy) throw new ConflictException('Bu telefon raqam allaqachon band');
    }

    const user = await this.userRepo.save(
      this.userRepo.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        username: dto.username,
        password: await bcrypt.hash(dto.password, 10),
        phoneNumber: dto.phone || null,
        role: Role.student,
        createdBy: creatorId,
        isActive: true,
      }),
    );

    // Manzil va daraja alohida jadvalda — berilgan bo'lsa profil ochamiz
    if (dto.address || dto.cefrLevel) {
      await this.profileRepo.save(
        this.profileRepo.create({
          userId: user.id,
          address: dto.address || null,
          cefrLevel: dto.cefrLevel ?? null,
        }),
      );
    }

    // Gamifikatsiya yozuvi — reyting/streak keyinroq null bo'lib qolmasligi uchun
    await this.gamificationRepo.save(this.gamificationRepo.create({ userId: user.id }));

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      message: "O'quvchi qo'shildi",
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /teacher/students/:id — shaxsiy ma'lumotlarni tahrirlash
  // ────────────────────────────────────────────────────────────────────────
  async updateStudent(id: string, dto: UpdateStudentDto) {
    const user = await this.findStudent(id);

    if (dto.phone && dto.phone !== user.phoneNumber) {
      const busy = await this.userRepo.findOne({ where: { phoneNumber: dto.phone } });
      if (busy) throw new ConflictException('Bu telefon raqam allaqachon band');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phoneNumber = dto.phone || null;
    await this.userRepo.save(user);

    // Manzil va daraja student_profiles jadvalida — profil bo'lmasa yaratamiz
    if (dto.address !== undefined || dto.cefrLevel !== undefined) {
      let profile = await this.profileRepo.findOne({ where: { userId: id } });
      if (!profile) profile = this.profileRepo.create({ userId: id });
      if (dto.address !== undefined) profile.address = dto.address || null;
      if (dto.cefrLevel !== undefined) profile.cefrLevel = dto.cefrLevel ?? null;
      await this.profileRepo.save(profile);
    }

    return { message: "O'quvchi ma'lumotlari yangilandi" };
  }

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /teacher/students/:id/access — kirishni bloklash / ochish
  // ────────────────────────────────────────────────────────────────────────
  async setAccess(id: string, dto: SetStudentAccessDto) {
    const user = await this.findStudent(id);
    user.isActive = dto.isActive;

    // Bloklanganda refresh token bekor qilinadi — ochiq sessiya uzaymaydi
    if (!dto.isActive) user.refreshToken = null;

    await this.userRepo.save(user);
    return {
      isActive: user.isActive,
      message: dto.isActive ? 'Kirish ochildi' : 'Kirish bloklandi',
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /teacher/students/:id/password — parolni tiklash
  // ────────────────────────────────────────────────────────────────────────
  async resetPassword(id: string, dto: ResetStudentPasswordDto) {
    const user = await this.findStudent(id);
    // Mehmon parol bilan kira olmaydi — avval akkauntni saqlashi kerak
    if (user.isGuest) throw new BadRequestException("Mehmon akkauntga parol qo'yib bo'lmaydi");
    user.password = await bcrypt.hash(dto.password, 10);
    // Eski sessiyalar yangi parol bilan almashtirilishi uchun bekor qilinadi
    user.refreshToken = null;
    await this.userRepo.save(user);
    return { message: "Parol yangilandi" };
  }

  // ────────────────────────────────────────────────────────────────────────
  // DELETE /teacher/students/:id — o'quvchini butunlay o'chirish
  // ────────────────────────────────────────────────────────────────────────
  /**
   * O'quvchini va UNGA TEGISHLI BARCHA ma'lumotni o'chiradi: dars progressi va
   * ballari, coin/XP tarixi, lug'at holati, speaking ishlari (ovoz fayllari bilan),
   * chat xabarlari, davomat, bildirishnomalar, izohlar, profil, guruh a'zoligi.
   * Bu amal QAYTARILMAYDI.
   *
   * Qaysi jadval o'chishini qo'lda sanab o'tirmaymiz: `users.id` ga ishora
   * qiluvchi HAR bir tashqi kalit bazadan topiladi va shu o'quvchining qatorlari
   * o'chiriladi. Shu bois keyin qo'shilgan yangi jadval ham o'zidan-o'zi kiradi,
   * eski bazada FK `ON DELETE CASCADE` siz yaratilgan bo'lsa ham ishlaydi.
   * Hammasi bitta tranzaksiyada — yarim o'chgan akkaunt qolmaydi.
   */
  async deleteStudent(id: string, requesterId: string) {
    if (id === requesterId) throw new BadRequestException("O'zingizni o'chira olmaysiz");
    const user = await this.findStudent(id);

    // Fayllar diskda — bazadan o'chirishdan oldin yo'llarini yig'ib olamiz
    const files = await this.collectStudentFiles(user);

    const removedRows = await this.ds.transaction((m) => this.purgeUser(m, id));

    // Baza tozalandi — endi fayllar (o'chmasa jarayon to'xtamaydi)
    files.forEach(removeUploadFile);

    this.logger.log(
      `O'quvchi o'chirildi: ${user.username} (${id}) — ${removedRows} qator, ${files.length} fayl`,
    );

    return {
      message: "O'quvchi va unga tegishli barcha ma'lumotlar o'chirildi",
      removedRows,
      removedFiles: files.length,
    };
  }

  /** Foydalanuvchiga tegishli hamma qatorni o'chiradi (tranzaksiya ichida) */
  private async purgeUser(m: EntityManager, id: string): Promise<number> {
    const columns: { table: string; column: string; nullable: boolean }[] =
      await m.query(UUID_COLUMNS_SQL);

    const usable = columns.filter((c) => SAFE_NAME.test(c.table) && SAFE_NAME.test(c.column));

    // Egalik ustunlari — qator o'chadi ('users' ning o'zi oxirida)
    let pending = usable.filter(
      (c) =>
        c.table !== 'users' &&
        OWNER_COLUMNS.has(c.column) &&
        !TEACHER_OWNED_TABLES.has(c.table),
    );

    let removed = 0;
    let lastError: unknown = null;

    // Bir jadval ikkinchisiga bog'liq bo'lishi mumkin (izoh → izohning like'i),
    // shuning uchun o'chmay qolganlari bilan yana aylanamiz.
    for (let pass = 0; pass < 3 && pending.length > 0; pass++) {
      const failed: typeof pending = [];

      for (const ref of pending) {
        // Xato butun tranzaksiyani yiqitmasligi uchun har o'chirish SAVEPOINT ichida
        await m.query('SAVEPOINT purge_step');
        try {
          const rows = await m.query(
            `DELETE FROM "${ref.table}" WHERE "${ref.column}" = $1 RETURNING 1`,
            [id],
          );
          removed += Array.isArray(rows) ? rows.length : 0;
          await m.query('RELEASE SAVEPOINT purge_step');
        } catch (err) {
          await m.query('ROLLBACK TO SAVEPOINT purge_step');
          lastError = err;
          failed.push(ref);
        }
      }

      // Bu o'tishda hech narsa o'chmadi — keyingi urinish ham foyda bermaydi
      if (failed.length === pending.length) break;
      pending = failed;
    }

    if (pending.length > 0) throw lastError;

    // «Ishtirokchi» ustunlar: qator boshqaniki — faqat ishora bo'shatiladi
    // (masalan `users.created_by`, `chat_messages.deleted_by`).
    for (const ref of usable) {
      if (!ref.nullable || !ACTOR_COLUMNS.has(ref.column)) continue;
      await m.query('SAVEPOINT purge_null');
      try {
        await m.query(
          `UPDATE "${ref.table}" SET "${ref.column}" = NULL WHERE "${ref.column}" = $1`,
          [id],
        );
        await m.query('RELEASE SAVEPOINT purge_null');
      } catch {
        // Bo'shatib bo'lmasa (masalan generated ustun) — akkaunt o'chishiga to'sqinlik qilmaydi
        await m.query('ROLLBACK TO SAVEPOINT purge_null');
      }
    }

    const deleted = await m.query('DELETE FROM users WHERE id = $1 RETURNING 1', [id]);
    removed += Array.isArray(deleted) ? deleted.length : 0;

    return removed;
  }

  /** O'quvchiga tegishli yuklangan fayllar: avatar va speaking ovoz yozuvlari */
  private async collectStudentFiles(user: User): Promise<string[]> {
    const files: string[] = [];
    if (user.avatarUrl) files.push(user.avatarUrl);

    try {
      const rows: { items: unknown; comment_audio_url: string | null }[] = await this.ds.query(
        'SELECT items, comment_audio_url FROM speaking_submissions WHERE user_id = $1',
        [user.id],
      );
      for (const row of rows) {
        if (row.comment_audio_url) files.push(row.comment_audio_url);
        const items = Array.isArray(row.items) ? row.items : [];
        for (const item of items) {
          const url = (item as { audioUrl?: string | null })?.audioUrl;
          if (url) files.push(url);
        }
      }
    } catch {
      // Jadval yo'q (eski baza) — fayl yig'ilmaydi, o'chirish davom etadi
    }

    return files;
  }

  /** Faqat role='student' foydalanuvchini topadi — teacher boshqasini tahrirlay olmaydi */
  private async findStudent(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("O'quvchi topilmadi");
    if (user.role !== Role.student) {
      throw new BadRequestException("Bu foydalanuvchi o'quvchi emas");
    }
    return user;
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /teacher/students/pending-reviews?limit=
  // ────────────────────────────────────────────────────────────────────────
  async getPendingReviews(userId: string, role: Role, limit = 6) {
    const qb = this.pendingReviewsQb(userId, role)
      .leftJoin('s.assignment', 'a')
      .leftJoin('s.student', 'st')
      .addSelect(['a.id', 'a.title', 'a.type', 'st.id', 'st.firstName', 'st.lastName', 'st.avatarUrl'])
      // DIQQAT: orderBy'da ustun nomi emas, entity property nomi bo'lishi shart.
      // take/skip bilan birga TypeORM tartibni metadata orqali qidiradi va
      // 'submitted_at' kabi ustun nomida "Cannot read ... 'databaseName'" beradi.
      .orderBy('s.submittedAt', 'DESC')
      .take(Math.min(50, Math.max(1, limit)));

    const [rows, total] = await qb.getManyAndCount();

    return {
      total,
      items: rows.map((s) => ({
        submissionId: s.id,
        assignmentId: s.assignmentId,
        title: s.assignment?.title ?? 'Topshiriq',
        type: s.assignment?.type ?? null,
        studentId: s.studentId,
        studentName: `${s.student?.firstName ?? ''} ${s.student?.lastName ?? ''}`.trim(),
        studentAvatarUrl: s.student?.avatarUrl ?? null,
        submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
        submittedLabel: relativeLabel(s.submittedAt ?? null),
      })),
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /teacher/students/today-schedule
  // ────────────────────────────────────────────────────────────────────────
  async getTodaySchedule(userId: string, role: Role) {
    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoin('s.group', 'g')
      .addSelect(['g.id', 'g.name', 'g.color']);

    if (!this.isPrivileged(role)) {
      qb.where('s.teacher_id = :userId', { userId });
    }

    const rows = await qb.getMany();
    const today = todayIndex();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const items = rows
      .filter((s) => parseDays(s.daysOfWeek).includes(today))
      .map((s) => {
        const start = hhmm(s.startTime);
        const [h, m] = start.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const duration = s.durationMinutes ?? 90;
        return {
          id: s.id,
          groupId: s.groupId,
          groupName: s.group?.name ?? null,
          groupColor: s.group?.color ?? null,
          topic: s.topic ?? null,
          startTime: start,
          endTime: addMinutes(start, duration),
          duration,
          isNow: nowMinutes >= startMinutes && nowMinutes < startMinutes + duration,
          isPast: nowMinutes >= startMinutes + duration,
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return items;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Ichki yordamchilar
  // ────────────────────────────────────────────────────────────────────────

  private async loadTeacherGroups(userId: string, role: Role): Promise<Group[]> {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .orderBy('g.createdAt', 'ASC');

    if (!this.isPrivileged(role)) {
      qb.where('g.teacher_id = :userId', { userId });
    }

    return qb.getMany();
  }

  private async countNewStudents(since: Date): Promise<number> {
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: Role.student })
      .andWhere('u.created_at >= :since', { since })
      .getCount();
  }

  private pendingReviewsQb(userId: string, role: Role) {
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SubmissionStatus.submitted })
      .andWhere('s.graded_at IS NULL');

    if (!this.isPrivileged(role)) {
      // Faqat shu o'qituvchi bergan topshiriqlarning javoblari
      qb.andWhere(
        's.assignment_id IN (SELECT a2.id FROM assignments a2 WHERE a2.teacher_id = :userId)',
        { userId },
      );
    }

    return qb;
  }

}

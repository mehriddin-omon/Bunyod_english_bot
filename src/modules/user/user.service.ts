import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/utils/enum';
import { User } from 'src/common/core/entitys/user.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';

const ROLE_LEVEL: Record<Role, number> = {
  [Role.superAdmin]: 4,
  [Role.admin]: 3,
  [Role.teacher]: 2,
  [Role.subTeacher]: 1,
  [Role.student]: 0,
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,
  ) {}

  async findAll(query: any, requesterId: string, requesterRole: Role) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const skip = (page - 1) * limit;

    const qb = this.userRepo.createQueryBuilder('user');

    if (requesterRole === Role.teacher) {
      qb.where('user.created_by = :requesterId', { requesterId })
        .andWhere('user.role IN (:...teacherAllowed)', { teacherAllowed: [Role.student, Role.subTeacher] });
    } else {
      qb.where('user.role != :superAdmin', { superAdmin: Role.superAdmin });
      if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.groupId) {
      qb.andWhere(
        'user.id IN (SELECT user_id FROM group_members WHERE group_id = :groupId)',
        { groupId: query.groupId },
      );
    }

    if (query.cefrLevel) qb.andWhere('user.cefr_level = :cefrLevel', { cefrLevel: query.cefrLevel });

    if (query.search) {
      qb.andWhere(
        '(user.username ILIKE :search OR user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await qb.orderBy('"user"."created_at"', 'DESC').skip(skip).take(limit).getManyAndCount();

    return {
      data: users.map((u) => this.formatUser(u)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, requesterId: string, requesterRole: Role) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (requesterRole === Role.teacher) {
      const membership = await this.groupRepo
        .createQueryBuilder('g')
        .innerJoin('g.members', 'm', 'm.id = :userId', { userId: id })
        .where('g.teacherId = :teacherId', { teacherId: requesterId })
        .getOne();
      if (!membership) throw new ForbiddenException("Bu foydalanuvchini ko'rish huquqi yo'q");
    }

    const [group, gamification] = await Promise.all([
      this.groupRepo
        .createQueryBuilder('g')
        .innerJoin('g.members', 'm', 'm.id = :userId', { userId: id })
        .getOne(),
      this.gamificationRepo.findOne({ where: { userId: id } }),
    ]);

    return {
      ...this.formatUser(user),
      group: group
        ? { id: group.id, name: group.name, color: group.color, cefrLevel: group.cefrLevel, status: group.status }
        : null,
      gamification: gamification
        ? { xp: gamification.xpTotal, level: gamification.level, league: gamification.league, streak: gamification.streakCurrent }
        : null,
    };
  }

  async createUser(dto: any, requesterId: string, requesterRole: Role) {
    const targetRole = dto.role ?? Role.student;

    if (ROLE_LEVEL[targetRole] >= ROLE_LEVEL[requesterRole]) {
      throw new ForbiddenException("O'zingizdan yuqori yoki teng role yarata olmaysiz");
    }

    const existingUsername = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingUsername) throw new ConflictException('Bu username allaqachon band');

    if (dto.phone) {
      const existingPhone = await this.userRepo.findOne({ where: { phone: dto.phone } });
      if (existingPhone) throw new ConflictException('Bu telefon raqam allaqachon band');
    }

    const user = await this.userRepo.save(
      this.userRepo.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        password: await bcrypt.hash(dto.password, 10),
        phone: dto.phone,
        role: targetRole,
        created_by: requesterId,
      }),
    );

    return this.formatUser(user);
  }

  async updateUser(id: string, dto: any, requesterId: string, requesterRole: Role) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    this.checkAccess(user, requesterId, requesterRole, 'yangilash');

    if (dto.role && ROLE_LEVEL[dto.role] >= ROLE_LEVEL[requesterRole]) {
      throw new ForbiddenException("O'zingizdan yuqori yoki teng role bera olmaysiz");
    }

    if (dto.username && dto.username !== user.username) {
      const existing = await this.userRepo.findOne({ where: { username: dto.username } });
      if (existing) throw new ConflictException('Bu username allaqachon band');
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
      if (existing) throw new ConflictException('Bu telefon raqam allaqachon band');
    }

    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (dto.username) user.username = dto.username;
    if (dto.phone) user.phone = dto.phone;
    if (dto.cefrLevel) user.cefrLevel = dto.cefrLevel;
    if (dto.role) user.role = dto.role;
    if (dto.password) user.password = await bcrypt.hash(dto.password, 10);

    return this.formatUser(await this.userRepo.save(user));
  }

  async deleteUser(id: string, requesterId: string, requesterRole: Role) {
    if (id === requesterId) throw new BadRequestException("O'zingizni o'chira olmaysiz");
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    this.checkAccess(user, requesterId, requesterRole, "o'chirish");
    await this.userRepo.remove(user);
    return { message: "O'chirildi" };
  }

  private checkAccess(user: User, requesterId: string, requesterRole: Role, action: string) {
    if (user.role === Role.superAdmin) throw new ForbiddenException(`superAdmin foydalanuvchini ${action} huquqi yo'q`);
    if (ROLE_LEVEL[user.role] >= ROLE_LEVEL[requesterRole]) {
      throw new ForbiddenException(`Bu foydalanuvchini ${action} huquqi yo'q`);
    }
  }

  formatUser(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phone: user.phone,
      role: user.role,
      cefrLevel: user.cefrLevel ?? null,
      createdAt: user.created_at,
    };
  }
}

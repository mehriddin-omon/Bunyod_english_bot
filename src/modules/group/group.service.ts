import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from 'src/common/core/entitys/group.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { CreateGroupDto, UpdateGroupDto, AddMembersDto, AddLessonsDto } from './dto/group.dto';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
  ) {}

  /**
   * Yangi guruh yaratish
   */
  async createGroup(dto: CreateGroupDto, userId: string): Promise<Group> {
    const group = this.groupRepo.create({
      name: dto.name,
      description: dto.description,
      createdBy: userId,
      members: [],
      lessons: [],
    });

    if (dto.memberIds && dto.memberIds.length > 0) {
      const members = await this.userRepo.findByIds(dto.memberIds);
      if (members.length !== dto.memberIds.length) {
        throw new BadRequestException('Some members not found');
      }
      group.members = members;
    }

    if (dto.lessonIds && dto.lessonIds.length > 0) {
      const lessons = await this.lessonRepo.findByIds(dto.lessonIds);
      if (lessons.length !== dto.lessonIds.length) {
        throw new BadRequestException('Some lessons not found');
      }
      group.lessons = lessons;
    }

    return this.groupRepo.save(group);
  }

  /**
   * Barcha guruhlarni olish
   */
  async getAllGroups(userId?: string): Promise<Group[]> {
    const query = this.groupRepo.createQueryBuilder('g').leftJoinAndSelect('g.members', 'members').leftJoinAndSelect('g.lessons', 'lessons');

    if (userId) {
      query.where('g.createdBy = :userId', { userId });
    }

    return query.getMany();
  }

  /**
   * Guruh ID bo'yicha olish
   */
  async getGroupById(groupId: string): Promise<Group> {
    const group = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'members')
      .leftJoinAndSelect('g.lessons', 'lessons')
      .where('g.id = :groupId', { groupId })
      .getOne();

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  /**
   * Guruhni yangilash
   */
  async updateGroup(groupId: string, dto: UpdateGroupDto): Promise<Group> {
    const group = await this.getGroupById(groupId);

    if (dto.name) group.name = dto.name;
    if (dto.description) group.description = dto.description;

    if (dto.memberIds) {
      const members = await this.userRepo.findByIds(dto.memberIds);
      if (members.length !== dto.memberIds.length) {
        throw new BadRequestException('Some members not found');
      }
      group.members = members;
    }

    if (dto.lessonIds) {
      const lessons = await this.lessonRepo.findByIds(dto.lessonIds);
      if (lessons.length !== dto.lessonIds.length) {
        throw new BadRequestException('Some lessons not found');
      }
      group.lessons = lessons;
    }

    return this.groupRepo.save(group);
  }

  /**
   * Guruhdagi a'zolarni o'zgarishi
   */
  async addMembers(groupId: string, dto: AddMembersDto): Promise<Group> {
    const group = await this.getGroupById(groupId);
    const members = await this.userRepo.findByIds(dto.memberIds);

    if (members.length !== dto.memberIds.length) {
      throw new BadRequestException('Some members not found');
    }

    group.members = [...group.members, ...members];
    return this.groupRepo.save(group);
  }

  /**
   * Guruhdagi darslarni o'zgarishi
   */
  async addLessons(groupId: string, dto: AddLessonsDto): Promise<Group> {
    const group = await this.getGroupById(groupId);
    const lessons = await this.lessonRepo.findByIds(dto.lessonIds);

    if (lessons.length !== dto.lessonIds.length) {
      throw new BadRequestException('Some lessons not found');
    }

    group.lessons = [...group.lessons, ...lessons];
    return this.groupRepo.save(group);
  }

  /**
   * Guruhni o'chirish
   */
  async deleteGroup(groupId: string): Promise<void> {
    const result = await this.groupRepo.delete(groupId);
    if (result.affected === 0) {
      throw new NotFoundException('Group not found');
    }
  }

  /**
   * Guruhdan a'zoni o'chirish
   */
  async removeMember(groupId: string, memberId: string): Promise<Group> {
    const group = await this.getGroupById(groupId);
    group.members = group.members.filter((m) => m.id !== memberId);
    return this.groupRepo.save(group);
  }
}

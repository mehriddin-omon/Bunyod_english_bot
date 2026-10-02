import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import {
  RosterAccessFilter,
  RosterAddedFilter,
  TeacherStudentsService,
} from './teacher-students.service';
import {
  CreateStudentDto,
  ResetStudentPasswordDto,
  SetStudentAccessDto,
  UpdateStudentDto,
} from './dto/teacher-students.dto';

/**
 * "O'quvchilarim" sahifasi uchun endpointlar.
 *
 * Bu bo'lim o'quvchining SHAXSIY va ma'muriy ma'lumoti bilan ishlaydi:
 * telefon, manzil, daraja, kim/qachon qo'shgani va tizimga kira olish holati.
 * O'quv faolligi (progres, ball, davomat) — Nazorat bo'limida.
 *
 * Har bir panel alohida endpointdan o'qiydi — bitta sekin so'rov butun
 * sahifani to'xtatib qo'ymaydi.
 */
@Controller('teacher/students')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.subTeacher, Role.admin)
export class TeacherStudentsController {
  constructor(private readonly service: TeacherStudentsService) {}

  /** Guruhlar ro'yxati (KPI dagi "guruh soni" uchun) */
  @Get('groups')
  async getGroups(@Request() req) {
    return this.service.getGroups(req.user.sub, req.user.role);
  }

  /** Yuqoridagi KPI kartalar */
  @Get('summary')
  async getSummary(@Request() req) {
    return this.service.getSummary(req.user.sub, req.user.role);
  }

  /**
   * O'quvchilar jadvali. Markazdagi barcha role='student' foydalanuvchilar
   * qaytadi — guruh bo'yicha cheklov yo'q.
   *
   * Sahifalab qaytariladi: `page` (1 dan), `limit` (5–100, standart 25).
   * Qidiruv va filtrlar ham bazada qo'llanadi — aks holda sahifalash noto'g'ri
   * bo'lardi (filter faqat joriy sahifaga tegib qolardi).
   */
  @Get('roster')
  async getRoster(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('access') access?: RosterAccessFilter,
    @Query('added') added?: RosterAddedFilter,
  ) {
    return this.service.getRoster({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      access,
      added,
    });
  }

  /** Tekshirilmagan (baholanmagan) topshiriq javoblari */
  @Get('pending-reviews')
  async getPendingReviews(@Request() req, @Query('limit') limit?: string) {
    return this.service.getPendingReviews(req.user.sub, req.user.role, limit ? Number(limit) : 6);
  }

  /** Bugungi darslar */
  @Get('today-schedule')
  async getTodaySchedule(@Request() req) {
    return this.service.getTodaySchedule(req.user.sub, req.user.role);
  }

  /** Yangi o'quvchi qo'shish — o'qituvchi faqat role='student' yarata oladi */
  @Post()
  async createStudent(@Body() dto: CreateStudentDto, @Request() req) {
    return this.service.createStudent(dto, req.user.sub);
  }

  /** Shaxsiy ma'lumotlarni tahrirlash (ism, familiya, telefon, manzil, daraja) */
  @Patch(':id')
  async updateStudent(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.service.updateStudent(id, dto);
  }

  /** Tizimga kirishni bloklash / ochish */
  @Patch(':id/access')
  async setAccess(@Param('id') id: string, @Body() dto: SetStudentAccessDto) {
    return this.service.setAccess(id, dto);
  }

  /** Parolni tiklash — o'qituvchi yangi parol o'rnatadi */
  @Patch(':id/password')
  async resetPassword(@Param('id') id: string, @Body() dto: ResetStudentPasswordDto) {
    return this.service.resetPassword(id, dto);
  }
}

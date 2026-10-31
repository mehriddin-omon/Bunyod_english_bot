import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { TeacherUnitsService } from './teacher-units.service';
import { CreateUnitDto, ReorderUnitsDto, UpdateUnitDto } from './dto/unit.dto';

/**
 * Bo'limlar (units) boshqaruvi — teacher panel «Bo'limlar» sahifasi.
 * Ilovada bo'lim raqami dars kodida ko'rinadi («2.4»), shuning uchun raqam o'zgarsa kodlar ham o'zgaradi.
 */
@Controller('teacher/units')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.admin)
export class TeacherUnitsController {
  constructor(private readonly svc: TeacherUnitsService) {}

  /** GET /teacher/units — hamma bo'limlar, darslar soni bilan */
  @Get()
  list() {
    return this.svc.list();
  }

  /** POST /teacher/units */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUnitDto) {
    return this.svc.create(dto);
  }

  /** PUT /teacher/units/reorder — { ids } yangi tartibda */
  @Put('reorder')
  reorder(@Body() dto: ReorderUnitsDto) {
    return this.svc.reorder(dto.ids);
  }

  /** PUT /teacher/units/:id */
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.svc.update(id, dto);
  }

  /**
   * DELETE /teacher/units/:id — bo'limda dars bo'lsa: `?moveTo=<unitId>` (darslar o'sha bo'limga ko'chadi)
   * yoki `?detach=1` (darslar bo'limsiz qoladi). Ikkalasi ham bo'lmasa — 400 `UNIT_HAS_LESSONS`.
   */
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('moveTo') moveTo?: string,
    @Query('detach') detach?: string,
  ) {
    return this.svc.remove(id, { moveTo: moveTo || undefined, detach: detach === '1' || detach === 'true' });
  }
}

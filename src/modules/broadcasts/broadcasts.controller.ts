import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { AudienceService } from 'src/common/services/audience.service';
import { BroadcastsService } from './broadcasts.service';
import { CreateBroadcastDto, PreviewAudienceDto, UpdateBroadcastDto } from './dto/broadcast.dto';

const STAFF = [Role.teacher, Role.admin, Role.superAdmin];

/** Teacher → o'quvchilar va mehmonlarga bildirishnoma (2026-11) */
@Controller('teacher/broadcasts')
@Roles(...STAFF)
export class BroadcastsController {
  constructor(private readonly service: BroadcastsService) {}

  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    return this.service.list(req.user, status);
  }

  @Post()
  create(@Body() dto: CreateBroadcastDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.detail(id, req.user);
  }

  @Get(':id/recipients')
  recipients(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Query('filter') filter?: string,
    @Query('search') search?: string,
  ) {
    return this.service.recipients(id, req.user, filter, search);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBroadcastDto, @Req() req: any) {
    return this.service.update(id, dto, req.user);
  }

  @Post(':id/send')
  sendNow(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.sendNow(id, req.user);
  }

  @Post(':id/resend-unread')
  resendUnread(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.resendUnread(id, req.user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.remove(id, req.user);
  }
}

/** Qabul qiluvchini tanlash oynasi — bildirishnoma va onlayn dars uchun umumiy */
@Controller('teacher/audience')
@Roles(...STAFF)
export class AudienceController {
  constructor(private readonly audience: AudienceService) {}

  /** Guruhlar (soni bilan) va umumiy sonlar */
  @Get('options')
  options(@Req() req: any) {
    return this.audience.options(req.user);
  }

  /** O'quvchilar va mehmonlar — bitta ro'yxatda qidiruv */
  @Get('users')
  users(@Query('search') search?: string, @Query('limit') limit?: string, @Query('ids') ids?: string) {
    if (ids) return this.audience.usersByIds(ids.split(',').map((s) => s.trim()));
    return this.audience.searchUsers(search, Number(limit) || 20);
  }

  /** «Barcha mehmonlarni qo'shish» tugmasi uchun */
  @Get('guests')
  guests() {
    return this.audience.allGuests();
  }

  /** «67 ta qabul qiluvchi · 51 tasida push yoqilgan» */
  @Post('preview')
  preview(@Body() dto: PreviewAudienceDto, @Req() req: any) {
    return this.audience.preview(dto.audience, req.user);
  }
}

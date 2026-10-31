import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { ChatService } from './chat.service';
import {
  BlockUserDto,
  ChatSettingsDto,
  EditMessageDto,
  PinMessageDto,
  ReportMessageDto,
  ResolveReportDto,
  RestrictUserDto,
  SendMessageDto,
} from './dto/chat.dto';

/**
 * Guruh chati (2026-11). Manzillar guruh ID si bo'yicha: har guruhga bitta chat.
 * Real vaqt: Socket.IO `/chat` (chat.gateway.ts); REST — tarix va zaxira.
 */
@Controller('chats')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('my')
  my(@Req() req: any) {
    return this.chat.myChats(req.user);
  }

  @Post('rules/accept')
  acceptRules(@Req() req: any) {
    return this.chat.acceptRules(req.user);
  }

  @Get('blocks')
  blocked(@Req() req: any) {
    return this.chat.blocked(req.user);
  }

  @Post('blocks')
  block(@Body() dto: BlockUserDto, @Req() req: any) {
    return this.chat.block(req.user, dto.userId);
  }

  @Delete('blocks/:userId')
  unblock(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: any) {
    return this.chat.unblock(req.user, userId);
  }

  @Get(':groupId/messages')
  messages(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() req: any,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const cursor = before && /^[0-9a-f-]{36}$/i.test(before) ? before : undefined;
    return this.chat.messages(groupId, req.user, cursor, Number(limit) || 30);
  }

  @Post(':groupId/messages')
  send(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: SendMessageDto, @Req() req: any) {
    return this.chat.send(groupId, req.user, dto);
  }

  @Patch(':groupId/messages/:messageId')
  edit(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
    @Req() req: any,
  ) {
    return this.chat.edit(groupId, messageId, req.user, dto);
  }

  @Delete(':groupId/messages/:messageId')
  remove(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() req: any,
  ) {
    return this.chat.remove(groupId, messageId, req.user);
  }

  @Post(':groupId/messages/:messageId/report')
  report(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReportMessageDto,
    @Req() req: any,
  ) {
    return this.chat.report(groupId, messageId, req.user, dto.reason);
  }

  @Put(':groupId/read')
  read(@Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: any) {
    return this.chat.markRead(groupId, req.user);
  }

  @Get(':groupId/members')
  members(@Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: any) {
    return this.chat.members(groupId, req.user);
  }
}

/** Moderatsiya — guruh o'qituvchisi (yoki admin) */
@Controller('teacher/chats')
// subTeacher ham — guruh o'qituvchisi bo'lsa (tekshiruv moderatorContext'da)
@Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
export class TeacherChatController {
  constructor(private readonly chat: ChatService) {}

  @Put(':groupId/settings')
  settings(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: ChatSettingsDto, @Req() req: any) {
    return this.chat.updateSettings(groupId, req.user, dto);
  }

  @Put(':groupId/pin')
  pin(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: PinMessageDto, @Req() req: any) {
    return this.chat.pin(groupId, req.user, dto.messageId ?? null);
  }

  @Post(':groupId/restrictions')
  restrict(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: RestrictUserDto, @Req() req: any) {
    return this.chat.restrict(groupId, req.user, dto.userId, dto.hours);
  }

  @Delete(':groupId/restrictions/:userId')
  unrestrict(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: any,
  ) {
    return this.chat.unrestrict(groupId, req.user, userId);
  }

  @Get(':groupId/reports')
  reports(@Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: any, @Query('status') status?: string) {
    return this.chat.reports(groupId, req.user, status);
  }

  @Put(':groupId/reports/:reportId')
  resolveReport(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: ResolveReportDto,
    @Req() req: any,
  ) {
    return this.chat.resolveReport(groupId, reportId, req.user, dto.action);
  }
}

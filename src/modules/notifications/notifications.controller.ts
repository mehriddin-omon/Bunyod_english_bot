import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { PushService } from '../push/push.service';
import { RegisterPushTokenDto, RemovePushTokenDto, UpdatePreferencesDto } from './dto/notifications.dto';

@Controller('notifications')
@UseGuards(GuardService)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly push: PushService,
  ) {}

  /** GET /notifications */
  @Get()
  async getNotifications(@Req() req: any) {
    return this.notificationsService.getNotifications(req.user.sub);
  }

  /** PUT /notifications/read-all */
  @Put('read-all')
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  /** POST /notifications/push-token — ilova Expo push tokenini yuboradi (mehmon ham) */
  @Post('push-token')
  async registerToken(@Body() dto: RegisterPushTokenDto, @Req() req: any) {
    return this.push.registerToken(req.user.sub, dto.token, dto.platform ?? 'android', dto.appBuild ?? null);
  }

  /** DELETE /notifications/push-token — chiqishda */
  @Delete('push-token')
  async removeToken(@Body() dto: RemovePushTokenDto, @Req() req: any) {
    return this.push.removeToken(req.user.sub, dto.token);
  }

  /** GET /notifications/preferences */
  @Get('preferences')
  async getPreferences(@Req() req: any) {
    return this.notificationsService.getPreferences(req.user.sub);
  }

  /** PUT /notifications/preferences */
  @Put('preferences')
  async updatePreferences(@Body() dto: UpdatePreferencesDto, @Req() req: any) {
    return this.notificationsService.updatePreferences(req.user.sub, dto);
  }

  /** PUT /notifications/:id/read */
  @Put(':id/read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.sub);
  }

  /** PUT /notifications/:id/opened — push/karta bosib ochildi */
  @Put(':id/opened')
  async markOpened(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.notificationsService.markOpened(id, req.user.sub);
  }
}

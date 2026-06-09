import { Controller, Get, Put, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';

@Controller('notifications')
@UseGuards(GuardService)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /notifications */
  @Get()
  async getNotifications(@Req() req: any) {
    return this.notificationsService.getNotifications(req.user.sub);
  }

  /** PUT /notifications/:id/read */
  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.sub);
  }

  /** PUT /notifications/read-all */
  @Put('read-all')
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from 'src/common/core/entitys/notification.entity';
import { NotificationPreference } from 'src/common/core/entitys/notification-preference.entity';
import { PushModule } from '../push/push.module';

@Module({
  imports: [GuardModule, PushModule, TypeOrmModule.forFeature([Notification, NotificationPreference])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

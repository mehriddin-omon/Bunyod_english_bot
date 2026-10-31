import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationBroadcast } from 'src/common/core/entitys/notification-broadcast.entity';
import { AudienceModule } from 'src/common/services/audience.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AudienceController, BroadcastsController } from './broadcasts.controller';
import { BroadcastsService } from './broadcasts.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationBroadcast]), AudienceModule, NotificationsModule],
  providers: [BroadcastsService],
  controllers: [BroadcastsController, AudienceController],
})
export class BroadcastsModule {}

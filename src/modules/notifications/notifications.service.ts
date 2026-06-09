import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from 'src/common/core/entitys/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async getNotifications(userId: string) {
    const notifications = await this.notificationRepo.find({
      where: { userId },
      order: { created_at: 'DESC' },
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return {
      unread_count: unreadCount,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        read: n.isRead,
        created_at: n.created_at,
      })),
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.notificationRepo.update(
      { id: notificationId, userId },
      { isRead: true },
    );
    return { message: "O'qildi deb belgilandi" };
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
    return { message: "Barcha bildirishnomalar o'qildi" };
  }
}

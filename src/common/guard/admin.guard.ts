import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { UserService } from 'src/modules/user/user.service';
import { Context as TelegrafContext } from 'telegraf';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp().getRequest<TelegrafContext>();
    const userId = ctx.from?.id;

    if (!userId) {
      console.log('ctx.from', ctx.from)
      console.warn('AdminGuard: ctx.from.id yo‘q');
      throw new ForbiddenException('Foydalanuvchi aniqlanmadi');
    }

    const user = await this.userService.findByTelegramId(userId);
    if (!user) {
      console.warn(`AdminGuard: user topilmadi — telegramId: ${userId}`);
      throw new ForbiddenException('Foydalanuvchi ro‘yxatdan o‘tmagan');
    }

    if (user.role !== 'admin') {
      console.warn(`AdminGuard: user admin emas — role: ${user.role}`);
      throw new ForbiddenException('Sizda admin huquqi yo‘q');
    }

    return true;
  }
}
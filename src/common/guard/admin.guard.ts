import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserService } from 'src/modules/user/user.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UserService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp().getRequest();
    const user = await this.userService.findByTelegramId(ctx.from.id);
    if (!user){
      console.log('salom bu adminGuard file user topilmadi ');
      return false
    }
    return user?.role === 'admin';
  }
}

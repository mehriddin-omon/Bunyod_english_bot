import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Role } from 'src/common/utils/enum';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Foydalanuvchi aniqlanmadi');
    if (user.role !== Role.admin && user.role !== Role.superAdmin) {
      throw new ForbiddenException('Sizda admin huquqi yo\'q');
    }
    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { config } from '@my/config';
import { PUBLIC_KEY } from 'src/common/decorators/jwt-public.decorator';
import { Role } from 'src/common/utils';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { touchLastSeen } from 'src/common/services/last-seen';

interface JwtPayload {
  sub: string;           // id 
  username: string;      // username
  role: Role;          // role
}

@Injectable()
export class GuardService implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Authorization header yo‘q yoki noto‘g‘ri');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: config.JWT_ACCESS_SECRET,
      });
      request.user = payload;
    } catch (err) {
      throw new UnauthorizedException('Token noto‘g‘ri yoki muddati tugagan');
    }
    // «Oxirgi faollik» (users.last_seen_at) — bazaga daqiqasiga ko'pi bilan 1 marta yoziladi
    touchLastSeen(this.ds, (request as any).user?.sub);
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
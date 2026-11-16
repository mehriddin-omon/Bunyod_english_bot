import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { TelegramPollDto } from './dto/telegram-auth.dto';
import { TelegramAuthService } from './telegram-auth.service';

function clientIp(req: any): string {
  const forwarded = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
  return forwarded || req.ip || 'unknown';
}

/** Telegram orqali kirish / ro'yxatdan o'tish (DinoEnglish Telegram boti) */
@Controller('auth/telegram')
@UseGuards(GuardService)
export class TelegramAuthController {
  constructor(private readonly service: TelegramAuthService) {}

  /** Login sahifasi / Welcome: yangi yoki mavjud akkauntga kirish */
  @Public()
  @Post('start')
  @HttpCode(200)
  start(@Req() req: any) {
    return this.service.start(clientIp(req));
  }

  /** Mehmon «Akkauntni saqlash»: yangi akkaunt o'rniga SHU mehmon saqlanadi (progress joyida) */
  @Post('start-guest')
  @HttpCode(200)
  startGuest(@Req() req: any) {
    return this.service.start(clientIp(req), req.user.sub);
  }

  /** Ilova har ~2 soniyada so'raydi; bot tasdiqlagach tokenlar BIR MARTA beriladi */
  @Public()
  @Post('poll')
  @HttpCode(200)
  poll(@Body() dto: TelegramPollDto) {
    return this.service.poll(dto.requestId, dto.pollSecret);
  }
}

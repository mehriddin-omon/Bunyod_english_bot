import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { User } from 'src/common/core/entitys/user.entity';
import { UserGamification } from 'src/common/core/entitys/gamification.entity';
import { TelegramLoginRequest } from 'src/common/core/entitys/telegram-login-request.entity';
import { AuthModule } from '../auth';
import { TelegramAuthController } from './telegram-auth.controller';
import { TelegramAuthService } from './telegram-auth.service';
import { DinoEnglishBotService } from './dinoenglish-bot.service';

/** Telegram orqali kirish / ro'yxatdan o'tish (2026-11, Abu Tolib usuli) */
@Module({
  imports: [
    GuardModule,
    AuthModule,
    TypeOrmModule.forFeature([TelegramLoginRequest, User, UserGamification]),
  ],
  providers: [TelegramAuthService, DinoEnglishBotService],
  controllers: [TelegramAuthController],
})
export class TelegramAuthModule {}

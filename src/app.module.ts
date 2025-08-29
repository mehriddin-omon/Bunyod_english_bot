import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { TypeOrmModule } from '@nestjs/typeorm';
import { session } from 'telegraf';

import { AppService } from './app.service';
import { LessonModule } from './modules/lesson/lesson.module';
import { UserModule } from './modules/user/user.module';
import { BotModule } from './modules/bot/bot.module';
import { APP_GUARD } from '@nestjs/core';
import { AdminGuard } from './common/guard/admin.guard';

@Module({
  imports: [
    // 🌱 Global config
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),

    // 🤖 Telegram bot config
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TelegrafModuleOptions => {
        const token = config.get<string>('TELEGRAM_TOKEN');
        if (!token)
          throw new Error('Missing TELEGRAM_TOKEN in .env');

        return {         
          token,
          middlewares: [session()],
        };
      },
    }),

    // 🗄️ Database config
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'mehriddin'),
        database: config.get<string>('DB_NAME', 'bunyod_english'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // synchronize: config.get<boolean>('DB_SYNC', true),
      }),
    }),

    // 📦 Feature modules
    BotModule,
    LessonModule,
    UserModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AdminGuard
    },
    AppService
  ],
})
export class AppModule { }
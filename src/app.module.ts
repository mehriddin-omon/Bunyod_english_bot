import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { session } from 'telegraf';

import { BotModule } from './modules/bot/bot.module';
import { UserModule } from './modules/user/user.module';
import { LessonModule } from './modules/lesson/lesson.module';
import { ListeningModule } from './modules/listening/listening.module';
import { ReadingModule } from './modules/reading/reading.module';
import { WordlistModule } from './modules/wordlist/wordlist.module';

const isProd = process.env.NODE_ENV === 'production';

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
        synchronize: !isProd,
        logging: !isProd,
      }),
    }),

    // 📦 Feature modules
    BotModule,
    LessonModule,
    UserModule,
    ListeningModule,
    ReadingModule,
    WordlistModule,
    // TestsModule,
  ],
  providers: [],
})
export class AppModule { }
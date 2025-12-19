import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { session } from 'telegraf';
import {
  BotModule,
  LessonModule,
  VocabularyModule,
  UserModule
} from './modules';
import { config } from './config';
import { TELEGRAM_TOKEN } from './common';

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
        const token = config.get<string>('NODE_ENV') === 'production'
          ? config.get<string>('TELEGRAM_BOT_PROD_TOKEN')
          : config.get<string>('TELEGRAM_BOT_DEMO_TOKEN');

        if (!token)
          throw new Error(`Missing ${TELEGRAM_TOKEN} in .env`);
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
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DB_URL'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') === 'development', //
        // logging: configService.get<string>('NODE_ENV') === 'development' ? ['query', 'error']:['error'], // Enable logging in development})
        retryAttempts: 3, // Retry connection attempts
      }),
    }),

    // 📦 Feature modules
    BotModule,
    LessonModule,
    UserModule,
    VocabularyModule,
    // TestsModule,
  ],
  providers: [],
})
export class AppModule { }
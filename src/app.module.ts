import { TelegrafModule, TelegrafModuleOptions } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { session } from 'telegraf';
import {
  BotModule,
  LessonModule,
  VocabularyModule,
  UserModule,
  AuthModule
} from './modules';

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
        database: config.get<string>('DB_NAME', 'bunyod_tech'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: !isProd,
        logging: !isProd,
      }),
    }),

    // 📦 Feature modules
    AuthModule,
    BotModule,
    LessonModule,
    UserModule,
    VocabularyModule,
    // TestsModule,
  ],
  providers: [],
})
export class AppModule { }
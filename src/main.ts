import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const isProd = process.env.NODE_ENV === 'production'; // hozir false bo'ladi

async function bootstrap() {

  if (isProd) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
    });
  }

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 2003);
  await app.listen(port);
  Logger.log(`🚀 Telegram bot is running on port ${port}`, 'Bootstrap')
}
bootstrap();

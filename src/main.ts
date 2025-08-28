import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
// import { Telegraf } from 'telegraf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // const bot = app.get(Telegraf)
  // await bot.telegram.deleteWebhook();
  // await bot.launch();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 2003);
  await app.listen(port);
  Logger.log(`🚀 Telegram bot is running on port ${port}`, 'Bootstrap')
}
bootstrap();

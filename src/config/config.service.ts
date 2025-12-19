import * as dotenv from 'dotenv';
dotenv.config();
import { Logger } from '@nestjs/common';

export type ConfigType = {
  APP_PORT: number;
  DB_URL: string;
  NODE_ENV: string;
  TELEGRAM_BOT_DEMO_TOKEN: string;
  TELEGRAM_BOT_PROD_TOKEN: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TIME: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_TIME: string;
};

const requiredVariables = [
  'APP_PORT',
  'DB_URL',
  'NODE_ENV',
  'TELEGRAM_BOT_DEMO_TOKEN',
  'TELEGRAM_BOT_PROD_TOKEN',
  'JWT_ACCESS_SECRET',
  'JWT_ACCESS_TIME',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_TIME',
];

const missingVariables = requiredVariables.filter((variable) => {
  const value = process.env[variable];
  return !value || value.trim() === '';
});

if (missingVariables.length > 0) {
  Logger.error(
    `Missing or empty required environment variables: ${missingVariables.join(', ')}`,
  );
  process.exit(1);
}

export const config: ConfigType = {
  APP_PORT: Number(process.env.APP_PORT),
  DB_URL: process.env.DB_URL!,
  NODE_ENV: process.env.NODE_ENV!,
  TELEGRAM_BOT_DEMO_TOKEN: process.env.TELEGRAM_BOT_DEMO_TOKEN!,
  TELEGRAM_BOT_PROD_TOKEN: process.env.TELEGRAM_BOT_PROD_TOKEN!,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_ACCESS_TIME: process.env.JWT_ACCESS_TIME!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_REFRESH_TIME: process.env.JWT_REFRESH_TIME!,
};

export const corsConfig = {
  development: {
    origin: ['http://localhost:2003', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  production: {
    origin: process.env.FRONTEND_URL?.split(',') || [],
    credentials: true,
  },
};

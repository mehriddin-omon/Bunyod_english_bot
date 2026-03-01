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
  JWT_ACCESS_TIME: number;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_TIME: number;
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
  DB_URL: String(process.env.DB_URL),
  NODE_ENV: String(process.env.NODE_ENV),
  
  TELEGRAM_BOT_DEMO_TOKEN: String(process.env.TELEGRAM_BOT_DEMO_TOKEN),
  TELEGRAM_BOT_PROD_TOKEN: String(process.env.TELEGRAM_BOT_PROD_TOKEN),

  JWT_ACCESS_SECRET: String(process.env.JWT_ACCESS_SECRET),
  JWT_ACCESS_TIME: Number(process.env.JWT_ACCESS_TIME),
  JWT_REFRESH_SECRET: String(process.env.JWT_REFRESH_SECRET),
  JWT_REFRESH_TIME: Number(process.env.JWT_REFRESH_TIME),
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

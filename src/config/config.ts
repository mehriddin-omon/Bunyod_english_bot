import * as dotenv from 'dotenv';
dotenv.config();

export const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'mehriddin',
    name: process.env.DB_NAME || 'bunyod_tech',
    sync: process.env.DB_SYNC === 'true',
  },

  telegram: {
    token: process.env.TELEGRAM_TOKEN || '',
    adminId: process.env.ADMIN_TG_ID || '',
  },

  env: process.env.NODE_ENV || 'development',
};
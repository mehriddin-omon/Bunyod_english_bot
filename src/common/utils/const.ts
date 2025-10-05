import { isProd } from "src/config/config";

export const TELEGRAM_GROUP_ID = isProd ? '1896733920' : '-1002922948167';
export const GROUP_URL = isProd ? 'https://t.me/english_with_Shamsiddinov' : 'https://t.me/bunyod_english_demobot';
export const TEACHER_ID = [1355383611, 5129652174];

// telegramga malumotlarni saqlash uchun private kanal 
export const SAVED_TELEGRAM_CHANNEL_ID = isProd ? '-1002526079208' : '-1003010800585';
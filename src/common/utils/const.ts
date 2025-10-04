
//developda false, productionda true
const isProd = process.env.NODE_ENV === 'production';

export const TELEGRAM_CHANNEL_ID = isProd ? '@shamsiddinov_1347' : '@mehriddin_omon';
export const CHANNEL_URL = isProd ? 'https://t.me/english_with_Shamsiddinov' : 'https://t.me/mehriddin_omon';
export const TEACHER_ID = [1355383611, 5129652174]

// telegramga malumotlarni saqlash uchun private kanal 
export const SAVED_TELEGRAM_CHANNEL_ID = isProd ? '-1002526079208' : '-1003010800585';
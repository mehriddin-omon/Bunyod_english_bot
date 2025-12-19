const isProd = process.env.NODE_ENV === 'production';
const BUNYOT_TG_ID = Number(process.env.BUNYOT_TG_ID) || 5129652174;
const ADMIN_TG_ID = Number(process.env.ADMIN_TG_ID) || 1355383611;


export const TELEGRAM_GROUP_ID = isProd ? '-1001896733920' : '-1003132818529';

export const GROUP_URL = isProd ? 'https://t.me/english_with_Shamsiddinov' : 'https://t.me/bunyod_englishdemo';
export const TEACHER_ID = [BUNYOT_TG_ID, ADMIN_TG_ID];
export const TELEGRAM_TOKEN = isProd
  ? process.env.TELEGRAM_BOT_PROD_TOKEN || '8435780765:AAFk72cVVINvrEH1-MRRexNdEkyKttjB1uw'
  : process.env.TELEGRAM_BOT_DEMO_TOKEN || '8489353859:AAFGP3l8QaHccBftmA2L5GFAXoJ5M6xgOXM';

// telegramga malumotlarni saqlash uchun private kanal
export const SAVED_TELEGRAM_CHANNEL_ID = isProd ? '-1002526079208' : '-1003010800585';
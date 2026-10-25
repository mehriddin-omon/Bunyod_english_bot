/**
 * Mobil ilova relizlari — «Nima yangi» matni SHU YERDA yoziladi.
 *
 * Yangi reliz chiqarish tartibi:
 *  1. Ro'yxat BOSHIGA yangi yozuv qo'shiladi. `versionCode` — Play'ga yuklangan
 *     AAB'ning versionCode'i bilan AYNAN bir xil bo'lishi shart (eas build uni oshiradi).
 *  2. Backend deploy qilinadi — endi shu versiyani o'rnatganlar «Nima yangi» ni ko'radi.
 *  3. Play'da reliz hammaga chiqqach `.env` da `APP_ANDROID_LATEST_VERSION_CODE` shu
 *     versionCode'ga o'rnatiladi — eski versiyadagilarga «Yangi versiya bor» chiqadi.
 *  4. Eski versiya umuman ishlamay qolsa — `APP_ANDROID_MIN_VERSION_CODE` ko'tariladi
 *     (bundan pastdagilar majburan yangilaydi). Faqat Play'da reliz to'liq chiqqandan keyin!
 *
 * Matn qisqa bo'lsin: `title` — 2–3 so'z (taklif oynasida faqat shu chiqadi),
 * `text` — bitta gap. Bir relizda 2–4 ta band.
 */

export type ReleaseIcon =
  | 'rating'
  | 'dictionary'
  | 'offline'
  | 'lesson'
  | 'listening'
  | 'coin'
  | 'account'
  | 'fix'
  | 'star';

export interface ReleaseNote {
  icon: ReleaseIcon;
  title: string;
  text: string;
}

export interface AppRelease {
  versionCode: number;
  versionName: string;
  notes: ReleaseNote[];
}

export const ANDROID_RELEASES: AppRelease[] = [
  {
    versionCode: 4,
    versionName: '1.1.0',
    notes: [
      {
        icon: 'rating',
        title: "Reyting bo'limi",
        text: "Guruhdoshlar bilan bellashing — har hafta top 3 keyingi ligaga chiqadi.",
      },
      {
        icon: 'dictionary',
        title: "Oflayn lug'at",
        text: "So'zlarni internetsiz qidiring, talaffuzini tinglang va saqlab qo'ying.",
      },
      {
        icon: 'offline',
        title: 'Internetsiz darslar',
        text: 'Bir marta ochilgan dars, audio va rasmlar keyin internetsiz ham ochiladi.',
      },
      {
        icon: 'fix',
        title: 'Tuzatishlar',
        text: 'Bir nechta xatolar tuzatildi, ilova tezroq ishlaydi.',
      },
    ],
  },
];

export const IOS_RELEASES: AppRelease[] = [];

export const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=uz.lenguara.app',
  ios: null as string | null,
};

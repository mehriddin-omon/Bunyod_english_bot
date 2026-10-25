import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANDROID_RELEASES } from './app-releases';
import { AppVersionService } from './app-version.service';

function makeService(env: Record<string, string | undefined>) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new AppVersionService(config);
}

const RELEASE = ANDROID_RELEASES[0];

describe('AppVersionService', () => {
  it("env berilmasa — hech narsa e'lon qilinmaydi, majburiy yangilash yo'q", () => {
    const res = makeService({}).getVersion('android', '3');
    expect(res.latest).toBeNull();
    expect(res.minVersionCode).toBe(0);
    expect(res.platform).toBe('android');
    expect(res.storeUrl).toContain('uz.lenguara.app');
  });

  it('LATEST env bo\'yicha reliz va uning «Nima yangi» matni qaytadi', () => {
    const res = makeService({ APP_ANDROID_LATEST_VERSION_CODE: String(RELEASE.versionCode) })
      .getVersion('android', '1');
    expect(res.latest?.versionCode).toBe(RELEASE.versionCode);
    expect(res.latest?.versionName).toBe(RELEASE.versionName);
    expect(res.latest?.notes.length).toBeGreaterThan(0);
  });

  it("ro'yxatda yo'q LATEST — matnsiz, lekin versionCode bilan qaytadi", () => {
    const res = makeService({ APP_ANDROID_LATEST_VERSION_CODE: '999' }).getVersion('android', '1');
    expect(res.latest).toEqual({ versionCode: 999, versionName: '', notes: [] });
  });

  it("MIN bo'sh joy bilan yozilsa ham o'qiladi, noto'g'ri qiymat 0 bo'ladi", () => {
    expect(makeService({ APP_ANDROID_MIN_VERSION_CODE: ' 3 ' }).getVersion('android').minVersionCode).toBe(3);
    expect(makeService({ APP_ANDROID_MIN_VERSION_CODE: 'abc' }).getVersion('android').minVersionCode).toBe(0);
    expect(makeService({ APP_ANDROID_MIN_VERSION_CODE: '-5' }).getVersion('android').minVersionCode).toBe(0);
  });

  it('current — so\'ragan build\'ning matni (env\'ga bog\'liq emas)', () => {
    const svc = makeService({});
    expect(svc.getVersion('android', String(RELEASE.versionCode)).current?.versionCode).toBe(RELEASE.versionCode);
    expect(svc.getVersion('android', '123456').current).toBeNull();
    expect(svc.getVersion('android', 'x').current).toBeNull();
    expect(svc.getVersion('android').current).toBeNull();
  });

  it("platform: standart android, katta harf farqi yo'q, noma'lumi rad etiladi", () => {
    const svc = makeService({});
    expect(svc.getVersion(undefined).platform).toBe('android');
    expect(svc.getVersion('ANDROID').platform).toBe('android');
    expect(svc.getVersion('ios').storeUrl).toBeNull();
    expect(() => svc.getVersion('web')).toThrow(BadRequestException);
  });

  it("platformalar env'i aralashmaydi", () => {
    const svc = makeService({ APP_ANDROID_MIN_VERSION_CODE: '5', APP_IOS_MIN_VERSION_CODE: '2' });
    expect(svc.getVersion('android').minVersionCode).toBe(5);
    expect(svc.getVersion('ios').minVersionCode).toBe(2);
  });
});

describe('ANDROID_RELEASES', () => {
  it("versionCode'lar takrorlanmaydi va kamayish tartibida (yangisi boshida)", () => {
    const codes = ANDROID_RELEASES.map((r) => r.versionCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort((a, b) => b - a)).toEqual(codes);
  });

  it("har relizda 1–4 band, sarlavha va matn bo'sh emas", () => {
    for (const r of ANDROID_RELEASES) {
      expect(r.versionName).not.toBe('');
      expect(r.notes.length).toBeGreaterThanOrEqual(1);
      expect(r.notes.length).toBeLessThanOrEqual(4);
      for (const n of r.notes) {
        expect(n.title.trim()).not.toBe('');
        expect(n.text.trim()).not.toBe('');
      }
    }
  });
});

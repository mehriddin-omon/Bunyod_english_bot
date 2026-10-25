import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANDROID_RELEASES, AppRelease, IOS_RELEASES, STORE_URLS } from './app-releases';

export type AppPlatform = 'android' | 'ios';

const RELEASES: Record<AppPlatform, AppRelease[]> = {
  android: ANDROID_RELEASES,
  ios: IOS_RELEASES,
};

@Injectable()
export class AppVersionService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Ilova ochilganda so'raladi.
   * - `latest`  — e'lon qilingan eng yangi versiya (env), yo'q bo'lsa null
   * - `minVersionCode` — bundan past build majburan yangilanadi (0 = hech kim)
   * - `current` — so'ragan build'ning «Nima yangi» matni (env'ga bog'liq emas)
   */
  getVersion(platformRaw?: string, buildRaw?: string) {
    const platform = this.parsePlatform(platformRaw);
    const build = buildRaw ? Number.parseInt(buildRaw, 10) : NaN;

    const prefix = `APP_${platform.toUpperCase()}`;
    const latestCode = this.readCode(`${prefix}_LATEST_VERSION_CODE`);
    const minVersionCode = this.readCode(`${prefix}_MIN_VERSION_CODE`);

    const releases = RELEASES[platform];
    const find = (code: number): AppRelease | null =>
      releases.find((r) => r.versionCode === code) ?? null;

    const latest: AppRelease | null =
      latestCode > 0
        ? (find(latestCode) ?? { versionCode: latestCode, versionName: '', notes: [] })
        : null;

    return {
      platform,
      latest,
      minVersionCode,
      storeUrl: STORE_URLS[platform],
      current: Number.isFinite(build) && build > 0 ? find(build) : null,
    };
  }

  private parsePlatform(raw?: string): AppPlatform {
    const p = (raw ?? 'android').trim().toLowerCase();
    if (p !== 'android' && p !== 'ios') {
      throw new BadRequestException("platform faqat 'android' yoki 'ios' bo'lishi mumkin");
    }
    return p;
  }

  private readCode(key: string): number {
    const n = Number.parseInt(String(this.config.get<string>(key) ?? '').trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}

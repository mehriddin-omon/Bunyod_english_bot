import { Injectable, Logger } from '@nestjs/common';

/** Test uchun almashtirsa bo'ladi (ZOOM_API_BASE / ZOOM_OAUTH_URL), odatda bo'sh qoldiriladi */
const API = process.env.ZOOM_API_BASE || 'https://api.zoom.us/v2';
const OAUTH = process.env.ZOOM_OAUTH_URL || 'https://zoom.us/oauth/token';

export class ZoomError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ZoomError';
  }
}

export interface ZoomMeeting {
  id: number;
  uuid: string;
  join_url: string;
  start_url: string;
  password?: string;
  topic: string;
}

export interface ZoomRecordingFile {
  id: string;
  file_type: string;
  file_size?: number;
  download_url: string;
  recording_type?: string;
  recording_start?: string;
  recording_end?: string;
  status?: string;
}

export interface ZoomRecordings {
  uuid: string;
  id: number;
  duration?: number;
  recording_files?: ZoomRecordingFile[];
}

/**
 * Zoom API — Server-to-Server OAuth (2026-11).
 * `.env`: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_HOST_EMAIL (ixtiyoriy, standart `me`).
 * Barcha darslar shu bitta Zoom foydalanuvchi (litsenziya) nomidan ochiladi.
 */
@Injectable()
export class ZoomClient {
  private readonly logger = new Logger(ZoomClient.name);
  private token: { value: string; expiresAt: number } | null = null;
  private statusCache: { ok: boolean; at: number; error?: string } | null = null;

  isConfigured(): boolean {
    return !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
  }

  get hostUser(): string {
    return process.env.ZOOM_HOST_EMAIL?.trim() || 'me';
  }

  /** Ulanish holati (10 daqiqa keshlanadi) */
  async status(): Promise<{ configured: boolean; ok: boolean; error?: string }> {
    if (!this.isConfigured()) return { configured: false, ok: false };
    if (this.statusCache && Date.now() - this.statusCache.at < 10 * 60 * 1000) {
      return { configured: true, ok: this.statusCache.ok, error: this.statusCache.error };
    }
    try {
      await this.getToken();
      this.statusCache = { ok: true, at: Date.now() };
    } catch (err) {
      this.statusCache = { ok: false, at: Date.now(), error: (err as Error).message };
    }
    return { configured: true, ok: this.statusCache.ok, error: this.statusCache.error };
  }

  async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 5 * 60 * 1000) return this.token.value;
    const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');
    const url = `${OAUTH}?grant_type=account_credentials&account_id=${encodeURIComponent(process.env.ZOOM_ACCOUNT_ID ?? '')}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
      signal: AbortSignal.timeout(15000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      throw new ZoomError(res.status, `Zoom token olinmadi: ${json.reason ?? json.error ?? res.status}`);
    }
    this.token = { value: json.access_token, expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  private async request<T>(method: string, path: string, body?: unknown, allow404 = false): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 204) return undefined as T;
    if (res.status === 404 && allow404) return undefined as T;
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ZoomError(res.status, `Zoom: ${json.message ?? res.statusText} (${res.status})`);
    }
    return json as T;
  }

  /** Zoom `start_time` — UTC, sekundsiz "Z" bilan */
  private zoomTime(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  createMeeting(input: {
    topic: string;
    startsAt: Date;
    durationMin: number;
    record: boolean;
    waitingRoom: boolean;
    muteOnEntry: boolean;
  }): Promise<ZoomMeeting> {
    return this.request<ZoomMeeting>('POST', `/users/${encodeURIComponent(this.hostUser)}/meetings`, {
      topic: input.topic.slice(0, 200),
      type: 2,
      start_time: this.zoomTime(input.startsAt),
      duration: input.durationMin,
      timezone: 'Asia/Tashkent',
      settings: {
        host_video: true,
        participant_video: false,
        join_before_host: false,
        waiting_room: input.waitingRoom,
        mute_upon_entry: input.muteOnEntry,
        auto_recording: input.record ? 'cloud' : 'none',
        approval_type: 2,
        meeting_authentication: false,
      },
    });
  }

  updateMeeting(
    meetingId: string,
    patch: Partial<{ topic: string; startsAt: Date; durationMin: number; record: boolean; waitingRoom: boolean; muteOnEntry: boolean }>,
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (patch.topic !== undefined) body.topic = patch.topic.slice(0, 200);
    if (patch.startsAt !== undefined) {
      body.start_time = this.zoomTime(patch.startsAt);
      body.timezone = 'Asia/Tashkent';
    }
    if (patch.durationMin !== undefined) body.duration = patch.durationMin;
    const settings: Record<string, unknown> = {};
    if (patch.record !== undefined) settings.auto_recording = patch.record ? 'cloud' : 'none';
    if (patch.waitingRoom !== undefined) settings.waiting_room = patch.waitingRoom;
    if (patch.muteOnEntry !== undefined) settings.mute_upon_entry = patch.muteOnEntry;
    if (Object.keys(settings).length) body.settings = settings;
    return this.request<void>('PATCH', `/meetings/${meetingId}`, body);
  }

  deleteMeeting(meetingId: string): Promise<void> {
    return this.request<void>('DELETE', `/meetings/${meetingId}`, undefined, true);
  }

  getMeeting(meetingId: string): Promise<ZoomMeeting> {
    return this.request<ZoomMeeting>('GET', `/meetings/${meetingId}`);
  }

  getRecordings(meetingUuid: string): Promise<ZoomRecordings> {
    return this.request<ZoomRecordings>('GET', `/meetings/${encodeUuid(meetingUuid)}/recordings`);
  }

  deleteRecordings(meetingUuid: string): Promise<void> {
    return this.request<void>('DELETE', `/meetings/${encodeUuid(meetingUuid)}/recordings?action=trash`, undefined, true);
  }

  async getParticipants(meetingUuid: string): Promise<
    { id?: string; user_id?: string; name: string; join_time: string; leave_time?: string; duration?: number }[]
  > {
    const out: any[] = [];
    let next = '';
    for (let i = 0; i < 10; i++) {
      const q = `page_size=300${next ? `&next_page_token=${encodeURIComponent(next)}` : ''}`;
      const json: any = await this.request('GET', `/report/meetings/${encodeUuid(meetingUuid)}/participants?${q}`);
      out.push(...(json?.participants ?? []));
      next = json?.next_page_token ?? '';
      if (!next) break;
    }
    return out;
  }

  /**
   * Yozuv faylini oqim sifatida yuklab olish. Webhook'dagi download_url S2S token bilan
   * ishlamaydi — shuning uchun havola `getRecordings` dan olinadi va Bearer bilan so'raladi.
   */
  async download(url: string): Promise<Response> {
    const token = await this.getToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'follow' });
    if (!res.ok || !res.body) throw new ZoomError(res.status, `Yozuv yuklab olinmadi (${res.status})`);
    return res;
  }
}

/** UUID `/` bilan boshlansa yoki `//` bo'lsa Zoom ikki marta encode talab qiladi */
export function encodeUuid(uuid: string): string {
  return uuid.startsWith('/') || uuid.includes('//')
    ? encodeURIComponent(encodeURIComponent(uuid))
    : encodeURIComponent(uuid);
}

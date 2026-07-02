import { Injectable, Logger } from '@nestjs/common';
import * as googleTTS from 'google-tts-api';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly audioDir: string;

  constructor() {
    this.audioDir = path.join(process.cwd(), 'uploads', 'audio');
    fs.mkdirSync(this.audioDir, { recursive: true });
  }

  async generate(word: string): Promise<string | null> {
    try {
      const base64: string = await (googleTTS as any).getAudioBase64(word, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
      });

      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
      const filePath = path.join(this.audioDir, filename);
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

      return `/uploads/audio/${filename}`;
    } catch (err) {
      this.logger.warn(`TTS xato "${word}": ${(err as Error).message}`);
      return null;
    }
  }
}

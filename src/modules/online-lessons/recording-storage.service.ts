import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Dars yozuvlari ombori (2026-11).
 *  - DigitalOcean Spaces (S3 mos): SPACES_KEY, SPACES_SECRET, SPACES_BUCKET, SPACES_ENDPOINT
 *    (masalan https://fra1.digitaloceanspaces.com), SPACES_REGION (masalan fra1).
 *    Bucket PRIVATE — o'quvchiga 3 soatlik imzoli havola beriladi.
 *  - Spaces sozlanmagan bo'lsa — serverning `uploads/recordings/` papkasi (zaxira).
 */
@Injectable()
export class RecordingStorageService {
  private readonly logger = new Logger(RecordingStorageService.name);
  private client: S3Client | null = null;

  get kind(): 'spaces' | 'local' {
    return this.isSpaces() ? 'spaces' : 'local';
  }

  private isSpaces(): boolean {
    return !!(
      process.env.SPACES_KEY &&
      process.env.SPACES_SECRET &&
      process.env.SPACES_BUCKET &&
      process.env.SPACES_ENDPOINT
    );
  }

  private s3(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        endpoint: process.env.SPACES_ENDPOINT,
        region: process.env.SPACES_REGION || 'us-east-1',
        forcePathStyle: false,
        credentials: {
          accessKeyId: process.env.SPACES_KEY as string,
          secretAccessKey: process.env.SPACES_SECRET as string,
        },
      });
    }
    return this.client;
  }

  private localPath(key: string): string {
    return join(process.cwd(), 'uploads', key);
  }

  async put(key: string, body: Readable, contentType: string): Promise<'spaces' | 'local'> {
    if (this.isSpaces()) {
      const upload = new Upload({
        client: this.s3(),
        queueSize: 2,
        partSize: 16 * 1024 * 1024,
        params: {
          Bucket: process.env.SPACES_BUCKET as string,
          Key: key,
          Body: body,
          ContentType: contentType,
          ACL: 'private',
        },
      });
      await upload.done();
      return 'spaces';
    }
    const path = this.localPath(key);
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    await pipeline(body, createWriteStream(path));
    return 'local';
  }

  /**
   * Ko'rish havolasi. Spaces — to'liq imzoli URL; lokal — `/uploads/...` (ilova/veb
   * `getMediaUrl` bilan server manzilini qo'shadi).
   */
  async url(kind: string | null, key: string, expiresSec = 3 * 60 * 60): Promise<string> {
    if (kind === 'spaces') {
      return getSignedUrl(
        this.s3(),
        new GetObjectCommand({ Bucket: process.env.SPACES_BUCKET as string, Key: key }),
        { expiresIn: expiresSec },
      );
    }
    return `/uploads/${key}`;
  }

  async remove(kind: string | null, key: string): Promise<void> {
    try {
      if (kind === 'spaces') {
        await this.s3().send(new DeleteObjectCommand({ Bucket: process.env.SPACES_BUCKET as string, Key: key }));
      } else if (existsSync(this.localPath(key))) {
        unlinkSync(this.localPath(key));
      }
    } catch (err) {
      this.logger.warn(`Yozuv o'chirilmadi (${key}): ${(err as Error).message}`);
    }
  }
}

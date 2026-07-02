import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

function makeStorage(folder: string) {
  return diskStorage({
    destination: `./uploads/${folder}`,
    filename: (_req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + extname(file.originalname));
    },
  });
}

@Controller('upload')
export class UploadController {
  constructor(private readonly configService: ConfigService) {}

  private buildUrl(folder: string, filename: string): string {
    return `/uploads/${folder}/${filename}`;
  }

  private deleteOldFile(oldPath: string): void {
    try {
      // oldPath may be a relative path (/uploads/...) or a legacy full URL
      const relative = oldPath.replace(/^https?:\/\/[^/]+/, '');
      const filePath = join(process.cwd(), relative);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // eski fayl o'chirilmasa jarayon to'xtatilmaydi
    }
  }

  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('audio'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat audio fayllar qabul qilinadi (mp3, ogg, wav)'), false);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return { url: this.buildUrl('audio', file.filename) };
  }

  @Put('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('audio'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat audio fayllar qabul qilinadi (mp3, ogg, wav)'), false);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  updateAudio(@UploadedFile() file: Express.Multer.File, @Body('oldUrl') oldUrl: string) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    if (oldUrl) this.deleteOldFile(oldUrl);
    return { url: this.buildUrl('audio', file.filename) };
  }

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('images'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat rasm fayllar qabul qilinadi (jpg, png, webp, gif)'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return { url: this.buildUrl('images', file.filename) };
  }

  @Put('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('images'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat rasm fayllar qabul qilinadi (jpg, png, webp, gif)'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  updateImage(@UploadedFile() file: Express.Multer.File, @Body('oldUrl') oldUrl: string) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    if (oldUrl) this.deleteOldFile(oldUrl);
    return { url: this.buildUrl('images', file.filename) };
  }

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('videos'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat video fayllar qabul qilinadi (mp4, webm, ogg, mov)'), false);
        }
      },
      limits: { fileSize: 20 * 1024 * 1024 * 1024 },
    }),
  )
  uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return { url: this.buildUrl('videos', file.filename) };
  }

  @Put('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('videos'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat video fayllar qabul qilinadi (mp4, webm, ogg, mov)'), false);
        }
      },
      limits: { fileSize: 20 * 1024 * 1024 * 1024 },
    }),
  )
  updateVideo(@UploadedFile() file: Express.Multer.File, @Body('oldUrl') oldUrl: string) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    if (oldUrl) this.deleteOldFile(oldUrl);
    return { url: this.buildUrl('videos', file.filename) };
  }

  @Post('document')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('documents'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat hujjat fayllar qabul qilinadi (pdf, doc, docx, ppt, pptx)'), false);
        }
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return { url: this.buildUrl('documents', file.filename) };
  }

  @Put('document')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: makeStorage('documents'),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat hujjat fayllar qabul qilinadi (pdf, doc, docx, ppt, pptx)'), false);
        }
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  updateDocument(@UploadedFile() file: Express.Multer.File, @Body('oldUrl') oldUrl: string) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    if (oldUrl) this.deleteOldFile(oldUrl);
    return { url: this.buildUrl('documents', file.filename) };
  }
}

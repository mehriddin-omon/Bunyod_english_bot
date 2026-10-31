import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { LessonAccessGuard } from 'src/common/guard/lesson-access.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { SPEAKING_UPLOAD_DIR, SpeakingService } from './speaking.service';
import { GradeSpeakingDto } from './dto/speaking.dto';

/** Telefon m4a (aac) yozadi; brauzer (teacher ovozli izohi) — webm/ogg */
const AUDIO_MIME = /^(audio\/[a-z0-9.+-]+|video\/mp4|video\/3gpp|video\/webm)$/i;
const AUDIO_EXT = /^\.(m4a|mp4|aac|3gp|mp3|wav|ogg|oga|opus|webm|caf)$/i;

const audioStorage = diskStorage({
  destination: `./uploads/${SPEAKING_UPLOAD_DIR}`,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname || '').toLowerCase();
    const safe = AUDIO_EXT.test(ext) ? ext : '.m4a';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safe}`);
  },
});

const audioFilter = (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  if (AUDIO_MIME.test(file.mimetype) || AUDIO_EXT.test(extname(file.originalname || ''))) cb(null, true);
  else cb(new BadRequestException('Faqat audio fayl qabul qilinadi'), false);
};

/**
 * SPEAKING — o'quvchi API'si (ilova). Kontent ilova ichida, server faqat ishni saqlaydi.
 * `LessonAccessGuard` — mehmon/ketma-ket qulf (multipart fayllar saqlanishidan OLDIN ishlaydi).
 */
@Controller('speaking')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.student)
export class SpeakingController {
  constructor(private readonly speaking: SpeakingService) {}

  /** GET /speaking/lessons/:lessonId — mening ishim yoki null */
  @Get('lessons/:lessonId')
  mine(@Req() req: any, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.speaking.mine(req.user.sub, lessonId);
  }

  /**
   * POST /speaking/lessons/:lessonId — multipart: `payload` (JSON) + `audio_<no>` fayllar
   * (birinchi topshirishda hamma savol, keyin — faqat qayta aytilganlari).
   */
  @Post('lessons/:lessonId')
  @UseGuards(LessonAccessGuard)
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: audioStorage,
      fileFilter: audioFilter,
      limits: { fileSize: 15 * 1024 * 1024, files: 20 },
    }),
  )
  submit(
    @Req() req: any,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body('payload') payload: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.speaking.submit(req.user.sub, lessonId, payload, files ?? []);
  }

  /** POST /speaking/lessons/:lessonId/seen — baho ko'rildi */
  @Post('lessons/:lessonId/seen')
  seen(@Req() req: any, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.speaking.markSeen(req.user.sub, lessonId);
  }
}

/** Teacher panel: speaking ishlarini eshitish va baholash */
@Controller('teacher/speaking')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
export class SpeakingTeacherController {
  constructor(private readonly speaking: SpeakingService) {}

  /** GET /teacher/speaking?status=pending|graded&search=&page= */
  @Get()
  list(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    return this.speaking.list(req.user, { status, search, page: Number(page) || 1 });
  }

  /** GET /teacher/speaking/students/:studentId/lessons/:lessonId — mavzu sheet'idagi panel uchun */
  @Get('students/:studentId/lessons/:lessonId')
  byStudentLesson(
    @Req() req: any,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.speaking.byStudentLesson(req.user, studentId, lessonId);
  }

  @Get(':id')
  detail(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.speaking.detail(req.user, id);
  }

  /** PUT /teacher/speaking/:id/grade — `final: true` bo'lsa o'quvchiga yuboriladi */
  @Put(':id/grade')
  grade(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: GradeSpeakingDto) {
    return this.speaking.grade(req.user, id, body);
  }

  /** POST /teacher/speaking/:id/voice — ovozli izoh (maydon `file`) */
  @Post(':id/voice')
  @UseInterceptors(
    FileInterceptor('file', { storage: audioStorage, fileFilter: audioFilter, limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  setVoice(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.speaking.setVoice(req.user, id, file);
  }

  @Delete(':id/voice')
  removeVoice(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.speaking.removeVoice(req.user, id);
  }
}

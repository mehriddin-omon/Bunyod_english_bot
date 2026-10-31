import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { Role } from 'src/common/utils/enum';
import { RecordingVisibility } from 'src/common/core/entitys/online-lesson.entity';
import { OnlineLessonsService } from './online-lessons.service';
import { OnlineLessonsJobs } from './online-lessons.jobs';
import {
  CreateOnlineLessonDto,
  RecordingProgressDto,
  RecordingVisibilityDto,
  SendRecordingDto,
  UpdateOnlineLessonDto,
} from './dto/online-lesson.dto';

const STAFF = [Role.teacher, Role.admin, Role.superAdmin];

/** Teacher: onlayn (Zoom) darslar — 2026-11 */
@Controller('teacher/online-lessons')
@Roles(...STAFF)
export class TeacherOnlineLessonsController {
  constructor(
    private readonly service: OnlineLessonsService,
    private readonly jobs: OnlineLessonsJobs,
  ) {}

  /** Zoom holati, yozuvlar ombori, oylik son */
  @Get('summary')
  summary(@Req() req: any) {
    return this.service.summary(req.user);
  }

  @Get()
  list(@Req() req: any, @Query('tab') tab?: string) {
    return this.service.teacherList(req.user, tab === 'past' ? 'past' : 'upcoming');
  }

  @Post()
  create(@Body() dto: CreateOnlineLessonDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.teacherDetail(id, req.user);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOnlineLessonDto, @Req() req: any) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.cancel(id, req.user);
  }

  @Post(':id/start')
  start(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.start(id, req.user);
  }

  @Post(':id/finish')
  finish(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.finish(id, req.user);
  }

  @Get(':id/attendance')
  attendance(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.attendance(id, req.user);
  }

  @Get('recordings/:recordingId/url')
  recordingUrl(@Param('recordingId', ParseUUIDPipe) recordingId: string, @Req() req: any) {
    return this.service.teacherRecordingUrl(recordingId, req.user);
  }

  @Put('recordings/:recordingId')
  setVisibility(
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() dto: RecordingVisibilityDto,
    @Req() req: any,
  ) {
    return this.service.setRecordingVisibility(recordingId, dto.visibility as RecordingVisibility, req.user);
  }

  @Post('recordings/:recordingId/send')
  sendRecording(
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() dto: SendRecordingDto,
    @Req() req: any,
  ) {
    return this.service.sendRecording(recordingId, dto, req.user);
  }

  @Post('recordings/:recordingId/retry')
  async retry(@Param('recordingId', ParseUUIDPipe) recordingId: string, @Req() req: any) {
    await this.service.teacherDetailByRecording(recordingId, req.user);
    return this.jobs.retry(recordingId);
  }
}

/** O'quvchi (mehmon ham, agar taklif qilingan bo'lsa) */
@Controller('online-lessons')
export class OnlineLessonsController {
  constructor(private readonly service: OnlineLessonsService) {}

  @Get()
  list(@Req() req: any, @Query('tab') tab?: string) {
    return this.service.studentList(req.user.sub, tab === 'past' ? 'past' : 'upcoming');
  }

  /** Bosh sahifadagi «Dars boshlandi» kartasi — yo'q bo'lsa null */
  @Get('live')
  async live(@Req() req: any) {
    return { lesson: await this.service.studentLive(req.user.sub) };
  }

  @Get('recordings')
  recordings(@Req() req: any) {
    return this.service.studentRecordings(req.user.sub);
  }

  @Get('recordings/:recordingId/play')
  play(@Param('recordingId', ParseUUIDPipe) recordingId: string, @Req() req: any) {
    return this.service.play(recordingId, req.user.sub);
  }

  @Put('recordings/:recordingId/progress')
  progress(
    @Param('recordingId', ParseUUIDPipe) recordingId: string,
    @Body() dto: RecordingProgressDto,
    @Req() req: any,
  ) {
    return this.service.saveProgress(recordingId, req.user.sub, dto);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.studentLesson(id, req.user.sub);
  }

  @Post(':id/join')
  join(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.join(id, req.user.sub);
  }
}

/**
 * Zoom webhook (Marketplace → Event Subscriptions):
 *   https://api.bunyod-english.uz/api/v1/zoom/webhook
 * Imzo: x-zm-signature = 'v0=' + HMAC_SHA256(ZOOM_WEBHOOK_SECRET, 'v0:' + timestamp + ':' + rawBody)
 * Javob 3 soniya ichida — ish fonda bajariladi.
 */
@Controller('zoom')
export class ZoomWebhookController {
  private readonly logger = new Logger(ZoomWebhookController.name);

  constructor(private readonly jobs: OnlineLessonsJobs) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const secret = process.env.ZOOM_WEBHOOK_SECRET?.trim();
    if (!secret) return res.status(503).json({ error: 'ZOOM_WEBHOOK_SECRET sozlanmagan' });

    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    const body: any = req.body ?? {};

    if (body.event === 'endpoint.url_validation') {
      const plainToken = String(body.payload?.plainToken ?? '');
      const encryptedToken = createHmac('sha256', secret).update(plainToken).digest('hex');
      return res.status(200).json({ plainToken, encryptedToken });
    }

    const ts = String(req.headers['x-zm-request-timestamp'] ?? '');
    const sig = String(req.headers['x-zm-signature'] ?? '');
    const expected = 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex');
    const tsNum = Number(ts);
    const fresh = Number.isFinite(tsNum) && Math.abs(Date.now() / 1000 - tsNum) < 5 * 60;
    const ok =
      fresh &&
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return res.status(401).json({ error: 'Imzo noto\'g\'ri' });

    res.status(200).json({ ok: true });
    setImmediate(() => {
      this.jobs.handleEvent(String(body.event ?? ''), body.payload).catch((err) =>
        this.logger.error(`Zoom hodisasi (${body.event}): ${(err as Error).message}`),
      );
    });
    return undefined;
  }
}

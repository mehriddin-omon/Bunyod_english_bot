import {
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
  UseGuards,
} from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { PhrasesService } from './phrases.service';
import {
  CreatePhraseCommentDto,
  CreatePhraseDto,
  PhraseCommentStatusDto,
  UpdatePhraseDto,
} from './dto';

/**
 * KUN IBORASI — o'quvchi API'si.
 * Statik yo'llar (`feed`) `:id` dan oldin e'lon qilinadi.
 */
@Controller('phrases')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.student, Role.teacher, Role.admin)
export class PhrasesController {
  constructor(private readonly phrases: PhrasesService) {}

  /** GET /phrases/feed — Bosh sahifa karuseli, eng oxirgi ibora 1-o'rinda */
  @Get('feed')
  feed(@Req() req: any, @Query('limit') limit?: string) {
    return this.phrases.feed(req.user.sub, Number(limit) || undefined);
  }

  /** POST /phrases/comments/:id/like — IZOH like'i (ibora like'idan alohida) */
  @Post('comments/:id/like')
  likeComment(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.likeComment(req.user.sub, id);
  }

  @Delete('comments/:id/like')
  unlikeComment(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.unlikeComment(req.user.sub, id);
  }

  @Post('comments/:id/report')
  reportComment(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.reportComment(req.user.sub, id);
  }

  @Put('comments/:id')
  updateComment(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreatePhraseCommentDto,
  ) {
    return this.phrases.updateComment(req.user.sub, id, body.body);
  }

  @Delete('comments/:id')
  removeComment(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.removeComment(req.user.sub, id);
  }

  /** GET /phrases/:id — to'liq ekran */
  @Get(':id')
  detail(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.detail(req.user.sub, id);
  }

  /** GET /phrases/:id/comments?sort=top|new&offset=0 */
  @Get(':id/comments')
  comments(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sort') sort?: string,
    @Query('offset') offset?: string,
  ) {
    return this.phrases.comments(req.user.sub, id, { sort, offset: Number(offset) || 0 });
  }

  /** POST /phrases/:id/comments — «Siz bu iborani qay holatda ishlatgansiz?» javobi */
  @Post(':id/comments')
  createComment(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreatePhraseCommentDto,
  ) {
    return this.phrases.createComment(req.user.sub, id, body.body);
  }

  /** POST /phrases/:id/like — IBORA like'i */
  @Post(':id/like')
  like(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.like(req.user.sub, id);
  }

  @Delete(':id/like')
  unlike(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.unlike(req.user.sub, id);
  }
}

/** Teacher / admin: ibora yuklash, tahrirlash va izohlar moderatsiyasi */
@Controller('teacher/phrases')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.subTeacher, Role.admin, Role.superAdmin)
export class PhrasesTeacherController {
  constructor(private readonly phrases: PhrasesService) {}

  /** GET /teacher/phrases?status=all|draft|published|archived */
  @Get()
  list(@Query('status') status?: string) {
    return this.phrases.teacherList(status);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreatePhraseDto) {
    return this.phrases.create(req.user.sub, body);
  }

  @Put('comments/:id/status')
  setCommentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PhraseCommentStatusDto,
  ) {
    return this.phrases.setCommentStatus(id, body.status);
  }

  @Get(':id/comments')
  comments(@Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.teacherComments(id);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePhraseDto) {
    return this.phrases.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.phrases.remove(id);
  }
}

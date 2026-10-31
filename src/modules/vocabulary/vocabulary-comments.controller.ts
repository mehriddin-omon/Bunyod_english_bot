import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { VocabularyCommentsService } from './vocabulary-comments.service';
import { ApproveMeaningDto, CreateCommentDto, ModerationNoteDto, ReportCommentDto, UpdateCommentDto } from './dto';

/**
 * LUG'AT IZOHLARI — talaba API'si.
 * Statik yo'llar (`preview`, `mine`) `:id` dan oldin e'lon qilinadi.
 */
@Controller('vocabulary/comments')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.student, Role.teacher, Role.admin)
export class VocabularyCommentsController {
  constructor(private readonly comments: VocabularyCommentsService) {}

  /** GET /vocabulary/comments/preview?word=book — kartadagi "Izohlar" bloki */
  @Get('preview')
  preview(@Req() req: any, @Query('word') word?: string) {
    if (!word) throw new BadRequestException('word kerak');
    return this.comments.preview(req.user.sub, word);
  }

  /** GET /vocabulary/comments/mine — mening izohlarim va coin chizig'i */
  @Get('mine')
  mine(@Req() req: any) {
    return this.comments.mine(req.user.sub);
  }

  /** GET /vocabulary/comments?word=&meaning=&kind=&sort= */
  @Get()
  list(
    @Req() req: any,
    @Query('word') word?: string,
    @Query('meaning') meaning?: string,
    @Query('kind') kind?: string,
    @Query('sort') sort?: string,
  ) {
    if (!word) throw new BadRequestException('word kerak');
    return this.comments.list(req.user.sub, { word, meaning, kind, sort });
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateCommentDto) {
    return this.comments.create(req.user.sub, body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCommentDto) {
    return this.comments.update(req.user.sub, id, body.body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.comments.remove(req.user.sub, id);
  }

  /** POST /vocabulary/comments/:id/like — bitta talaba bitta izohga 1 marta */
  @Post(':id/like')
  like(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.comments.like(req.user.sub, id);
  }

  @Delete(':id/like')
  unlike(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.comments.unlike(req.user.sub, id);
  }

  @Post(':id/report')
  report(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReportCommentDto) {
    return this.comments.report(req.user.sub, id, body.reason);
  }
}

/** Teacher / admin: izohlarni moderatsiya qilish */
@Controller('teacher/vocabulary/comments')
@UseGuards(GuardService, RolesGuard)
@Roles(Role.teacher, Role.admin)
export class VocabularyCommentsTeacherController {
  constructor(private readonly comments: VocabularyCommentsService) {}

  /** GET ?tab=meanings|reports|pinned|hidden&search= */
  @Get()
  list(@Query('tab') tab?: string, @Query('search') search?: string) {
    const t = (['meanings', 'reports', 'pinned', 'hidden'] as const).find((x) => x === tab) ?? 'meanings';
    return this.comments.teacherList(t, search);
  }

  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() body: ApproveMeaningDto) {
    return this.comments.approveMeaning(id, body);
  }

  @Post(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() body: ModerationNoteDto) {
    return this.comments.rejectMeaning(id, body.note);
  }

  @Post(':id/pin')
  pin(@Param('id', ParseUUIDPipe) id: string) {
    return this.comments.pin(id);
  }

  @Post(':id/unpin')
  unpin(@Param('id', ParseUUIDPipe) id: string) {
    return this.comments.unpin(id);
  }

  @Post(':id/hide')
  hide(@Param('id', ParseUUIDPipe) id: string, @Body() body: ModerationNoteDto) {
    return this.comments.hide(id, body.note);
  }

  /** Yashirilganni qaytarish / xabarlarni "muammo yo'q" deb yopish */
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.comments.restore(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.comments.teacherDelete(id);
  }
}

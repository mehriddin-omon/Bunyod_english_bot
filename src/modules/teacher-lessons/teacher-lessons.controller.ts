import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { TeacherLessonsService } from './teacher-lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Controller('teacher')
@UseGuards(GuardService, RolesGuard)
export class TeacherLessonsController {
  constructor(private readonly svc: TeacherLessonsService) {}

  @Get('lessons')
  @Roles(Role.teacher, Role.admin)
  getLessons(@Query() query: any) {
    return this.svc.getLessons(query);
  }

  @Post('lessons')
  @Roles(Role.teacher, Role.admin)
  @HttpCode(HttpStatus.CREATED)
  createLesson(@Body() dto: CreateLessonDto) {
    return this.svc.createLesson(dto);
  }

  @Get('lessons/:id')
  @Roles(Role.teacher, Role.admin)
  getLessonById(@Param('id') id: string) {
    return this.svc.getLessonById(id);
  }

  @Put('lessons/:id')
  @Roles(Role.teacher, Role.admin)
  updateLesson(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.svc.updateLesson(id, dto);
  }

  @Delete('lessons/:id')
  @Roles(Role.teacher, Role.admin)
  deleteLesson(@Param('id') id: string) {
    return this.svc.deleteLesson(id);
  }

  @Put('lessons/:id/publish')
  @Roles(Role.teacher, Role.admin)
  publishLesson(@Param('id') id: string) {
    return this.svc.publishLesson(id);
  }

  @Put('lessons/:id/draft')
  @Roles(Role.teacher, Role.admin)
  revertToDraft(@Param('id') id: string) {
    return this.svc.revertToDraft(id);
  }

  @Post('lessons/:id/duplicate')
  @Roles(Role.teacher, Role.admin)
  @HttpCode(HttpStatus.CREATED)
  duplicateLesson(@Param('id') id: string) {
    return this.svc.duplicateLesson(id);
  }

  @Get('grammar')
  @Roles(Role.teacher, Role.admin, Role.subTeacher)
  searchGrammar(@Query() query: any) {
    return this.svc.searchGrammar(query);
  }
}

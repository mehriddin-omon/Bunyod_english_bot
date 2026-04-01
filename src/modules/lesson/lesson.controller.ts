
import { Controller, Post, Body, UseInterceptors, UploadedFiles, Get, Param, Put } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { LessonService } from './lesson.service';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { VocabularyService } from '../vocabulary';
import { Role } from '@my/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';

@Controller('lesson')
class LessonController {
    constructor(

        private readonly lessonService: LessonService,

        private readonly vocabularyService: VocabularyService
    ) { }

    @Roles(Role.teacher, Role.admin)
    @Post('create')
    async createLesson(@Body() dto: CreateLessonDto) {
        return await this.lessonService.createLesson(dto)
    }

    @Roles(Role.admin, Role.student, Role.teacher)
    @Get(':lesson_id/vocabulary')
    async getLessonVocabulary(@Param('lesson_id') lesson_id: string) {
        return await this.vocabularyService.findByLessonId(lesson_id);
    }

    @Roles(Role.admin, Role.student, Role.teacher)
    @Get('all')
    async getAllLessons() {
        return await this.lessonService.getAllLessons();
    }

    @Roles(Role.teacher, Role.admin)
    @Put('update')
    async updateLesson(@Body() dto: UpdateLessonDto) {
        return await this.lessonService.updateLesson(dto)
    }

}

export { LessonController };

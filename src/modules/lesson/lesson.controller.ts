
import { Controller, Post, Body, UseInterceptors, UploadedFiles, Get, Param } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { LessonService } from './lesson.service';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { VocabularyService } from '../vocabulary';
import { Role } from '@my/common';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('lesson')
class LessonController {
    constructor(

        private readonly lessonService: LessonService,

        private readonly vocabularyService: VocabularyService
    ) { }

    @Public()
    @Post('create')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'files', maxCount: 20 }, // max 20 files, adjust as needed
        ])
    )
    async createLesson(
        @Body() lessonData: any,
        @UploadedFiles() files: { files?: any[] } = {}
    ) {
        console.log('lissons', lessonData);

        if (lessonData.sections && Array.isArray(lessonData.sections) && files && Array.isArray(files.files)) {
            let fileIdx = 0;
            lessonData.sections = lessonData.sections.map((section: any) => {
                if (section.file !== null && files.files && files.files[fileIdx]) {
                    section.file = files.files[fileIdx].path;
                    fileIdx++;
                }
                return section;
            });
        }
        return this.lessonService.saveFullLesson(lessonData);
    }

    @Roles(Role.admin, Role.student)
    @Get(':lesson_id/vocabulary')
    async getLessonVocabulary(@Param('lesson_id') lesson_id: string) {
        return await this.vocabularyService.findByLessonId(lesson_id);
    }

    @Roles(Role.admin, Role.student)
    @Get('all')
    async getAllLessons(){
        return await this.lessonService.getAllLessons();
    }

}

export { LessonController };


import { Controller, Post, Body, HttpCode, HttpStatus, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { LessonService } from './lesson.service';

@Controller('lesson')
class LessonController {
    constructor(
        private readonly lessonService: LessonService,
    ) { }

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
        console.log('lissons',lessonData);

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
}

export { LessonController };

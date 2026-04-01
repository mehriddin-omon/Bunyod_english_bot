import { LessonStatus } from "@my/common";
import { IsString } from "class-validator";
import { Lesson } from "src/common/core/entitys/lesson.entity";

export class CreateLessonDto {
    @IsString()
    lesson_name: string;
}

export class UpdateLessonDto extends CreateLessonDto {
    @IsString()
    id: string;

    @IsString()
    status: LessonStatus;
}
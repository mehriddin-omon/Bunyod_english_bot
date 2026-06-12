import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateLessonDto {
  @IsUUID()
  unitId: string;

  @IsString()
  lessonName: string;

  @IsOptional()
  @IsString()
  lessonNumber?: string;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}

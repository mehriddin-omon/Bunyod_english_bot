import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class UpdateLessonDto {
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsString()
  lessonName?: string;

  @IsOptional()
  @IsString()
  lessonNumber?: string;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}

import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  lessonCode?: string;

  @IsOptional()
  @IsNumber()
  unitNumber?: number;

  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @IsOptional()
  groupId?: string | null;
}

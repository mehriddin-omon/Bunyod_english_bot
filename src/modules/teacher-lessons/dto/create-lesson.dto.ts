import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  title: string;

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
  @IsUUID()
  groupId?: string;
}

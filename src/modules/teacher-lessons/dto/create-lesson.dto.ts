import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;

  @IsOptional()
  @IsString()
  cefrLevel?: string | null;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;
}

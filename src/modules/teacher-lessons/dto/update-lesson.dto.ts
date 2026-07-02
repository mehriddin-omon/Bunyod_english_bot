import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  title?: string;

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

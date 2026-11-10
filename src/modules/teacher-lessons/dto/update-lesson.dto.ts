import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;

  @IsOptional()
  @IsNumber()
  unitNumber?: number | null;

  @IsOptional()
  @IsString()
  cefrLevel?: string | null;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  /** Taxminiy vaqt, daqiqa (test konstruktoridagi «Vaqt») */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedMinutes?: number;
}

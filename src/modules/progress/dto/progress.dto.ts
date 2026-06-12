import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';

export class CompleteLessonDto {
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @IsInt()
  @Min(0)
  timeSpent: number;

  @IsOptional()
  @IsArray()
  answers?: Array<{ questionId: string; answer: string | string[] }>;
}

export class UpsertProgressDto {
  @IsUUID()
  lessonId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score: number;
}

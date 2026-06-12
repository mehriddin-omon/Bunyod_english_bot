import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateBlockDto {
  @IsString()
  @IsIn(['grammar', 'vocabulary', 'reading', 'listening', 'speaking', 'quiz'])
  type: 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'speaking' | 'quiz';

  @IsOptional()
  @IsString()
  grammarPage?: string;
}

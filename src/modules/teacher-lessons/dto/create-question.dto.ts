import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsIn(['mcq', 'true_false'])
  type: 'mcq' | 'true_false';

  @IsString()
  question: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsString()
  correctAnswer: string;

  @IsOptional()
  @IsString()
  explanation?: string;
}

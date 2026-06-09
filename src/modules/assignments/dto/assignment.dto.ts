import {
  IsString, IsOptional, IsEnum, IsUUID, IsDateString, IsInt, Min, Max,
} from 'class-validator';
import { AssignmentType } from 'src/common/utils/enum';

export class CreateAssignmentDto {
  @IsUUID()
  groupId: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(AssignmentType)
  type: AssignmentType;

  @IsDateString()
  dueDate: string;
}

export class SubmitAssignmentDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class GradeSubmissionDto {
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

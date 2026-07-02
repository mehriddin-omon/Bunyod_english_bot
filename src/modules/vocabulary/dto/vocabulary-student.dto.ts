import {
  IsIn, IsOptional, IsUUID, IsString, IsInt,
  IsBoolean, IsArray, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PracticeMode } from 'src/common/core/entitys/vocabulary-practice-log.entity';

export type SessionFilter = 'hard' | 'overdue' | 'today' | 'new' | 'custom';
export type SessionMode   = 'flashcard' | 'multiple_choice' | 'typing' | 'audio' | 'mixed';

export class StartSessionDto {
  @IsIn(['hard', 'overdue', 'today', 'new', 'custom'])
  filter: SessionFilter;

  @IsIn(['flashcard', 'multiple_choice', 'typing', 'audio', 'mixed'])
  mode: SessionMode;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

class AnswerItemDto {
  @IsUUID()
  pairId: string;

  @IsBoolean()
  correct: boolean;

  @IsOptional()
  @IsIn(['flashcard', 'multiple_choice', 'typing', 'audio'])
  mode?: PracticeMode;
}

export class SubmitSessionDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSec?: number;
}

export class ReviewPairDto {
  @IsBoolean()
  correct: boolean;
}

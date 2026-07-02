import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleInputDto {
  @IsArray()
  days: number[];

  @IsString()
  startTime: string;

  @IsNumber()
  duration: number;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;
}

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleInputDto)
  schedule?: ScheduleInputDto;

  @IsOptional()
  @IsArray()
  studentIds?: string[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AddStudentsDto {
  @IsArray()
  studentIds: string[];
}

export class SetAutoAdvanceDto {
  @IsBoolean()
  enabled: boolean;
}

export class SetManualCeilingDto {
  @IsNumber()
  ceilingIndex: number;
}

export class SetStudentFreeDto {
  @IsBoolean()
  isFree: boolean;
}

export class UnlockNextDto {
  @IsArray()
  studentIds: string[];
}

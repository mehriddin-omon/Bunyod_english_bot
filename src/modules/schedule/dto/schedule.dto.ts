import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';

export class CreateScheduleDto {
  @IsUUID()
  groupId: string;

  @IsArray()
  @IsInt({ each: true })
  days: number[];   // [0,2,4] = Du, Ch, Ju

  @IsString()
  startTime: string;  // "14:00"

  @IsInt()
  @Min(15)
  @Max(300)
  duration: number;   // daqiqada

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  days?: number[];

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;
}

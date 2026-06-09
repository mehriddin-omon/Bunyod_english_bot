import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class SaveSpeakingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examples?: string[];

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;
}

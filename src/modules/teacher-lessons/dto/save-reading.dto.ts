import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class SaveReadingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsNumber()
  readTimeMinutes?: number;

  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @IsOptional()
  @IsArray()
  highlights?: { word: string; type: string }[];
}

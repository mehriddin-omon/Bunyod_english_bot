import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class SaveListeningDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  trackCode?: string;

  @IsOptional()
  @IsArray()
  speakers?: { id: string; name: string }[];

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  transcript?: { speaker: string; timeStart: number; text: string }[];
}

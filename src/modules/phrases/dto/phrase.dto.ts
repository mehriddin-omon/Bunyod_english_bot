import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PhraseStatus } from 'src/common/core/entitys/phrase.entity';

export class PhraseExampleDto {
  @IsString()
  @MaxLength(300)
  en: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  uz: string;
}

/** POST /teacher/phrases */
export class CreatePhraseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transcription?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(400)
  meaningUz: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PhraseExampleDto)
  examples?: PhraseExampleDto[];

  /** /uploads/images/<fayl> — `POST /upload/image` qaytargan manzil */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  /** /uploads/videos/<fayl> — `POST /upload/video` qaytargan manzil */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  videoDurationSec?: number;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: PhraseStatus;

  /** Qaysi kundan ko'rinadi (berilmasa — hozir) */
  @IsOptional()
  @IsISO8601()
  publishAt?: string;
}

/** PUT /teacher/phrases/:id */
export class UpdatePhraseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transcription?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(400)
  meaningUz?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PhraseExampleDto)
  examples?: PhraseExampleDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  videoDurationSec?: number | null;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: PhraseStatus;

  @IsOptional()
  @IsISO8601()
  publishAt?: string;
}

/** POST /phrases/:id/comments */
export class CreatePhraseCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  body: string;
}

/** PUT /teacher/phrases/comments/:id/status */
export class PhraseCommentStatusDto {
  @IsIn(['active', 'hidden'])
  status: 'active' | 'hidden';
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SpeakingFixDto {
  @IsString()
  @MaxLength(300)
  wrong: string;

  @IsString()
  @MaxLength(300)
  right: string;
}

/** Bitta savol bahosi */
export class GradeSpeakingItemDto {
  @IsInt()
  @Min(1)
  @Max(30)
  no: number;

  /** 1..5; null — hali baholanmagan (qoralama) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SpeakingFixDto)
  fixes?: SpeakingFixDto[];
}

/** PUT /teacher/speaking/:id/grade */
export class GradeSpeakingDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => GradeSpeakingItemDto)
  items: GradeSpeakingItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;

  /** true — «Baholash va yuborish»: hamma savol baholangan bo'lishi shart, o'quvchiga xabar ketadi */
  @IsOptional()
  @IsBoolean()
  final?: boolean;
}

/**
 * POST /speaking/lessons/:lessonId — multipart: `payload` (shu shakldagi JSON matn) +
 * har yangi yozuv uchun `audio_<no>` fayli. Class-validator multipart'dagi JSON'ni
 * tekshirmaydi — `SpeakingService.parsePayload` qo'lda tekshiradi.
 */
export interface SubmitSpeakingPayload {
  taskKey: string;
  title?: string | null;
  kind?: 'questions' | 'monologue';
  items: Array<{
    no: number;
    q: string;
    written?: string | null;
    durationSec?: number | null;
    peeked?: boolean;
    retakes?: number;
  }>;
}

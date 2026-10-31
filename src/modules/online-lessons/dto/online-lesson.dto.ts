import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AudienceDto } from '../../broadcasts/dto/broadcast.dto';

export class LessonSettingsDto {
  @IsBoolean()
  record: boolean;

  @IsBoolean()
  waitingRoom: boolean;

  @IsBoolean()
  muteOnEntry: boolean;
}

export class CreateOnlineLessonDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  topic: string;

  @IsISO8601()
  startsAt: string;

  @IsInt()
  @Min(15)
  @Max(300)
  durationMin: number;

  @ValidateNested()
  @Type(() => AudienceDto)
  audience: AudienceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LessonSettingsDto)
  settings?: LessonSettingsDto;

  /** Darsdan necha daqiqa oldin eslatma: 1440 · 60 · 10 · 0 (boshlanganda) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(10080, { each: true })
  reminders?: number[];

  @IsOptional()
  @IsIn(['invited', 'all', 'hidden'])
  recordingVisibility?: 'invited' | 'all' | 'hidden';

  @IsOptional()
  @IsUUID('all')
  scheduleId?: string;

  /**
   * Zaxira rejim: Zoom API ulanmagan bo'lsa teacher o'z Zoom/Meet havolasini kiritadi.
   * Bunda xabar va eslatmalar ishlaydi, avto yozuv va davomat yo'q.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^https:\/\/\S+$/, { message: 'Havola https:// bilan boshlanishi kerak' })
  manualJoinUrl?: string;
}

export class UpdateOnlineLessonDto extends PartialType(CreateOnlineLessonDto) {}

export class RecordingVisibilityDto {
  @IsIn(['invited', 'all', 'hidden'])
  visibility: 'invited' | 'all' | 'hidden';
}

export class RecordingProgressDto {
  @IsInt()
  @Min(0)
  positionSec: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class SendRecordingDto {
  /** Kimlarga: qatnashmaganlar (standart) yoki hamma taklif qilinganlar */
  @IsOptional()
  @IsIn(['absent', 'all'])
  to?: 'absent' | 'all';
}

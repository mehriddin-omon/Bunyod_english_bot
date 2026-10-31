import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsUUID('all')
  replyToId?: string;

  /** Ilovadagi vaqtinchalik id — takror yuborilsa ikkinchi xabar yaratilmaydi */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientId?: string;
}

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}

export class ReportMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class BlockUserDto {
  @IsUUID('all')
  userId: string;
}

export class ChatSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  teacherOnly?: boolean;
}

export class PinMessageDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID('all')
  messageId: string | null;
}

export class RestrictUserDto {
  @IsUUID('all')
  userId: string;

  /** Necha soatga (1 soat … 30 kun) */
  @IsInt()
  @Min(1)
  @Max(720)
  hours: number;
}

export class ResolveReportDto {
  @IsIn(['dismiss', 'delete'])
  action: 'dismiss' | 'delete';
}

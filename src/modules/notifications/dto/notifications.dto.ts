import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(255)
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: 'android' | 'ios';

  @IsOptional()
  @IsInt()
  @Min(0)
  appBuild?: number;
}

export class RemovePushTokenDto {
  @IsString()
  @MaxLength(255)
  token: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  teacherMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  onlineLessons?: boolean;

  @IsOptional()
  @IsBoolean()
  groupChat?: boolean;

  /** ISO sana yoki null (ovozsiz rejimni bekor qilish) */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsISO8601()
  chatMutedUntil?: string | null;
}

import { IsEnum, IsOptional, IsString, MinLength, Matches, ValidateIf } from 'class-validator';
import { Role } from 'src/common/utils/enum';

export class LoginDto {
  /** Username yoki telefon raqam (+998XXXXXXXXX) */
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class RegisterDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @Matches(/^\+998\d{9}$/, { message: 'Telefon raqam +998XXXXXXXXX formatda bolishi kerak' })
  phoneNumber: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,20}$/, { message: 'Login 4-20 ta lotin harfi, raqam yoki _ bolishi kerak' })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bolishi kerak' })
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

/**
 * Mehmon akkauntni oddiy akkauntga aylantirish (POST /auth/upgrade).
 * Progress, coin, lug'at — hammasi o'sha user_id da qoladi.
 */
export class UpgradeAccountDto {
  @IsString()
  @MinLength(2, { message: 'Ismingizni kiriting' })
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,20}$/, { message: 'Login 4-20 ta lotin harfi, raqam yoki _ bolishi kerak' })
  username: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/, { message: 'Telefon raqam +998XXXXXXXXX formatda bolishi kerak' })
  phoneNumber?: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bolishi kerak' })
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/, { message: 'Telefon raqam +998XXXXXXXXX formatda bolishi kerak' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,20}$/, { message: 'Login 4-20 ta lotin harfi, raqam yoki _ bolishi kerak' })
  username?: string;

  /** Tug'ilgan sana YYYY-MM-DD (student_profiles.birth_date); null — o'chirish */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Tug'ilgan sana YYYY-MM-DD formatda bo'lishi kerak" })
  birthDate?: string | null;

  /** Telegram username (@ siz yoki @ bilan), 5–32 ta lotin harfi/raqam/_; null — o'chirish */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^@?[A-Za-z0-9_]{5,32}$/, {
    message: "Telegram username 5–32 ta lotin harfi, raqam yoki _ bo'lishi kerak",
  })
  telegramUsername?: string | null;

  /** Profil rasmi — POST /upload/image qaytargan yo'l (/uploads/images/...); null — o'chirish */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\/uploads\/images\/[\w.-]+$/, { message: "Rasm manzili noto'g'ri" })
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}

/** Ilova ichidan akkauntni o'chirish (foydalanuvchi tizimga kirgan) */
export class DeleteAccountDto {
  @IsString()
  password: string;
}

/** Veb-sahifadan akkauntni o'chirish (login + parol bilan, tokensiz) */
export class DeleteAccountByCredentialsDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

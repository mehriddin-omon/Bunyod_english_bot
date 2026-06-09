import { IsEnum, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { Role } from 'src/common/utils/enum';

export class LoginDto {
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
  phone: string;

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
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,20}$/, { message: 'Login 4-20 ta lotin harfi, raqam yoki _ bolishi kerak' })
  username?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}

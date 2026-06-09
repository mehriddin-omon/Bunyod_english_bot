import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsEmail,
  IsNumberString,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Role } from 'src/common/utils/enum';

export class CreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,20}$/, {
    message: 'Login 4-20 ta lotin harfi, raqam yoki _ bolishi kerak',
  })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bolishi kerak' })
  password: string;

  @IsOptional()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqam +998XXXXXXXXX formatda bolishi kerak',
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "Email formati noto'g'ri" })
  email?: string;

  @IsOptional()
  @IsEnum(Role, { message: "Role noto'g'ri" })
  role?: Role;
}

export class UpdateUserByAdminDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,20}$/, {
    message: 'Login 4-20 ta lotin harfi, raqam yoki _ bolishi kerak',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bolishi kerak' })
  password?: string;

  @IsOptional()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqam +998XXXXXXXXX formatda bolishi kerak',
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "Email formati noto'g'ri" })
  email?: string;

  @IsOptional()
  @IsEnum(Role, { message: "Role noto'g'ri" })
  role?: Role;
}

export class UpdateStudentProfileDto {
  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @IsOptional()
  @IsNumber()
  vocabularyRating?: number;

  @IsOptional()
  @IsString()
  parentContact?: string;

  @IsOptional()
  @IsString()
  enrollmentDate?: string;
}

export class UpdateTeacherProfileDto {
  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  experienceYears?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}

export class UserListQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cefrLevel?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { CefrLevel } from 'src/common/utils/enum';

/** POST /teacher/students — o'qituvchi yangi o'quvchi qo'shadi */
export class CreateStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'Ism kiritilmagan' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Familiya kiritilmagan' })
  lastName: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,20}$/, {
    message: "Login 4-20 ta lotin harfi, raqam yoki _ bo'lishi kerak",
  })
  username: string;

  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+998\d{9})?$/, {
    message: "Telefon raqam +998XXXXXXXXX formatda bo'lishi kerak",
  })
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(CefrLevel, { message: "Daraja noto'g'ri (A1…C2)" })
  cefrLevel?: CefrLevel;
}

/** PATCH /teacher/students/:id — o'quvchining shaxsiy ma'lumotlari */
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+998\d{9})?$/, {
    message: "Telefon raqam +998XXXXXXXXX formatda bo'lishi kerak",
  })
  phone?: string;

  /** Yashash manzili — student_profiles.address da saqlanadi */
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(CefrLevel, { message: "Daraja noto'g'ri (A1…C2)" })
  cefrLevel?: CefrLevel;
}

/** PATCH /teacher/students/:id/access — tizimga kirishni bloklash/ochish */
export class SetStudentAccessDto {
  @IsBoolean()
  isActive: boolean;
}

/** PATCH /teacher/students/:id/password — o'qituvchi yangi parol o'rnatadi */
export class ResetStudentPasswordDto {
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  password: string;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExerciseResultItemDto {
  /** topic_id — dars idsi (lessons.id) */
  @IsUUID()
  lessonId: string;

  /** Ilova kodidagi statik mashq kaliti.
   *  Qat'iy format: lesson{N}:{bo'lim}:ex{M}, masalan "lesson1:grammar:ex1".
   *  Kalitlarning yagona ro'yxati ilovada (src/constants/exerciseKeys.ts) —
   *  u yerda uniquelik TypeScript darajasida kafolatlanadi; bu regex esa
   *  formatga tushmaydigan chiqindi kalitlarni bazaga kiritmaydi. */
  @IsString()
  @MaxLength(120)
  @Matches(/^lesson\d+:[a-z]+:ex\d+[a-z]?$/, {
    message: "exerciseKey formati noto'g'ri (kutiladi: lesson{N}:{bo'lim}:ex{M})",
  })
  exerciseKey: string;

  /** Nechinchi urinish (har «Tekshirish» bosilganda +1) */
  @IsInt()
  @Min(1)
  attemptNumber: number;

  /** Natija foizda (0–100) */
  @IsInt()
  @Min(0)
  @Max(100)
  percent: number;

  /**
   * Nechta javob to'g'ri bo'ldi va mashqda jami nechta savol bor edi.
   *
   * Coin shu ikkisidan hisoblanadi (1 to'g'ri javob = 1 coin). Eski ilova
   * versiyalarining offline navbatida bu maydonlar yo'q — shuning uchun
   * ixtiyoriy; kelmasa natija saqlanadi, lekin coin berilmaydi.
   *
   * Yuqori chegara mashqning eng katta hajmidan ancha baland qo'yilgan:
   * bu ishonch emas, shunchaki chiqindi qiymatlardan himoya.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  correctCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  totalCount?: number;

  /** Shu bo'limda jami nechta mashq bor — bo'lim progressi shundan chiqadi */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  sectionTotal?: number;

  /** Mashq ishlangan vaqt (ISO 8601, ilovadan) */
  @IsISO8601()
  answeredAt: string;

  /** Idempotentlik kaliti — ilova generatsiya qiladigan UUID */
  @IsUUID()
  clientAttemptId: string;
}

export class SubmitExerciseResultsDto {
  /** Offline navbat bir so'rovda bo'shatiladi — shuning uchun massiv */
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExerciseResultItemDto)
  results: ExerciseResultItemDto[];
}

import {
  IsIn, IsOptional, IsUUID, IsString, IsInt,
  IsBoolean, IsArray, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PracticeMode } from 'src/common/core/entitys/vocabulary-practice-log.entity';

export type SessionFilter = 'hard' | 'overdue' | 'today' | 'new' | 'custom';
/**
 * Savol turi. "Aralash" (`mixed`) rejimi 2026-09 da olib tashlandi — lug'at
 * endi bosqichma-bosqich yodlanadi (`VOCAB_STAGES`, vocabulary.service.ts).
 */
export type SessionMode   = 'flashcard' | 'multiple_choice' | 'typing' | 'audio';

export class StartSessionDto {
  @IsIn(['hard', 'overdue', 'today', 'new', 'custom'])
  filter: SessionFilter;

  /**
   * Bosqichsiz (filtr bo'yicha takrorlash) sessiyada majburiy.
   * `stage` berilsa e'tiborga olinmaydi — tur bosqichdan olinadi.
   */
  @IsOptional()
  @IsIn(['flashcard', 'multiple_choice', 'typing', 'audio'])
  mode?: SessionMode;

  /**
   * Lug'at bosqichi (1..4). Berilsa `lessonId` majburiy: dars lug'atidagi
   * hamma so'z so'raladi, bosqich qulfi serverda tekshiriladi.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  stage?: number;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  /** bo'lim (unit) bo'yicha — `lessonId` bo'lsa e'tiborsiz */
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  /** bitta yoki vergul bilan bir nechta: "new,learning" */
  @IsOptional()
  @IsString()
  status?: string;

  /**
   * Sessiyadagi kartalar soni.
   *
   * Chegara 50 edi — bu xato bo'lardi: darsda 70 ta so'z bo'lsa ilova
   * `limit: 70` yuborib "Sessiyani boshlashda xatolik" olardi (400). Dars
   * lug'ati 200 tagacha bo'lishi mumkin, servis esa qiymatni yana bir bor
   * cheklaydi.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

class AnswerItemDto {
  @IsUUID()
  pairId: string;

  @IsBoolean()
  correct: boolean;

  @IsOptional()
  @IsIn(['flashcard', 'multiple_choice', 'typing', 'audio'])
  mode?: PracticeMode;
}

export class SubmitSessionDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSec?: number;
}

export class ReviewPairDto {
  @IsBoolean()
  correct: boolean;
}

// ─── Coinli sinov ───────────────────────────────────────────────────────────

export class StartCoinTestDto {
  @IsUUID()
  lessonId: string;
}

export class CoinTestAnswerDto {
  @IsUUID()
  pairId: string;

  /** tanlangan variant; null — ilovadagi 10 s taymer tugadi */
  @IsOptional()
  @IsString()
  answer?: string | null;
}

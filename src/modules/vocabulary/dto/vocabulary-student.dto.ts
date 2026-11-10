import {
  IsIn, IsOptional, IsUUID, IsString, IsInt,
  IsBoolean, IsArray, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PracticeMode } from 'src/common/core/entitys/vocabulary-practice-log.entity';

/**
 * `priority` — Lug'at ro'yxatining standart holati: qiynalgan → uzoq
 * takrorlanmagan → bugun takrorlash → yangi so'zlar, shu KETMA-KETLIKDA.
 */
export type SessionFilter = 'hard' | 'overdue' | 'today' | 'new' | 'priority' | 'custom';
/**
 * Savol turi. "Aralash" (`mixed`) rejimi 2026-09 da olib tashlandi — lug'at
 * endi bosqichma-bosqich yodlanadi (`VOCAB_STAGES`, vocabulary.service.ts).
 */
export type SessionMode   = 'flashcard' | 'multiple_choice' | 'typing' | 'audio';

export class StartSessionDto {
  @IsIn(['hard', 'overdue', 'today', 'new', 'priority', 'custom'])
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

  /** qism: 1 → 1–35, 2 → 36–70 (2026-11). Yuborilmasa — 1 (eski ilova) */
  @IsOptional()
  @IsInt()
  @Min(1)
  part?: number;
}

export class CoinTestAnswerDto {
  @IsUUID()
  pairId: string;

  /** yozilgan javob; null — ilovadagi taymer (15 s) tugadi */
  @IsOptional()
  @IsString()
  answer?: string | null;
}

// ─── Yangi o'qish oqimi (2026-11) ──────────────────────────────────────────

export class MarkSeenDto {
  @IsArray()
  @IsUUID('all', { each: true })
  pairIds: string[];
}

export class LentaAnswerDto {
  @IsUUID()
  pairId: string;

  /** pog'ona: 1 — eshitib tanlash, 2 — harf yig'ish, 3 — yozish */
  @IsInt()
  @Min(1)
  @Max(3)
  stage: number;

  @IsBoolean()
  correct: boolean;
}

export class SaveLentaDto {
  /** `L:<lessonId>:<n>` | `L:<lessonId>:growth` | `growth` | `saved` */
  @IsString()
  scope: string;

  @IsOptional()
  state?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LentaAnswerDto)
  answers?: LentaAnswerDto[];

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsBoolean()
  reset?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  clearedPairIds?: string[];
}

export class ReviewAnswerDto {
  @IsUUID()
  pairId: string;

  /** «Esladim» — true, «Eslay olmadim» — false */
  @IsBoolean()
  remembered: boolean;
}

// ─── Shorts + mashq birlashtirilgan oqim (2026-11) ─────────────────────

export class ShortsPracticeAnswerDto {
  @IsUUID()
  pairId: string;

  @IsInt()
  @Min(1)
  @Max(3)
  stage: number;

  @IsBoolean()
  correct: boolean;
}

export class SubmitShortsPracticeDto {
  /** Dars ID — berilmasa navbar rejimi (SRS yangilanadi) */
  @IsOptional()
  @IsUUID()
  lessonId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShortsPracticeAnswerDto)
  answers: ShortsPracticeAnswerDto[];
}

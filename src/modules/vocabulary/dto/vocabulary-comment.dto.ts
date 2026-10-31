import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const COMMENT_KINDS = ['mnemonic', 'sentence', 'meaning'] as const;
export const COMMENT_BODY_MAX = 200;

export class CreateCommentDto {
  /** inglizcha so'z (masalan "book") */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  word: string;

  @IsIn(COMMENT_KINDS as unknown as string[])
  kind: 'mnemonic' | 'sentence' | 'meaning';

  /** mnemonika / gap matni; `meaning` turida — misol gap */
  @IsString()
  @MinLength(2)
  @MaxLength(COMMENT_BODY_MAX)
  body: string;

  /**
   * mnemonika/gap uchun — ixtiyoriy ma'no yorlig'i (lug'atdagi tarjima, masalan "kitob");
   * `meaning` turida MAJBURIY — taklif qilinayotgan yangi ma'no.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  meaning?: string;
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(COMMENT_BODY_MAX)
  body: string;
}

export class ReportCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

// ─── Teacher ────────────────────────────────────────────────────────────────

export class ApproveMeaningDto {
  /** `new_pair` — lug'atga yangi juftlik qo'shiladi; `attach` — mavjud ma'noga biriktiriladi */
  @IsIn(['new_pair', 'attach'])
  mode: 'new_pair' | 'attach';

  /** `new_pair`: teacher tuzatgan tarjima (berilmasa talaba yozgani); `attach`: mavjud ma'no matni */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  translation?: string;

  /** `new_pair`: qaysi darsga qo'shiladi; berilmasa — erkin lug'at (darssiz) */
  @IsOptional()
  @IsUUID()
  lessonId?: string;
}

export class ModerationNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

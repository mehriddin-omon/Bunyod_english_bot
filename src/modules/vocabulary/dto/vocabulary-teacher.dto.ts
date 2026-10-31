import {
  IsString, IsOptional, IsEnum, IsUUID, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartOfSpeech } from 'src/common/utils/enum';

export class CreateWordDto {
  @IsString()
  word: string;

  @IsString()
  lang: string;

  @IsOptional()
  @IsString()
  ipa?: string;

  @IsOptional()
  @IsEnum(PartOfSpeech)
  pos?: PartOfSpeech;

  @IsOptional()
  @IsUUID()
  lessonId?: string;
}

export class UpdateWordDto {
  @IsOptional()
  @IsString()
  word?: string;

  @IsOptional()
  @IsString()
  ipa?: string;

  @IsOptional()
  @IsEnum(PartOfSpeech)
  pos?: PartOfSpeech;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreatePairDto {
  @IsUUID()
  vocabularyId: string;

  @IsUUID()
  translationId: string;
}

class ExampleItemDto {
  @IsString()
  englishText: string;

  @IsOptional()
  @IsString()
  uzbekText?: string;

  @IsOptional()
  @IsString()
  highlightWord?: string;
}

export class UpsertExamplesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleItemDto)
  examples: ExampleItemDto[];
}

class ReplaceVocabularyWordDto {
  @IsString()
  @MaxLength(200)
  word: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ipa?: string;

  @IsString()
  @MaxLength(300)
  translation: string;
}

/** Darsning lug'atini yangi to'plam bilan almashtirish (eski so'zlar o'chmaydi) */
export class ReplaceLessonVocabularyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReplaceVocabularyWordDto)
  words: ReplaceVocabularyWordDto[];
}

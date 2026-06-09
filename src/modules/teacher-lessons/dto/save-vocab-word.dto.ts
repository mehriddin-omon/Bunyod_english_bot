import { IsString, IsOptional } from 'class-validator';

export class SaveVocabWordDto {
  @IsString()
  word: string;

  @IsString()
  translation: string;

  @IsOptional()
  @IsString()
  ipa?: string;

  @IsOptional()
  @IsString()
  partOfSpeech?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  exampleEn?: string;

  @IsOptional()
  @IsString()
  exampleUz?: string;
}

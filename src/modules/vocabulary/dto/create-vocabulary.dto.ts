import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateVocabularyDto {
    @IsString()
    word: string;

    @IsOptional()
    @IsString()
    lang?: string;

    @IsOptional()
    @IsString()
    translation: string;

    @IsOptional()
    @IsString()
    example?: string;
}
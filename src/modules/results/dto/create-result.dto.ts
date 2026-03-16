import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateUserVocabularyStatsDto {
    @IsString()
    user_id: string;

    @IsOptional()
    @IsString()
    lang?: string;

    @IsOptional()
    @IsString()
    vocabulary_relation_id: string;

    @IsOptional()
    is_correct: boolean;
    
}
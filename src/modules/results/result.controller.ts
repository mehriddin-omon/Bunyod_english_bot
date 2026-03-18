import { Body, Controller, Post } from "@nestjs/common";
import { VocabularyStatsService } from "./vocabularystats.service";
import { Public } from "src/common/decorators/jwt-public.decorator";
import { CreateUserVocabularyStatsDto } from "./dto/create-result.dto";

@Controller('result')
export class ResultController {
    constructor(
        private readonly vocabularyStatsService: VocabularyStatsService
    ) { }

    @Public()
    @Post('create')
    async create(@Body() dto: CreateUserVocabularyStatsDto){
        return await this.vocabularyStatsService.insertUserVocabularyStats(dto)
    }
}
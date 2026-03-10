import * as gTTS from 'google-tts-api';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateVocabularyDto } from './dto/create-vocabulary.dto';
import { Vocabulary, VocabularyRelations } from 'src/common/core/entitys/vocabulary.entity';

@Injectable()
export class VocabularyService {
    constructor(
        @InjectRepository(Vocabulary)
        private readonly vocabularyRepository: Repository<Vocabulary>,

        @InjectRepository(VocabularyRelations)
        private readonly relationRepository: Repository<VocabularyRelations>,
    ) { }

    async generateVoice(word: string, outputDir: string) {
        const url = gTTS.getAudioUrl(word, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
        });

        const filePath = path.join(outputDir, `${word}.mp3`);

        const response = await fetch(url);
        const buffer = await response.arrayBuffer();

        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(filePath, Buffer.from(buffer));

        return filePath;
    }

    async parseVocabularyText(text: string) {
        // Matnni satrlar bo‘yicha ajratamiz (· yoki yangi qator)
        const lines = text
            .split(/\n|·/) // · yoki newline bo‘yicha split
            .map((l) => l.trim())
            .filter(Boolean);
        const words = lines
            .map((line) => {
                // Format: word /transcription/ - translation
                const fullMatch = line.match(/(.+?)\s*\/(.+?)\/\s*[-–]\s*(.+)/);
                if (fullMatch) {
                    const [, english, transcription, uzbek] = fullMatch;
                    return {
                        english: english.trim(),
                        transcription: transcription.trim(),
                        uzbek: uzbek.trim(),
                    };
                }

                // Format: word - translation (no transcription)
                const simpleMatch = line.match(/(.+?)\s*[-–]\s*(.+)/);
                if (simpleMatch) {
                    const [, english, uzbek] = simpleMatch;
                    return {
                        english: english.trim(),
                        transcription: '',
                        uzbek: uzbek.trim(),
                    };
                }

                return null;
            })
            .filter(
                (w): w is { english: string; transcription: string; uzbek: string } =>
                    w !== null,
            );

        return { words };
    }
    async sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async create(dto: CreateVocabularyDto): Promise<Vocabulary> {
        // Oxirgi order_index ni topamiz
        const last = await this.vocabularyRepository
            .createQueryBuilder('v')
            .orderBy('v.order_index', 'DESC')
            .getOne();

        let currentIndex: number = last ? Number(last.order_index) + 1 : 1;

        // Asosiy so‘z mavjudligini tekshiramiz
        let vocab = await this.vocabularyRepository.findOne({
            where: { word: dto.word, lang: dto.lang },
        });

        if (!vocab) {
            vocab = this.vocabularyRepository.create({
                word: dto.word,
                lang: dto.lang,
                example: dto.example,
                order_index: currentIndex++,
            });

            if (dto.lang === 'en') {
                const outputDir = path.resolve(process.cwd(), 'voices');
                const filePath = await this.generateVoice(dto.word, outputDir);
                vocab.voice_file_id = path.basename(filePath);
            }

            vocab = await this.vocabularyRepository.save(vocab);
        }

        // Tarjimalarni split qilamiz
        if (dto.translation) {
            const translations = dto.translation.split(',').map((t) => t.trim());

            for (const tr of translations) {
                // Avval tarjima mavjudligini tekshiramiz
                let translationWord = await this.vocabularyRepository.findOne({
                    where: { word: tr, lang: 'uz' },
                });

                if (!translationWord) {
                    translationWord = this.vocabularyRepository.create({
                        word: tr,
                        lang: 'uz',
                        order_index: currentIndex++,
                    });
                    translationWord = await this.vocabularyRepository.save(translationWord);
                }

                // Relation mavjudligini tekshiramiz
                const existingRelation = await this.relationRepository.findOne({
                    where: { vocabulary: vocab, translation: translationWord },
                });

                if (!existingRelation) {
                    await this.relationRepository.save({
                        vocabulary: vocab,
                        translation: translationWord,
                        difficulty: 0,
                    });
                }
            }
        }

        return vocab;
    }

    async importFromText(rawText: string) {
        const { words } = await this.parseVocabularyText(rawText);
        const results: Vocabulary[] = [];

        for (const w of words) {
            // Har bir so‘z uchun CreateVocabularyDto tuzamiz
            const dto: CreateVocabularyDto = {
                word: w.english,
                lang: 'en',
                example: w.transcription,   // hozircha bo‘sh
                translation: w.uzbek,       // tarjima matndan olinadi
            };

            // mavjud create funksiyasidan foydalanamiz
            const savedWord = await this.create(dto);
            results.push(savedWord);
        }

        return results;
    }

    async findAll(): Promise<Vocabulary[]> {
        return this.vocabularyRepository.find({
            relations: ['translations'], // agar entityda relation belgilangan bo‘lsa
            order: { order_index: 'ASC' },
        });
    }

    async findAllWithTranslations() {
        return this.vocabularyRepository
            .createQueryBuilder('v')
            .leftJoinAndSelect(VocabularyRelations, 'vr', 'vr.vocabulary_id = v.id')
            .leftJoinAndSelect('vr.translation', 'translation')
            .leftJoinAndSelect('v.lesson', 'lesson')
            .orderBy('v.order_index', 'ASC')
            .getMany();
    }
}
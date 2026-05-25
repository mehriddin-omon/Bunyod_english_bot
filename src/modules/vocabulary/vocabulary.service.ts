import * as gTTS from 'google-tts-api';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { Repository } from 'typeorm';
import {
    BadRequestException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateVocabularyDto } from './dto/create-vocabulary.dto';
import { Vocabulary, VocabularyRelations } from 'src/common/core/entitys/vocabulary.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';

@Injectable()
export class VocabularyService {
    constructor(
        @InjectRepository(Vocabulary)
        private readonly vocabularyRepository: Repository<Vocabulary>,

        @InjectRepository(VocabularyRelations)
        private readonly relationRepository: Repository<VocabularyRelations>,

        @InjectRepository(Lesson)
        private readonly lessonRepository: Repository<Lesson>,
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

        const invalidLines: string[] = [];

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

                invalidLines.push(line);
                return null;
            })
            .filter(
                (w): w is { english: string; transcription: string; uzbek: string } =>
                    w !== null,
            );

        return { words, invalidLines };
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

    async importFromText(rawText: string, lesson_id?: string) {
        if (!rawText?.trim()) {
            throw new BadRequestException('Import text is required.');
        }

        const { words, invalidLines } = await this.parseVocabularyText(rawText);

        if (words.length === 0) {
            const invalidSample = invalidLines.slice(0, 3).join(' | ');
            throw new BadRequestException(
                invalidSample
                    ? `No valid vocabulary rows were found. Expected format: "word /transcription/ - translation" or "word - translation". Invalid rows: ${invalidSample}`
                    : 'No valid vocabulary rows were found. Expected format: "word /transcription/ - translation" or "word - translation".',
            );
        }

        const results: Vocabulary[] = [];
        let lesson: Lesson | null = null;

        if (lesson_id) {
            lesson = await this.lessonRepository.findOne({
                where: { id: lesson_id },
                relations: ['vocabulary'],
            });

            if (!lesson) {
                throw new NotFoundException(`Lesson with id ${lesson_id} not found`);
            }
        }

        for (const w of words) {
            const dto: CreateVocabularyDto = {
                word: w.english,
                lang: 'en',
                example: w.transcription,
                translation: w.uzbek,
            };

            let savedWord: Vocabulary;

            try {
                // mavjud create funksiyasidan foydalanamiz
                savedWord = await this.create(dto);
            } catch (error) {
                if (error instanceof HttpException) {
                    throw error;
                }

                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new InternalServerErrorException(
                    `Failed to import word "${w.english}": ${message}`,
                );
            }

            // agar lessonId berilgan bo‘lsa, Many-to-Many bog‘lash
            if (lesson) {
                const alreadyAttached = lesson.vocabulary.some(
                    (existingWord) => existingWord.id === savedWord.id,
                );

                if (!alreadyAttached) {
                    lesson.vocabulary.push(savedWord);

                    try {
                        await this.lessonRepository.save(lesson);
                    } catch (error) {
                        if (error instanceof HttpException) {
                            throw error;
                        }

                        const message = error instanceof Error ? error.message : 'Unknown error';
                        throw new InternalServerErrorException(
                            `Failed to attach word "${w.english}" to lesson ${lesson.id}: ${message}`,
                        );
                    }
                }
            }

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
    async findVocabularyPairs() {
        return this.vocabularyRepository
            .createQueryBuilder('v')
            .innerJoin(VocabularyRelations, 'vr', 'vr.vocabulary_id = v.id')
            .innerJoin('vr.translation', 't')
            .select([
                'vr.id AS id',
                'v.id AS vocabulary_id',
                'v.word AS vocabulary_word',
                't.id AS translation_id',
                't.word AS translation_word'
            ])
            .orderBy('v.id', 'ASC')
            .getRawMany();
    }

    async generateVocabularyQuiz() {
        const pairs = await this.findVocabularyPairs();

        const questions = pairs.map(pair => {
            // Vocabulary uchun barcha tarjimalarni topamiz
            const translationsForWord = pairs
                .filter(p => p.vocabulary_id === pair.vocabulary_id)
                .map(p => p.translation_word);

            // To‘g‘ri javob sifatida random bitta tarjima tanlaymiz
            const correct = translationsForWord[Math.floor(Math.random() * translationsForWord.length)];

            // Boshqa so‘zlardan noto‘g‘ri variantlar
            const otherTranslations = pairs
                .filter(p => p.vocabulary_id !== pair.vocabulary_id)
                .map(p => p.translation_word);

            const wrongOptions = otherTranslations
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);

            const options = [correct, ...wrongOptions].sort(() => 0.5 - Math.random());
            const vocabulary_relation_id = pair.id
            return {
                vocabulary_relation_id,
                question: `"${pair.vocabulary_word}" so‘zining tarjimasi qaysi?`,
                options,
                correct,
                lang: 'en'
            };
        });

        return questions;
    }

    async findByLessonId(lessonId: string): Promise<Vocabulary[]> {
        const lesson = await this.lessonRepository.findOne({
            where: { id: lessonId },
            relations: ['vocabulary'],
        });

        if (!lesson) {
            throw new NotFoundException(`Lesson with id ${lessonId} not found`);
        }

        return lesson.vocabulary;
    }

}
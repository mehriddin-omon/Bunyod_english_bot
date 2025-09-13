import { Injectable } from '@nestjs/common';
import gTTS from 'gtts';
import fs from 'fs';
import path from 'path';

@Injectable()
export class WordlistService {
    constructor() { }


    async generateVoice(word: string, outputDir: string) {
        const tts = new gTTS(word, 'en'); // 'en' — inglizcha
        const filePath = path.join(outputDir, `${word}.mp3`);

        return new Promise<void>((resolve, reject) => {
            tts.save(filePath, (err) => {
                if (err) return reject(err);
                console.log(`✅ Voice saved: ${filePath}`);
                resolve();
            });
        });
    }

    async parseWordListText(text: string) {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

        const categoryLine = lines.find((l) => l.toLowerCase().startsWith('category:'));
        const category = categoryLine?.split(':')[1]?.trim() ?? 'Unknown';

        const wordLines = lines.filter((l) => l.startsWith('•'));

        const words = wordLines
            .map((line) => {
                const match = line.match(/•\s*(.+?)\s*\/(.+?)\/\s*–\s*(.+)/);
                if (!match) return null;

                const [, english, transcription, uzbek] = match;
                return {
                    english: english.trim(),
                    transcription: transcription.trim(),
                    uzbek: uzbek.trim(),
                };
            })
            .filter((w): w is { english: string; transcription: string; uzbek: string } => w !== null); // ✅ Type narrowing

        return { category, words };
    }

    async sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

import { Injectable } from '@nestjs/common';
import gTTS from 'gtts';
import fs from 'fs';
import path from 'path';

@Injectable()
export class WordlistService {
    constructor() { }


    async generateVoice(word: string, outputDir: string) {
        // this.sleep(1000);
        const tts = new gTTS(word, 'en'); // 'en' — inglizcha
        const filePath = path.join(outputDir, `${word}.mp3`);

        return new Promise<void>((resolve, reject) => {
            tts.save(filePath, (err) => {
                // if (err) return reject(err);
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
                // Format: • word /transcription/ – translation
                const fullMatch = line.match(/•\s*(.+?)\s*\/(.+?)\/\s*–\s*(.+)/);
                if (fullMatch) {
                    const [, english, transcription, uzbek] = fullMatch;
                    return {
                        english: english.trim(),
                        transcription: transcription.trim(),
                        uzbek: uzbek.trim(),
                    };
                }

                // Format: • word – translation (no transcription)
                const simpleMatch = line.match(/•\s*(.+?)\s*–\s*(.+)/);
                if (simpleMatch) {
                    const [, english, uzbek] = simpleMatch;
                    return {
                        english: english.trim(),
                        transcription: '', // yoki null
                        uzbek: uzbek.trim(),
                    };
                }
                return null;
            }).filter((w): w is { english: string; transcription: string; uzbek: string } => w !== null); // ✅ Type narrowing

        return { category, words };
    }

    async sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

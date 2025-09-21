import { Injectable } from "@nestjs/common";

export type TestQuestion = {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  answer: string;
};

@Injectable()
export class TestsService {
  async parseTestToJson(raw: string): Promise<TestQuestion[]> {
    const lines = raw.trim().split('\n').map(line => line.trim()).filter(Boolean);
    const questions: TestQuestion[] = [];

    for (let i = 0; i < lines.length; i += 6) {
      const questionLine = lines[i];
      const optionA = lines[i + 1];
      const optionB = lines[i + 2];
      const optionC = lines[i + 3];
      const optionD = lines[i + 4];
      const answerLine = lines[i + 5];

      const questionMatch = questionLine.match(/^\d+\.(.+)$/);
      const answerMatch = answerLine.match(/^\s*Answer\s*:\s*([ABCD])\s*$/i);

      if (!questionMatch || !answerMatch) continue;

      questions.push({
        question: questionMatch[1].trim(),
        options: {
          A: optionA.replace(/^A\)\s*/, '').trim(),
          B: optionB.replace(/^B\)\s*/, '').trim(),
          C: optionC.replace(/^C\)\s*/, '').trim(),
          D: optionD.replace(/^D\)\s*/, '').trim(),
        },
        answer: answerMatch[1].toUpperCase(),
      });
    }

    return questions;
  }
}
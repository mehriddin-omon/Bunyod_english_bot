import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './entity/lesson.entity';
import { Listening } from '../listening';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Listening)
    private readonly listeningRepo: Repository<Listening>
  ) {}

  /**
   * Yangi dars yaratish
   */
  async saveFullLesson(data: any): Promise<Lesson> {
  // 1. Lesson yaratish
  const lesson = this.lessonRepo.create({
    lesson_name: data.lesson_name?.content ?? 'Nomlanmagan dars',
  });
  const savedLesson = await this.lessonRepo.save(lesson);

  const lessonId = savedLesson.id;

  // 2. Listening fayllarni saqlash
  if (Array.isArray(data.listening)) {
    for (const item of data.listening) {
      await this.listeningRepo.save({
        lesson: { id: lessonId },
        fileId: item.fileId,
        message_id: item.channelMessageId.toString(),
        title: 'Audio',
        order_index: Date.now(),
      });
    }
  }

  // 3. Reading fayllarni saqlash
  // if (Array.isArray(data.reading)) {
  //   for (const item of data.reading) {
  //     await this.readingRepo.save({
  //       lesson: { id: lessonId },
  //       url: item.url,
  //       title: item.title ?? 'Reading',
  //       order_index: Date.now(),
  //     });
  //   }
  // }

  // 4. Test va WordList ham xuddi shu tarzda
  // ...

  return savedLesson;
}


  /**
   * Barcha darslarni olish
   */
  async getAllLessons(): Promise<Lesson[]> {
    return this.lessonRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Darsni ID bo‘yicha olish (resourcelarsiz)
   */
  async getLessonById(id: string): Promise<Lesson | null> {
    return this.lessonRepo.findOne({ where: { id } });
  }

  /**
   * Darsni barcha bo‘limlari bilan olish
   */
  async getLessonWithRelations(id: string): Promise<Lesson | null> {
    return this.lessonRepo.findOne({
      where: { id },
      relations: ['listening', 'readings', 'tests', 'wordList'],
    });
  }

  /**
   * Darsni o‘chirish
   */
  async deleteLessonById(id: string): Promise<boolean> {
    try {
      const result = await this.lessonRepo.delete(id);
      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      console.error("❌ Darsni o‘chirishda xatolik:", error);
      return false;
    }
  }
}
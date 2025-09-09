import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './entity/lesson.entity';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
  ) { }

  /**
   * Yangi dars yaratish
   */
  async createLesson(lesson_name: string): Promise<Lesson> {
    const lesson = this.lessonRepo.create({ lesson_name });
    return this.lessonRepo.save(lesson);
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
   * Darsni barcha resurslari bilan olish (agar kerak bo‘lsa)
   * Eslatma: relations faqat kerakli bo‘lsa qo‘shiladi
   */
  async getLessonWithRelations(id: string): Promise<Lesson | null> {
    return this.lessonRepo.findOne({
      where: { id },
      relations: ['listening', 'reading', 'test', 'word_list'],
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
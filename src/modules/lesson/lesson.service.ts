import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './entity/lesson.entity';
import { Listening } from '../listening';
import { LessonStatus } from 'src/common/utils/enum';
import { Message } from 'telegraf/types';
import { Reading } from '../reading';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Listening)
    private readonly listeningRepo: Repository<Listening>,

    @InjectRepository(Reading)
    private readonly readingRepo: Repository<Reading>,

  ) { }

  extractMediaData(message: Message, sentMessageId: number) {
    if ('audio' in message && message.audio) {
      return {
        type: 'audio',
        fileId: message.audio.file_id,
        title: message.audio.title,
        channelMessageId: sentMessageId,
      };
    }
    if ('voice' in message && message.voice) {
      return {
        type: 'voice',
        fileId: message.voice.file_id,
        channelMessageId: sentMessageId,
      };
    }
    if ('video' in message && message.video) {
      return {
        type: 'video',
        fileId: message.video.file_id,
        channelMessageId: sentMessageId,
        caption: message.caption,
      };
    }
    if ('document' in message && message.document) {
      return {
        type: 'document',
        fileId: message.document.file_id,
        fileName: message.document.file_name,
        channelMessageId: sentMessageId,
        caption: message.caption,
      };
    }
    if ('photo' in message && Array.isArray(message.photo) && message.photo.length) {
      // Eng katta o'lchamdagi rasmni olish
      const largestPhoto = message.photo[message.photo.length - 1];
      return {
        type: 'photo',
        fileId: largestPhoto.file_id,
        channelMessageId: sentMessageId,
        caption: message.caption,
      };
    }
    if ('text' in message && typeof message.text === 'string') {
      return {
        type: 'text',
        text: message.text,
        channelMessageId: sentMessageId,
      };
    }
    return { type: 'unknown' };
  }

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
    
    if (Array.isArray(data.reading)) {
      for (const item of data.reading) {
        await this.readingRepo.save({
          lesson: { id: lessonId },
          message_id: item.channelMessageId.toString(),
          title: item.title ?? 'Reading',
          order_index: Date.now(),
        });
      }
    }

    // 4. Test va WordList ham xuddi shu tarzda
    // ...

    return savedLesson;
  }


  /**
   * Barcha darslarni olish
   */
  async getAllLessons(): Promise<Lesson[]> {
    return this.lessonRepo.find({
      where: { status: LessonStatus.draft },    //  Faqat published darslar
      order: { created_at: 'ASC' },      //  'ASC' — "ascending" (o‘sish) tartib, ya'ni eng eski darslar ro‘yxat boshida bo‘ladi.
      // order: { created_at: 'DESC' },  //  'DESC' — "descending" (kamayish) tartib, ya'ni eng yangi darslar ro‘yxat boshida bo‘ladi.
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
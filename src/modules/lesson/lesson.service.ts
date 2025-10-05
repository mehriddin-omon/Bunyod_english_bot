import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from 'telegraf/types';
import { LessonField, LessonFileType, LessonStatus, Lesson, Vocabulary, Listening, Reading } from 'src/common';
import { UserService } from '../user/user.service';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Listening)
    private readonly listeningRepo: Repository<Listening>,

    @InjectRepository(Reading)
    private readonly readingRepo: Repository<Reading>,

    @InjectRepository(Vocabulary)
    private readonly VocabularyRepo: Repository<Vocabulary>,

    private readonly userService: UserService,

  ) { }

  extractMediaData(message: Message, forwardedMessageId: number): LessonField {
    let type: LessonFileType = 'unknown';
    let fileId: string | undefined;
    let fileName: string | undefined;

    if ('audio' in message && message.audio) {
      type = 'audio';
      fileId = message.audio.file_id;
      fileName = message.audio.file_name;
    } else if ('voice' in message && message.voice) {
      type = 'voice';
      fileId = message.voice.file_id;
    } else if ('video' in message && message.video) {
      type = 'video';
      fileId = message.video.file_id;
    } else if ('document' in message && message.document) {
      type = 'document';
      fileId = message.document.file_id;
      fileName = message.document.file_name;
    } else if ('photo' in message && message.photo?.length) {
      type = 'photo';
      fileId = message.photo[message.photo.length - 1].file_id;
    }

    return {
      type,
      fileId,
      fileName,
      channelMessageId: forwardedMessageId,
    };
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

    // 4.word_list fayllarini saqlash 

    if (Array.isArray(data.word_list)) {
      for (const item of data.word_list) {
        await this.VocabularyRepo.save({
          lesson: { id: lessonId },
          english: item.english,
          uzbek: item.uzbek,
          transcription: item.transcription ?? null,
          voice_file_id: item.voice_file_id ?? null,
          message_id: item.message_id,
          order_index: item.order_index,
          category: item.category ?? null,
        });
      }
    }

    // 5. Test fayllarini saqlash
    // ...

    return savedLesson;
  }


  /**
   * Barcha darslarni olish
   */
  async getAllLessons(userId: number): Promise<Lesson[]> {
    const role = await this.userService.getRole(userId);
    if (role === 'admin' || role === 'teacher') {
      return this.lessonRepo.find({
        order: { created_at: 'ASC' },      //  'ASC' — "ascending" (o‘sish) tartib, ya'ni eng eski darslar ro‘yxat boshida bo‘ladi.
      });
    }

    return this.lessonRepo.find({
      where: { status: LessonStatus.published },    //  Faqat published darslar
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

  // Dars statusini o‘zgartirish
  async updateLessonStatus(id: string, status: LessonStatus): Promise<boolean> {
    try {
      const lesson = await this.lessonRepo.findOne({ where: { id } });
      if (!lesson) return false;

      lesson.status = status;
      await this.lessonRepo.save(lesson);
      return true;
    } catch (error) {
      console.error("❌ Dars statusini o‘zgartirishda xatolik:", error);
      return false;
    }
  }

  async updateLessonName(id: string, newName: string): Promise<boolean> {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) return false;
    lesson.lesson_name = newName;
    await this.lessonRepo.save(lesson);
    return true;
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
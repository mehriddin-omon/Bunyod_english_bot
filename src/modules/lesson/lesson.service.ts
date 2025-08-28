import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Lesson } from '../entitys/lesson.entity';
import { LessonResource } from '../entitys/lesson-resource.entity';
import { ResourceType } from 'src/common/utils/enum';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    @InjectRepository(LessonResource)
    private resourceRepo: Repository<LessonResource>,
  ) {}

  async createLesson(title: string): Promise<Lesson> {
    const lesson = this.lessonRepo.create({ title });
    return this.lessonRepo.save(lesson);
  }

  async addLessonFile(data: {
    lessonId: number;
    channelId: number;
    messageId: number;
    fileType: ResourceType;
  }): Promise<LessonResource> {
    const lesson = await this.lessonRepo.findOneBy({ id: data.lessonId });
    if (!lesson) throw new Error('Lesson not found');

    const resource = this.resourceRepo.create({
      lesson,
      type: data.fileType,
      channelId: data.channelId,
      messageId: data.messageId
    });
    
    return this.resourceRepo.save(resource);
  }

  async getAllLessons(): Promise<Lesson[]> {
    return this.lessonRepo.find({
      order: { id: 'DESC' } // eng yangi darslar birinchi
    });
  }

  async getLessonWithResources(lessonId: number): Promise<Lesson | null> {
    return this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: ['resources']
    });
  }

  async getResourceByLessonId(lessonId: number, type: ResourceType): Promise<LessonResource | null> {
    return this.resourceRepo.findOne({
      where: { lesson: { id: lessonId }, type },
      relations: ['lesson']
    });
  }

  async deleteLessonById(lessonId: number): Promise<boolean> {
    try {
      const result = await this.lessonRepo.delete(lessonId);
      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      console.error('Darsni o\'chirishda xatolik:', error);
      return false;
    }
  }
}
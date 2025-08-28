import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Lesson } from './lesson.entity';
import { ResourceType } from 'src/common/utils/enum';

@Entity({ name: 'lesson_resources' })
export class LessonResource {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Lesson, lesson => lesson.resources)
  lesson: Lesson;

  @Column({ type: 'enum', enum: ResourceType })
  type: ResourceType; // reading, listening va h.k.

  @Column({ type: 'bigint' })
  channelId: number; // private kanal ID

  @Column({ type: 'bigint' })
  messageId: number; // Telegram message_id
}

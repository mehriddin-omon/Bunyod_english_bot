import { BaseEntity } from "src/common/core/entitys/base.entity";
import { Lesson } from "src/modules/lesson";
import { Column, Entity, ManyToOne } from "typeorm";

@Entity("vocabulary")
export class Vocabulary extends BaseEntity {
  @Column()
  english: string;

  @Column()
  uzbek: string;
  
  @Column({ nullable: true })
  category: string;

  @Column({ type: "bigint" })
  message_id: string;

  @Column({ nullable: true })
  voice_file_id: string;

  @Column({ nullable: true })
  transcription: string;

  @Column({ nullable: true })
  example: string;

  @Column({ type: "bigint" })
  order_index: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.vocabulary, { onDelete: "CASCADE" })
  lesson: Lesson;
}
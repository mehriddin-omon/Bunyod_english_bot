import { BaseEntity } from "src/common/core/baseEntity";
import { Lesson } from "src/modules/lesson";
import { Column, Entity, ManyToOne } from "typeorm";

@Entity("word_list")
export class WordList extends BaseEntity {
  @Column()
  english: string;

  @Column()
  uzbek: string;

  @Column()
  message_id: string;

  @Column({ type: "bigint" })
  order_index: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.word_list)
  lesson: Lesson;
}
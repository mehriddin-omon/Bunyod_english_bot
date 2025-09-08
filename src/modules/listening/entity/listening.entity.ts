import { BaseEntity } from "src/common/core/baseEntity";
import { Lesson } from "src/modules/lesson";
import { Column, Entity, ManyToOne } from "typeorm";

@Entity("listening")
export class Listening extends BaseEntity {
  @Column()
  title: string;

  @Column()
  message_id: string;

  @Column({ type: "bigint" })
  order_index: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.listening)
  lesson: Lesson;
}
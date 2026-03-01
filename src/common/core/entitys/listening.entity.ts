import { BaseEntity } from "src/common/core/entitys/base.entity";
import { Column, Entity, ManyToOne } from "typeorm";
import { Lesson } from "./lesson.entity";

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
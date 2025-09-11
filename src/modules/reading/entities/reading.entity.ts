import { BaseEntity } from "src/common/core/baseEntity";
import { Lesson } from "src/modules/lesson";
import { Column, Entity, ManyToOne } from "typeorm";

@Entity("reading")
export class Reading extends BaseEntity {
  @Column()
  title: string;

  @Column()
  message_id: string;

  @Column({ type: "bigint" })
  order_index: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.reading)
  lesson: Lesson;
}
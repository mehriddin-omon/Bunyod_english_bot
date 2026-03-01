import { BaseEntity } from "src/common/core/entitys/base.entity";
import { Lesson } from "./lesson.entity";
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
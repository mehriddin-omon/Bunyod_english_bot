import { BaseEntity } from "src/common/core/baseEntity";
import { Lesson } from "src/modules/lesson";
import { Column, Entity, ManyToOne } from "typeorm";

@Entity("test")
export class Test extends BaseEntity {
  @Column()
  question: string;

  @Column()
  message_id: string;

  @Column({ type: "bigint" })
  order_index: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.tests)
  lesson: Lesson;
}
import { BaseEntity } from "src/common/core/entitys/base.entity";
import { Lesson } from "./lesson.entity";
import { Column, Entity, JoinTable, ManyToMany } from "typeorm";

@Entity("vocabularys")
export class Vocabulary extends BaseEntity {

  @Column({ type: 'varchar', name: 'word' })
  word: string;

  @Column({ nullable: true, name: 'lang' })
  lang: string;

  // @Column({ type: "bigint" })
  // message_id: string;

  @Column({ nullable: true })
  voice_file_id: string;

  @Column({ nullable: true })
  transcription: string;

  @Column({ nullable: true })
  example: string;

  @Column({ type: "bigint" })
  order_index: number;
  
  @ManyToMany(() => Vocabulary)
  @JoinTable({
    name: "vocabulary_relations",
    joinColumn: {
      name: "vocabulary_id",
      referencedColumnName: 'id'
    },
    inverseJoinColumn: {
      name: 'translation_id',
      referencedColumnName: 'id'
    }
  })
  translations: Vocabulary[];

  @ManyToMany(() => Lesson, (lesson) => lesson.vocabulary, { onDelete: "CASCADE" })
  lesson: Lesson[];
  
}
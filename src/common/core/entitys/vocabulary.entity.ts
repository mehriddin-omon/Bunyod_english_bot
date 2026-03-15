import { BaseEntity } from "src/common/core/entitys/base.entity";
import { Lesson } from "./lesson.entity";
import { Column, Entity, JoinColumn, ManyToMany, ManyToOne } from "typeorm";

@Entity("vocabularys")
class Vocabulary extends BaseEntity {

  @Column({ type: 'varchar', name: 'word' })
  word: string;

  @Column({ nullable: true, name: 'lang' })
  lang: string;

  @Column({ nullable: true })
  voice_file_id: string;

  @Column({ nullable: true })
  example: string;

  @Column({ type: "bigint", default: 0 })
  order_index: number;

  @ManyToMany(() => Lesson, (lesson) => lesson.vocabulary, { onDelete: "CASCADE" })
  lesson: Lesson[];

}

@Entity("vocabulary_relations")
class VocabularyRelations extends BaseEntity {

  @ManyToOne(() => Vocabulary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "vocabulary_id" })
  vocabulary: Vocabulary;

  @ManyToOne(() => Vocabulary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "translation_id" })
  translation: Vocabulary;

  @Column({ type: "float", default: 0 })
  difficulty: number;
}


export { Vocabulary, VocabularyRelations };
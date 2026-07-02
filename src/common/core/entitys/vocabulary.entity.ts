import { Column, Entity, ManyToMany, ManyToOne, JoinTable, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PartOfSpeech } from 'src/common/utils/enum';
import { Lesson } from './lesson.entity';

@Entity({ name: 'vocabularys' })
export class Vocabulary extends BaseEntity {
  @Column({ type: 'varchar', name: 'word' })
  word: string;

  @Column({ type: 'varchar', name: 'lang', default: 'en' })
  lang: string;

  @Column({ type: 'varchar', name: 'ipa', nullable: true })
  ipa: string | null;

  @Column({ type: 'varchar', name: 'pos', enum: PartOfSpeech, nullable: true })
  pos: PartOfSpeech | null;

  @Column({ type: 'uuid', name: 'lesson_id', nullable: true })
  lessonId: string | null;

  @ManyToOne(() => Lesson, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson | null;

  @Column({ type: 'varchar', name: 'voice_file_id', nullable: true })
  voiceFileId: string | null;

  @Column({ type: 'varchar', name: 'image_url', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'bigint', name: 'order_index', default: 0 })
  orderIndex: number;

  @ManyToMany(() => Vocabulary)
  @JoinTable({
    name: 'vocabulary_synonyms',
    joinColumn: { name: 'vocabulary_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'synonym_id', referencedColumnName: 'id' },
  })
  synonyms: Vocabulary[];

  @ManyToMany(() => Vocabulary)
  @JoinTable({
    name: 'vocabulary_antonyms',
    joinColumn: { name: 'vocabulary_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'antonym_id', referencedColumnName: 'id' },
  })
  antonyms: Vocabulary[];
}

import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonVocab } from './teacher-lesson-vocab.entity';

@Entity({ name: 'lesson_vocab_words' })
export class LessonVocabWord extends BaseEntity {
  @Column({ type: 'uuid', name: 'vocab_id' })
  vocabId: string;

  @ManyToOne(() => LessonVocab, (v) => v.words, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vocab_id' })
  vocab: LessonVocab;

  @Column({ type: 'varchar', name: 'word' })
  word: string;

  @Column({ type: 'varchar', name: 'translation' })
  translation: string;

  @Column({ type: 'varchar', name: 'ipa', nullable: true })
  ipa: string | null;

  @Column({ type: 'varchar', name: 'part_of_speech', nullable: true })
  partOfSpeech: string | null;

  @Column({ type: 'varchar', name: 'topic', nullable: true })
  topic: string | null;

  @Column({ type: 'text', name: 'example_en', nullable: true })
  exampleEn: string | null;

  @Column({ type: 'text', name: 'example_uz', nullable: true })
  exampleUz: string | null;

  @Column({ type: 'int', name: 'order', default: 0 })
  order: number;
}

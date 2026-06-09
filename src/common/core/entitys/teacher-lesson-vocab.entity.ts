import { Column, Entity, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { LessonBlock } from './teacher-lesson-block.entity';
import { LessonVocabWord } from './teacher-lesson-vocab-word.entity';

@Entity({ name: 'lesson_vocabs' })
export class LessonVocab extends BaseEntity {
  @Column({ type: 'uuid', name: 'block_id', unique: true })
  blockId: string;

  @OneToOne(() => LessonBlock, (b) => b.vocabBlock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' })
  block: LessonBlock;

  @Column({ type: 'simple-array', name: 'exercise_types', default: 'variantli_test,yozib_yodlash,audio' })
  exerciseTypes: string[];

  @OneToMany(() => LessonVocabWord, (w) => w.vocab, { cascade: true })
  words: LessonVocabWord[];
}

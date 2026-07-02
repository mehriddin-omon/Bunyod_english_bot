import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Vocabulary } from './vocabulary.entity';

@Entity({ name: 'vocabulary_relations' })
export class VocabularyRelation extends BaseEntity {
  @Column({ type: 'uuid', name: 'vocabulary_id' })
  vocabularyId: string;

  @ManyToOne(() => Vocabulary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vocabulary_id' })
  vocabulary: Vocabulary;

  @Column({ type: 'uuid', name: 'translation_id' })
  translationId: string;

  @ManyToOne(() => Vocabulary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'translation_id' })
  translation: Vocabulary;

  @Column({ type: 'bigint', name: 'attempts', default: 0, transformer: { from: Number, to: (v) => v } })
  attempts: number;

  @Column({ type: 'bigint', name: 'wrong_attempts', default: 0, transformer: { from: Number, to: (v) => v } })
  wrongAttempts: number;

  @Column({ type: 'float', name: 'difficulty', default: 0 })
  difficulty: number;
}

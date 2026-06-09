import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PartOfSpeech, CefrLevel, VocabStatus } from 'src/common/utils/enum';
import { User } from './user.entity';
import { Unit } from './unit.entity';

@Entity('vocabulary_words')
export class VocabularyWord extends BaseEntity {
  @Column({ type: 'varchar', name: 'word' })
  word: string;

  @Column({ type: 'varchar', name: 'translation' })
  translation: string;

  @Column({ type: 'text', name: 'example', nullable: true })
  example: string;

  @Column({ type: 'varchar', name: 'cefr_level', enum: CefrLevel, nullable: true })
  cefrLevel: CefrLevel;

  @Column({ type: 'varchar', name: 'pos', enum: PartOfSpeech, nullable: true })
  pos: PartOfSpeech;

  @Column({ type: 'simple-array', name: 'synonyms', nullable: true })
  synonyms: string[];

  @Column({ type: 'simple-array', name: 'antonyms', nullable: true })
  antonyms: string[];

  @Column({ type: 'uuid', name: 'unit_id', nullable: true })
  unitId: string;

  @ManyToOne(() => Unit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;
}

@Entity('vocabulary_reviews')
export class VocabularyReview extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'word_id' })
  wordId: string;

  @ManyToOne(() => VocabularyWord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word_id' })
  word: VocabularyWord;

  @Column({ type: 'varchar', name: 'status', enum: VocabStatus, default: VocabStatus.new })
  status: VocabStatus;

  @Column({ type: 'int', name: 'repetitions', default: 0 })
  repetitions: number;

  @Column({ type: 'float', name: 'ease_factor', default: 2.5 })
  easeFactor: number;

  @Column({ type: 'int', name: 'interval', default: 1 })
  interval: number;

  @Column({ type: 'timestamptz', name: 'next_review_at', nullable: true })
  nextReviewAt: Date;

  @Column({ type: 'timestamptz', name: 'last_review_at', nullable: true })
  lastReviewAt: Date;
}

import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { VocabularyRelation } from './vocabulary-relation.entity';

@Entity({ name: 'vocabulary_examples' })
export class VocabularyExample extends BaseEntity {
  @Column({ type: 'uuid', name: 'pair_id' })
  pairId: string;

  @ManyToOne(() => VocabularyRelation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: VocabularyRelation;

  @Column({ type: 'text', name: 'english_text' })
  englishText: string;

  @Column({ type: 'text', name: 'uzbek_text', nullable: true })
  uzbekText: string | null;

  @Column({ type: 'varchar', name: 'highlight_word', nullable: true })
  highlightWord: string | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;
}

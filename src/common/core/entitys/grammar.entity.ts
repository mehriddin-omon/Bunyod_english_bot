import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'grammars' })
export class Grammar extends BaseEntity {
  @Column({ type: 'varchar', name: 'heading' })
  heading: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'text', name: 'formula', nullable: true })
  formula: string | null;

  @Column({ type: 'jsonb', name: 'examples', default: [] })
  examples: { en: string; uz: string }[];

  @Column({ type: 'jsonb', name: 'rules', nullable: true })
  rules: any;

  @Column({ type: 'text', name: 'tip', nullable: true })
  tip: string | null;

  @Column({ type: 'simple-array', name: 'related_words', nullable: true })
  relatedWords: string[] | null;

  @Column({ type: 'varchar', name: 'cefr_level', nullable: true })
  cefrLevel: string | null;
}

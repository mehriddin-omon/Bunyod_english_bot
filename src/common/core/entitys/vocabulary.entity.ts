import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PartOfSpeech, CefrLevel } from 'src/common/utils/enum';

@Entity({ name: 'vocabularys' })
export class Vocabulary extends BaseEntity {
  @Column({ type: 'varchar', name: 'word' })
  word: string;

  @Column({ type: 'varchar', name: 'ipa', nullable: true })
  ipa: string | null;

  @Column({ type: 'varchar', name: 'pos', enum: PartOfSpeech, nullable: true })
  pos: PartOfSpeech | null;

  @Column({ type: 'text', name: 'uzbek_translation', nullable: true })
  uzbekTranslation: string | null;

  @Column({ type: 'varchar', name: 'topic', nullable: true })
  topic: string | null;

  @Column({ type: 'varchar', name: 'cefr_level', enum: CefrLevel, nullable: true })
  cefrLevel: CefrLevel | null;

  @Column({ type: 'varchar', name: 'lang', default: 'en' })
  lang: string;

  @Column({ type: 'varchar', name: 'voice_file_id', nullable: true })
  voiceFileId: string | null;

  @Column({ type: 'varchar', name: 'image_url', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'text', name: 'example', nullable: true })
  example: string | null;

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

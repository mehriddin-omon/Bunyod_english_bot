import { Column, Entity, ManyToOne, JoinColumn, Index, PrimaryGeneratedColumn } from 'typeorm';
import { VocabularySession } from './vocabulary-session.entity';
import { VocabularyRelation } from './vocabulary-relation.entity';

export type PracticeMode = 'flashcard' | 'multiple_choice' | 'typing' | 'audio';

const MODE_TO_CODE: Record<PracticeMode, number> = {
  flashcard: 0, multiple_choice: 1, typing: 2, audio: 3,
};
const CODE_TO_MODE: Record<number, PracticeMode> = {
  0: 'flashcard', 1: 'multiple_choice', 2: 'typing', 3: 'audio',
};

@Entity({ name: 'vocabulary_practice_logs' })
@Index(['sessionId'])
export class VocabularyPracticeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId: string | null;

  @ManyToOne(() => VocabularySession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: VocabularySession | null;

  @Column({ type: 'uuid', name: 'pair_id' })
  pairId: string;

  @ManyToOne(() => VocabularyRelation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: VocabularyRelation;

  @Column({
    type: 'smallint',
    name: 'mode',
    transformer: { to: (v: PracticeMode) => MODE_TO_CODE[v] ?? 0, from: (v: number) => CODE_TO_MODE[v] ?? 'flashcard' },
  })
  mode: PracticeMode;

  @Column({ type: 'boolean', name: 'correct' })
  correct: boolean;
}

import { Column, Entity, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ExerciseItem } from './exercise-item.entity';
import { QuizExerciseType, StudentAnswerBlockType } from '../../utils/enum';

/**
 * Yagona universal mashq jadvali: quiz, reading, listening, grammar
 * bloklarining BARCHASI shu yerda saqlanadi. Blok bog'lanishi
 * owner_block_type + owner_block_id orqali (alohida jadval OCHILMAYDI).
 * Qarang: bunyod/backend/quiz.md 3.1
 */
@Entity({ name: 'exercises' })
@Index(['ownerBlockType', 'ownerBlockId'])
@Index(['lessonId'])
export class Exercise extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @Column({
    type: 'enum',
    enum: StudentAnswerBlockType,
    enumName: 'student_answer_block_type_enum',
    name: 'owner_block_type',
  })
  ownerBlockType: StudentAnswerBlockType;

  /** quiz_contents.id / reading_contents.id / listening_contents.id / grammar_contents.id (polimorf, FK yo'q) */
  @Column({ type: 'uuid', name: 'owner_block_id' })
  ownerBlockId: string;

  @Column({
    type: 'enum',
    enum: QuizExerciseType,
    enumName: 'quiz_exercise_type_enum',
    name: 'exercise_type',
  })
  exerciseType: QuizExerciseType;

  @Column({ type: 'varchar', name: 'title', nullable: true })
  title: string | null;

  @Column({ type: 'text', name: 'instructions', nullable: true })
  instructions: string | null;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @OneToMany(() => ExerciseItem, (i) => i.exercise, { cascade: true })
  items: ExerciseItem[];
}

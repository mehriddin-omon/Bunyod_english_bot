import { Column, Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './lesson.entity';
import { QuizExercise } from './quiz-exercise.entity';

@Entity({ name: 'quiz_contents' })
export class QuizContent extends BaseEntity {
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ type: 'varchar', name: 'title', default: 'Quiz' })
  title: string;

  @Column({ type: 'int', name: 'order_index', default: 0 })
  orderIndex: number;

  @OneToMany(() => QuizExercise, (e) => e.quiz, { cascade: true })
  exercises: QuizExercise[];
}

import { Entity, Column, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from 'src/common/core/entitys/base.entity';
import { LessonStatus } from 'src/common/utils/enum';
import { Listening } from './listening.entity';
import { Reading } from './reading.entity';
import { Vocabulary } from './vocabulary.entity';
import { Test } from './test.entity';

@Entity({ name: 'lessons' })
export class Lesson extends BaseEntity {
  
  @Column({
    type: 'varchar',
    name: 'lesson_name'
  })
  lesson_name: string;

  @Column({
    type: 'varchar',
    name: 'status',
    enum: LessonStatus,
    default: LessonStatus.draft
  })
  status: LessonStatus;

  @ManyToMany(() => Vocabulary, (vocabulary) => vocabulary.lesson)
  @JoinTable({
    name: "lesson_vocabulary",
    joinColumn: { name: "lesson_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "vocabulary_id", referencedColumnName: "id" },
  })
  vocabulary: Vocabulary[];
  
  @OneToMany(() => Listening, (listening) => listening.lesson)
  listening: Listening[];

  @OneToMany(() => Reading, (reading) => reading.lesson)
  reading: Reading[];

  @OneToMany(() => Test, (test) => test.lesson)
  test: Test[];
}

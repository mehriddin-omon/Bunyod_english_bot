import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/core/entitys/base.entity';
import { LessonStatus } from 'src/common/utils/enum';
import { Listening } from 'src/modules/listening';
import { Reading } from 'src/modules/reading';
import { Test } from 'src/modules/tests';
import { Vocabulary } from './vocabulary.entity';

@Entity({ name: 'lessons' })
export class Lesson extends BaseEntity {
  @Column({
    name: 'lesson_name',
    nullable: false,
  })
  lesson_name: string;

  @Column({
    type: 'varchar',
    name: 'status',
    enum: LessonStatus,
    default: LessonStatus.draft
  })
  status: LessonStatus;
 
  @OneToMany(() => Listening, (listening) => listening.lesson)
  listening: Listening[];

  @OneToMany(() => Reading, (reading) => reading.lesson)
  reading: Reading[];

  @OneToMany(() => Vocabulary, (vocabulary) => vocabulary.lesson)
  vocabulary: Vocabulary[];

  @OneToMany(() => Test, (test) => test.lesson)
  test: Test[];
}

import { Entity, Column, OneToMany } from 'typeorm';
import { LessonResource } from '../../entitys/lesson-resource.entity';
import { BaseEntity } from 'src/common/core/baseEntity';
import { LessonStatus } from 'src/common/utils/enum';
import { Listening } from 'src/modules/listening';
import { Reading } from 'src/modules/reading';
import { WordList } from 'src/modules/wordlist';
import { Test } from 'src/modules/tests';

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
  listenings: Listening[];

  @OneToMany(() => Reading, (reading) => reading.lesson)
  readings: Reading[];

  @OneToMany(() => WordList, (word) => word.lesson)
  wordList: WordList[];

  @OneToMany(() => Test, (test) => test.lesson)
  tests: Test[];

}

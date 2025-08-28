import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { LessonResource } from './lesson-resource.entity';

@Entity({ name: 'lessons' })
export class Lesson {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @OneToMany(() => LessonResource, resource => resource.lesson, { cascade: true })
  resources: LessonResource[];
}

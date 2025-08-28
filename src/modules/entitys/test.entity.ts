import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'tests' })
export class Test {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  questions: string; // JSON yoki oddiy text format
}

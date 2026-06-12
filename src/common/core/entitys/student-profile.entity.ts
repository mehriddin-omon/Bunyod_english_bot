import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { CefrLevel } from 'src/common/utils/enum';

@Entity({ name: 'student_profiles' })
export class StudentProfile extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, (u) => u.studentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'date', name: 'birth_date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'text', name: 'address', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', name: 'cefr_level', enum: CefrLevel, nullable: true })
  cefrLevel: CefrLevel | null;

  @Column({ type: 'varchar', name: 'learning_goal', nullable: true })
  learningGoal: string | null;
}

import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity({ name: 'teacher_profiles' })
export class TeacherProfile extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, (u) => u.teacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', name: 'bio', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', name: 'specialization', nullable: true })
  specialization: string | null;

  @Column({ type: 'int', name: 'experience_years', nullable: true })
  experienceYears: number | null;
}

import { Column, Entity, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from 'src/common/utils/enum';
import { UserGamification } from './gamification.entity';
import { LessonProgress } from './lesson-progress.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', name: 'first_name', nullable: true })
  firstName: string;

  @Column({ type: 'varchar', name: 'last_name', nullable: true })
  lastName: string;

  @Column({ type: 'varchar', name: 'username', unique: true })
  username: string;

  @Column({ type: 'varchar', name: 'password' })
  password: string;

  @Column({ type: 'varchar', name: 'phone', nullable: true })
  phone: string;

  @Column({ type: 'varchar', name: 'role', enum: Role, default: Role.student })
  role: Role;

  @Column({ type: 'varchar', name: 'cefr_level', nullable: true })
  cefrLevel: string | null;

  @Column({ type: 'text', name: 'refresh_token', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  created_by: string;

  @OneToOne(() => UserGamification, (g) => g.user)
  gamification: UserGamification;

  @OneToMany(() => LessonProgress, (p) => p.user)
  progress: LessonProgress[];
}

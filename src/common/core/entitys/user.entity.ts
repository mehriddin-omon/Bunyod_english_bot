import { Column, Entity, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from 'src/common/utils/enum';
import { UserGamification } from './gamification.entity';
import { LessonProgress } from './lesson-progress.entity';
import { StudentProfile } from './student-profile.entity';
import { TeacherProfile } from './teacher-profile.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', name: 'username', unique: true })
  username: string;

  @Column({ type: 'varchar', name: 'password' })
  password: string;

  @Column({ type: 'varchar', name: 'first_name', nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', name: 'last_name', nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', name: 'phone_number', nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', name: 'email', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'bigint', name: 'telegram_id', unique: true, nullable: true })
  telegramId: string | null;

  @Column({ type: 'varchar', name: 'telegram_username', nullable: true })
  telegramUsername: string | null;

  @Column({ type: 'varchar', name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', name: 'role', enum: Role, default: Role.student })
  role: Role;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  /**
   * Tizimga kira olish holati. false bo'lsa login qilib bo'lmaydi.
   * O'qituvchi "O'quvchilarim" bo'limidan bloklaydi/ochadi.
   * DIQQAT: bu faollik (oxirgi kirish vaqti) emas — u Nazorat bo'limida.
   */
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Mehmon akkaunt (2026-10): ilovada "Boshlash" bosilganda login/parolsiz
   * avtomatik yaratiladi. Foydalanuvchi "Akkauntni saqlash" orqali login va
   * parol qo'ygach false bo'ladi — progress o'sha akkauntda qoladi.
   */
  @Column({ type: 'boolean', name: 'is_guest', default: false })
  isGuest: boolean;

  @Column({ type: 'text', name: 'refresh_token', nullable: true })
  refreshToken: string | null;

  @OneToOne(() => StudentProfile, (p) => p.user)
  studentProfile: StudentProfile;

  @OneToOne(() => TeacherProfile, (p) => p.user)
  teacherProfile: TeacherProfile;

  @OneToOne(() => UserGamification, (g) => g.user)
  gamification: UserGamification;

  @OneToMany(() => LessonProgress, (p) => p.user)
  progress: LessonProgress[];
}

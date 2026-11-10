import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/**
 * TESTLASH LENTASI HOLATI (2026-11). Bo'lak (10 so'z) bo'yicha 3 pog'onali
 * aylana: navbat, pog'ona, har so'z natijasi. O'quvchi istalgan payt chiqib
 * ketadi — holat shu yerda saqlanadi va qaytganda davom etadi.
 *
 * `scope`:
 *   `L:<lessonId>:<n>`      — darsning n-bo'lagi (1 dan)
 *   `L:<lessonId>:growth`   — darsning «O'sish nuqtalari» (8-bo'lak)
 *   `growth`                — barcha darslar bo'yicha «O'sish nuqtalari»
 *   `saved`                 — saqlangan so'zlar mashqi
 *
 * `state` — ilova yozadigan erkin JSON (navbat, pog'ona, so'z statistikasi);
 * server faqat saqlaydi. So'z holatlari `answers` orqali alohida yangilanadi.
 */
@Entity({ name: 'vocabulary_lenta_states' })
@Index(['userId', 'scope'], { unique: true })
export class VocabularyLentaState extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 80, name: 'scope' })
  scope: string;

  @Column({ type: 'jsonb', name: 'state', default: () => "'{}'" })
  state: Record<string, unknown>;

  /** 3 pog'onaning hammasi tugagan payt; qayta boshlansa null */
  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;
}

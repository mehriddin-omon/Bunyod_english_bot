import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/** Kartadagi misol gap: inglizcha + o'zbekcha tarjima */
export interface PhraseExample {
  en: string;
  uz: string;
}

/**
 * draft     — faqat teacher panelda ko'rinadi
 * published — o'quvchilarga ko'rinadi (`publishAt` kelgandan keyin)
 * archived  — lentadan olib tashlangan (o'chirilmagan)
 */
export type PhraseStatus = 'draft' | 'published' | 'archived';

/**
 * KUN IBORASI (2026-11) — Bosh sahifadagi karusel kartasi.
 *
 * Iborani o'qituvchi teacher panelda kiritadi (matn shart, rasm/GIF va video ixtiyoriy):
 *   - rasm yoki video bo'lmasa — karta sof matn ko'rinishida chiziladi;
 *   - rasm bo'lsa karta tepasida rasm, video bo'lsa pleer qatlami chiqadi.
 *
 * Lenta TESKARI tartibda: eng oxirgi (yangi) ibora 1-kartada turadi —
 * `ORDER BY publish_at DESC, created_at DESC`.
 *
 * Coin berilmaydi va dars balliga kirmaydi: bu motivatsiya bo'limi.
 */
@Entity({ name: 'phrases' })
@Index(['status', 'publishAt'])
export class Phrase extends BaseEntity {
  /** Inglizcha ibora — "Break the ice" */
  @Column({ type: 'varchar', length: 200, name: 'text' })
  text: string;

  /** Talaffuz — "/breɪk ðə aɪs/" */
  @Column({ type: 'varchar', length: 200, name: 'transcription', nullable: true })
  transcription: string | null;

  /** O'zbekcha ma'no */
  @Column({ type: 'varchar', length: 400, name: 'meaning_uz' })
  meaningUz: string;

  /** Misol gaplar (kartada 1-si, to'liq ekranda hammasi) */
  @Column({ type: 'jsonb', name: 'examples', default: () => `'[]'::jsonb` })
  examples: PhraseExample[];

  /** Rasm yoki GIF: /uploads/images/<fayl> — ilovada `CachedImage` bilan keshlanadi */
  @Column({ type: 'varchar', name: 'image_url', nullable: true })
  imageUrl: string | null;

  /** O'qituvchi videosi: /uploads/videos/<fayl> (20–40 s) */
  @Column({ type: 'varchar', name: 'video_url', nullable: true })
  videoUrl: string | null;

  /** Video davomiyligi (sekund) — kartadagi "0:32" yozuvi */
  @Column({ type: 'int', name: 'video_duration_sec', nullable: true })
  videoDurationSec: number | null;

  @Column({ type: 'varchar', length: 16, name: 'status', default: 'draft' })
  status: PhraseStatus;

  /** Qaysi kundan ko'rinadi — "BUGUN / KECHA / 5-noyabr" chipi shundan hisoblanadi */
  @Column({ type: 'timestamptz', name: 'publish_at' })
  publishAt: Date;

  @Column({ type: 'int', name: 'like_count', default: 0 })
  likeCount: number;

  @Column({ type: 'int', name: 'comment_count', default: 0 })
  commentCount: number;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  author: User | null;
}

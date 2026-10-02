import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

/** Sinov holati */
export enum CoinTestStatus {
  in_progress = 'in_progress',
  completed = 'completed',
  /** ✕ bosildi yoki ilova yopildi — urinish sarflangan, qolgan so'zlar xato */
  abandoned = 'abandoned',
}

/**
 * Sinovdagi savol turi. Oddiy flashcard ATAYLAB yo'q — u o'z-o'zini
 * tekshirishga asoslangan (bola "bildim" deb bosaveradi), sinovda esa javob
 * obyektiv tekshirilishi kerak. Qolgan uch tur aralash keladi:
 *   multiple_choice — so'z ko'rsatiladi, tarjima tanlanadi
 *   audio           — talaffuz eshittiriladi, tarjima tanlanadi (so'z yashirin)
 *   typing          — tarjima ko'rsatiladi, inglizcha so'z yoziladi
 */
export type CoinTestCardMode = 'multiple_choice' | 'audio' | 'typing';

/**
 * Sinovdagi bitta so'z (karta). JSON ustunda saqlanadi — sinov 60 tagacha
 * so'zdan iborat, alohida jadval ortiqcha. `translation` ilovaga sinov
 * davomida YUBORILMAYDI — javob serverda tekshiriladi.
 */
export interface CoinTestCard {
  pairId: string;
  word: string;
  ipa: string | null;
  pos: string | null;
  imageUrl: string | null;
  voiceFileId: string | null;
  /** to'g'ri javob — faqat serverda */
  translation: string;
  /** savol turi (serverda belgilanadi — ilova o'zgartira olmaydi) */
  mode: CoinTestCardMode;
  /** 4 ta variant (to'g'risi ham ichida), aralashtirilgan; typing'da bo'sh */
  options: string[];
  /** oldingi urinishda xato bo'lganmi (2-/3-urinish coini shunga qaraydi) */
  prevWrong: boolean;
  /** talaba tanlagan variant; null — vaqt tugadi / javob berilmadi */
  answer: string | null;
  /** null — hali javob berilmagan */
  correct: boolean | null;
  answeredAt: string | null;
  /** vaqt (10 s) tugagani uchun xato deb hisoblandi */
  timedOut: boolean;
}

/**
 * LUG'AT COINLI SINOVI — bitta urinish.
 *
 * Dars lug'atidagi HAMMA so'z 10 soniyalik taymer bilan variantli so'raladi.
 * Coin qoidalari `VocabularyCoinTestService` da (3/2/1 coin, bonus, jarima,
 * 24 soatlik muddat). Bir dars uchun urinishlar ketma-ket raqamlanadi.
 */
@Entity({ name: 'vocabulary_coin_tests' })
@Index(['userId', 'lessonId'])
export class VocabularyCoinTest extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  /** shu dars bo'yicha nechinchi urinish (1 dan boshlab) */
  @Column({ type: 'int', name: 'attempt_number', default: 1 })
  attemptNumber: number;

  @Column({ type: 'varchar', name: 'status', enum: CoinTestStatus, default: CoinTestStatus.in_progress })
  status: CoinTestStatus;

  @Column({ type: 'jsonb', name: 'cards', default: () => "'[]'" })
  cards: CoinTestCard[];

  /** navbatdagi karta indeksi */
  @Column({ type: 'int', name: 'current_index', default: 0 })
  currentIndex: number;

  /** joriy karta talabaga qachon berilgan — 10 s tekshiruvi shundan */
  @Column({ type: 'timestamptz', name: 'last_served_at', nullable: true })
  lastServedAt: Date | null;

  /** coin muddati (keyingi dars sinfda ochilgan vaqt + 24 soat); null — muddat yo'q */
  @Column({ type: 'timestamptz', name: 'deadline_at', nullable: true })
  deadlineAt: Date | null;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'int', name: 'total_words', default: 0 })
  totalWords: number;

  @Column({ type: 'int', name: 'correct_count', default: 0 })
  correctCount: number;

  @Column({ type: 'int', name: 'percent', default: 0 })
  percent: number;

  /** muddat ichida topshirildimi (aks holda coin umuman hisoblanmagan) */
  @Column({ type: 'boolean', name: 'coins_eligible', default: true })
  coinsEligible: boolean;

  /** so'zlar uchun berilgan coin (3/2/1 × to'g'ri so'zlar) */
  @Column({ type: 'int', name: 'coins_words', default: 0 })
  coinsWords: number;

  /** 100% → +10, 90% → +5 (faqat 1-urinish) */
  @Column({ type: 'int', name: 'coins_bonus', default: 0 })
  coinsBonus: number;

  /** 60% dan past — −20 (haqiqatda ayirilgan, manfiy son) */
  @Column({ type: 'int', name: 'coins_penalty', default: 0 })
  coinsPenalty: number;

  /** yakuniy: words + bonus + penalty */
  @Column({ type: 'int', name: 'coins_earned', default: 0 })
  coinsEarned: number;

  @Column({ type: 'int', name: 'time_spent_sec', default: 0 })
  timeSpentSec: number;
}

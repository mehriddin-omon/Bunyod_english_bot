export enum ResourceType {
  AUDIO = 'audio',
  PDF = 'pdf',
  DOCUMENT = 'document',
  VIDEO = 'video',
}

export enum Role {
  superAdmin = 'superAdmin',
  admin = 'admin',
  teacher = 'teacher',
  subTeacher = 'subTeacher',
  student = 'student',
}

export enum LessonStatus {
  draft = 'draft',
  published = 'published',
  archived = 'archived',
}

export enum LessonType {
  grammar = 'grammar',
  reading = 'reading',
  listening = 'listening',
  vocabulary = 'vocabulary',
  test = 'test',
  mixed = 'mixed',
}

export enum QuestionType {
  multiple_choice = 'multiple_choice',
  fill_in_blank = 'fill_in_blank',
  true_false = 'true_false',
  matching = 'matching',
}

/** Student javobi qaysi blok turiga tegishli */
export enum StudentAnswerBlockType {
  quiz = 'quiz',
  reading = 'reading',
  listening = 'listening',
  grammar = 'grammar',
}

/** Quiz blok ichidagi mashq turlari */
export enum QuizExerciseType {
  matching = 'matching',
  fill_in_blank = 'fill_in_blank',
  multiple_choice = 'multiple_choice',
  true_false = 'true_false',
  word_bank = 'word_bank',
  translation = 'translation',
  /** Qolip 5 — rasm (xarita) ustidagi harfli nuqtalarni joy nomlariga moslash */
  map_labelling = 'map_labelling',
  /** Qolip 7 — bo'laklardan gap tuzish (SVOMPT) */
  sentence_order = 'sentence_order',
  /** Qolip 9 — xatoli gapni tuzatish */
  error_correction = 'error_correction',
}

export enum PartOfSpeech {
  noun = 'noun',
  verb = 'verb',
  adjective = 'adjective',
  adverb = 'adverb',
  phrase = 'phrase',
}

export enum CefrLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export enum SkillType {
  grammar = 'grammar',
  reading = 'reading',
  listening = 'listening',
  speaking = 'speaking',
  writing = 'writing',
  vocabulary = 'vocabulary',
}

export enum League {
  bronze = 'bronze',
  silver = 'silver',
  gold = 'gold',
  platinum = 'platinum',
  diamond = 'diamond',
}

export enum XpSource {
  lesson_complete = 'lesson_complete',
  /** Statik mashq birinchi marta ishlangani uchun (1 to'g'ri javob = 1 coin) */
  exercise_complete = 'exercise_complete',
  /**
   * ESKI qoida: so'z birinchi marta to'g'ri aytilgani uchun (1 so'z = 1 coin).
   * Endi tayyorlov rejimlari coin bermaydi — manba faqat eski yozuvlar uchun qoldi.
   */
  vocabulary_word = 'vocabulary_word',
  vocabulary_mastered = 'vocabulary_mastered',
  /**
   * Lug'at COINLI SINOVI (dars lug'ati bo'yicha, 10 s taymerli variantli test).
   * `reference_id` = dars idsi; `reference_key` = `vtest:<testId>:words|bonus|penalty`.
   * Jarima (60% dan past) MANFIY amount bilan shu manbada yoziladi.
   */
  vocabulary_test = 'vocabulary_test',
  /**
   * Talaba izohi like yig'gani uchun (10 → +1, 100 → +1, 1000 → +1 …, cheklovsiz).
   * `reference_id` = izoh idsi; `reference_key` = `vcomment:<id>:t<bosqich>`.
   */
  vocabulary_comment = 'vocabulary_comment',
  /**
   * Speaking ishi o'qituvchi tomonidan baholanganda: 3+ ball olgan har savol = 1 coin (bir marta).
   * `reference_id` = dars idsi; `reference_key` = `speaking:<submissionId>:<savol raqami>`.
   */
  speaking = 'speaking',
  streak_bonus = 'streak_bonus',
  challenge_bonus = 'challenge_bonus',
  assignment_bonus = 'assignment_bonus',
}

export enum AchievementCondition {
  streak = 'streak',
  lessons = 'lessons',
  vocabulary = 'vocabulary',
  score = 'score',
  attendance = 'attendance',
}

export enum GroupStatus {
  active = 'active',
  inactive = 'inactive',
  archived = 'archived',
}

export enum SessionStatus {
  scheduled = 'scheduled',
  ongoing = 'ongoing',
  completed = 'completed',
  cancelled = 'cancelled',
}

export enum AttendanceStatus {
  present = 'present',
  absent = 'absent',
  late = 'late',
  excused = 'excused',
}

export enum LessonProgressStatus {
  not_started = 'not_started',
  in_progress = 'in_progress',
  completed = 'completed',
}

export enum AssignmentType {
  reading = 'reading',
  listening = 'listening',
  writing = 'writing',
  speaking = 'speaking',
  grammar = 'grammar',
  vocabulary = 'vocabulary',
  test = 'test',
}

export enum AssignmentStatus {
  draft = 'draft',
  active = 'active',
  closed = 'closed',
}

export enum SubmissionStatus {
  pending = 'pending',
  submitted = 'submitted',
  graded = 'graded',
  late = 'late',
  revision_needed = 'revision_needed',
}

export enum NotificationType {
  message = 'message',
  lesson_unlocked = 'lesson_unlocked',
  achievement = 'achievement',
  assignment = 'assignment',
  reminder = 'reminder',
  system = 'system',
  /** 2026-11: teacher ommaviy xabari (notification_broadcasts) */
  teacher_message = 'teacher_message',
  /** 2026-11: onlayn (Zoom) dars — taklif, eslatma, o'zgarish */
  online_lesson = 'online_lesson',
  /** 2026-11: dars yozuvi tayyor */
  recording_ready = 'recording_ready',
}

export enum ActivityType {
  lesson = 'lesson',
  vocabulary = 'vocabulary',
  listening = 'listening',
  reading = 'reading',
  test = 'test',
}

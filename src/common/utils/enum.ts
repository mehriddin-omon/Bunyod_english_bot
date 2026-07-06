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
  vocabulary_mastered = 'vocabulary_mastered',
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
}

export enum ActivityType {
  lesson = 'lesson',
  vocabulary = 'vocabulary',
  listening = 'listening',
  reading = 'reading',
  test = 'test',
}

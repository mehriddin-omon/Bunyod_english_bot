// ============================================================================
// API Types & Interfaces
// ============================================================================

export type Role = 'ADMIN' | 'TEACHER' | 'SUB_TEACHER' | 'STUDENT';
export type LessonType = 'GRAMMAR' | 'READING' | 'LISTENING' | 'VOCABULARY' | 'TEST';
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';
export type League = 0 | 1 | 2 | 3 | 4; // Bronza, Kumush, Oltin, Platina, Olmos

// ============================================================================
// USER & AUTH
// ============================================================================

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  role: Role;
  cefrLevel?: string; // A1, A2, B1, B2, C1
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  phone: string;
  username: string;
  password: string;
  role: 'STUDENT' | 'TEACHER';
}

export interface MeResponse extends User {
  group?: Group;
  gamification?: Gamification;
}

// ============================================================================
// GROUPS
// ============================================================================

export interface GroupSchedule {
  days: string[]; // ["Du", "Ch", "Ju"]
  startTime: string; // "14:00"
  duration: number; // minutes
  topic?: string;
  recurring?: boolean;
}

export interface Group {
  id: string;
  name: string;
  color: string; // blue, emerald, amber, rose, violet, zinc
  cefrLevel: string; // A1, A2, B1, B2, C1
  maxStudents: number;
  studentCount?: number;
  startDate?: string;
  teacherId?: string;
  teacher?: User;
  schedule?: GroupSchedule;
  members?: GroupMember[];
  progress?: number;
  avgScore?: number;
  createdAt?: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: string;
  user?: User;
}

export interface CreateGroupDto {
  name: string;
  color: string;
  cefrLevel: string;
  maxStudents: number;
  startDate: string;
  schedule: {
    days: number[];
    startTime: string;
    duration: number;
    recurring: boolean;
  };
  studentIds?: string[];
}

export interface GroupStats {
  avgAttendance: number;
  avgScore: number;
  avgProgress: number;
}

export interface GroupDetail extends Group {
  students?: StudentWithProgress[];
  stats?: GroupStats;
}

// ============================================================================
// SCHEDULE
// ============================================================================

export interface Schedule {
  id: string;
  groupId: string;
  days: number[];
  startTime: string;
  duration: number;
  topic?: string;
  recurring: boolean;
  createdAt?: string;
}

export interface ScheduleLesson extends Schedule {
  groupName: string;
  groupColor: string;
  studentCount: number;
}

export interface CreateScheduleDto {
  groupId: string;
  days: number[];
  startTime: string;
  duration: number;
  topic?: string;
  recurring: boolean;
}

// ============================================================================
// LESSONS & UNITS
// ============================================================================

export interface Unit {
  id: string;
  number: number;
  title: string;
  description?: string;
  lessonCount?: number;
  progress?: number;
  status?: 'completed' | 'current' | 'locked';
  currentLesson?: LessonBasic;
  createdAt?: string;
}

export interface LessonBasic {
  id: string;
  number: number;
  title: string;
  lessonCode?: string;
}

export interface Lesson extends LessonBasic {
  unitId: string;
  type: LessonType;
  duration: number;
  content: Record<string, any>;
  order: number;
  status?: ProgressStatus;
  score?: number;
  userProgress?: UserProgress;
  outline?: OutlineItem[];
}

export interface OutlineItem {
  title: string;
  duration: string;
  done: boolean;
  current?: boolean;
}

export interface UserProgress {
  status: ProgressStatus;
  score?: number;
  attempts: number;
  timeSpent: number;
}

// ============================================================================
// GRAMMAR, READING, LISTENING, VOCABULARY
// ============================================================================

export interface GrammarContent {
  badge: string;
  heading: string;
  description: string;
  formula: {
    parts: string[];
  };
  examples: Array<{
    en: string;
    uz: string;
    highlight?: string;
  }>;
  rules: Array<{
    title: string;
    body: string;
  }>;
  relatedWords: string[];
  tip?: string;
}

export interface ReadingContent {
  lessonId: string;
  type: 'READING';
  text: {
    title: string;
    author: string;
    wordCount: number;
    readTime: number;
    paragraphs: Array<{
      text: string;
      highlights?: Array<{
        word: string;
        type: string;
      }>;
    }>;
  };
  questions: ReadingQuestion[];
}

export interface ReadingQuestion {
  id: string;
  number: number;
  type: 'multiple_choice' | 'true_false' | 'fill_blank';
  question: string;
  options?: Array<{
    id: string;
    text: string;
  }>;
  correctId?: string;
  correctAnswer?: string | string[];
  explanation?: string;
}

export interface ListeningContent {
  lessonId: string;
  type: 'LISTENING';
  audio: {
    title: string;
    trackCode: string;
    duration: number;
    audioUrl: string;
    speakers: Array<{
      id: string;
      name: string;
      color: string;
    }>;
  };
  transcript: Array<{
    speakerId: string;
    timeStart: number;
    text: string;
  }>;
  questions: ListeningQuestion[];
}

export interface ListeningQuestion {
  id: string;
  number: number;
  type: 'multiple_choice' | 'fill_blank';
  question: string;
  options?: Array<{
    id: string;
    text: string;
  }>;
  correctId?: string;
  correctAnswer?: string | string[];
  blanks?: number;
}

export interface Vocabulary {
  id: string;
  word: string;
  translation: string;
  example: string;
  cefrLevel: string;
  status: 'learned' | 'new' | 'reviewing';
  nextReviewAt?: string;
}

export interface VocabularyStats {
  total: number;
  learned: number;
  reviewing: number;
  new: number;
}

// ============================================================================
// PROGRESS
// ============================================================================

export interface ProgressResponse {
  status: ProgressStatus;
  score?: number;
  timeSpent: number;
  completedAt?: string;
}

export interface CompleteProgressDto {
  score: number;
  timeSpent: number;
  answers: Array<{
    questionId: string;
    answer: string | string[];
  }>;
}

export interface CompleteProgressResponse {
  progress: ProgressResponse;
  xpEarned: number;
  nextLesson?: LessonBasic;
  streakUpdated: boolean;
  newStreak: number;
}

export interface ProgressOverview {
  streak: number;
  totalLessons: number;
  completedLessons: number;
  completedPercent: number;
  learnedWords: number;
  avgScore: number;
  todayGoal: {
    targetMinutes: number;
    spentMinutes: number;
    percent: number;
    tasks: Array<{
      label: string;
      done: boolean;
    }>;
  };
  currentLesson?: {
    unitNumber: number;
    unitTitle: string;
    lessonCode: string;
    lessonTitle: string;
    unitProgress: number;
  };
  weeklyActivity: Array<{
    date: string;
    minutes: number;
  }>;
}

// ============================================================================
// GAMIFICATION
// ============================================================================

export interface Gamification {
  id?: string;
  userId?: string;
  xp: number;
  level: number;
  xpInLevel: number;
  league: League;
  streak: number;
  lastActiveAt?: string;
  weeklyXp: number;
  updatedAt?: string;
}

export interface GamificationDetail extends Gamification {
  xpToNextLevel: number;
  leagueName: string;
  rankInGroup: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  level: number;
  xpInLevel: number;
  totalXp: number;
  weeklyXp: number;
  league: League;
  leagueName: string;
  streak: number;
  weeklyRankChange: number;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  period: 'week' | 'all';
  currentUserId: string;
  board: LeaderboardEntry[];
  groupChallenge?: {
    targetXp: number;
    currentXp: number;
    daysLeft: number;
    reward: string;
  };
}

// ============================================================================
// ASSIGNMENTS
// ============================================================================

export interface Assignment {
  id: string;
  groupId: string;
  lessonId?: string;
  title: string;
  description?: string;
  type: 'writing' | 'speaking' | 'test';
  dueDate: string;
  createdAt?: string;
  group?: Group;
  status?: SubmissionStatus; // for student
  submittedCount?: number; // for teacher
  totalCount?: number; // for teacher
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  student?: User;
  content?: string;
  fileUrl?: string;
  score?: number;
  feedback?: string;
  status: SubmissionStatus;
  submittedAt?: string;
  gradedAt?: string;
}

export interface CreateAssignmentDto {
  groupId: string;
  lessonId?: string;
  title: string;
  description?: string;
  type: 'writing' | 'speaking' | 'test';
  dueDate: string;
}

export interface SubmitAssignmentDto {
  content?: string;
  fileUrl?: string;
}

export interface GradeAssignmentDto {
  score: number;
  feedback?: string;
}

export interface AssignmentSubmissionsResponse {
  assignment: Assignment;
  submissions: AssignmentSubmission[];
  stats: {
    submitted: number;
    pending: number;
    late: number;
    total: number;
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface Skill {
  level: string;
  pct: number;
  wordCount?: number;
}

export interface UserStats {
  cefrLevel: string;
  cefrProgress: number;
  skills: {
    reading: Skill;
    grammar: Skill;
    writing: Skill;
    vocabulary: Skill;
    listening: Skill;
    speaking: Skill;
  };
  vocabulary: {
    total: number;
    retention: number;
    byLevel: Array<{
      level: string;
      count: number;
    }>;
  };
  activityHeatmap: Array<{
    dayOfWeek: number;
    hour: number;
    intensity: number;
  }>;
  weeklyMinutes: Array<{
    day: string;
    minutes: number;
  }>;
  gamification: GamificationDetail;
}

export interface StudentWithProgress {
  id: string;
  firstName: string;
  lastName: string;
  username?: string;
  attendance?: number;
  assignmentCompletion?: number;
  lastActiveAt?: string;
  status?: 'good' | 'watch' | 'risk';
  cefrLevel?: string;
}

export interface MonitoringGroupResponse {
  period: 'week' | 'month' | 'quarter';
  kpi: {
    avgAttendance: number;
    avgAssignmentCompletion: number;
    avgScore: number;
    atRiskCount: number;
  };
  weeklyActivity: Array<{
    day: string;
    activeStudents: number;
  }>;
  students: StudentWithProgress[];
}

export interface StudentDetailKPI {
  avgScore: number;
  groupAvgScore: number;
  attendance: number;
  completedAssignments: number;
  totalAssignments: number;
  lateAssignments: number;
  weeklyActiveTime: string;
  weeklyChangePercent: number;
}

export interface TopicStat {
  lessonCode: string;
  title: string;
  type: string;
  completedPercent: number;
  score: string;
  timeSpent: string;
  attempts: number;
}

export interface StudentDetailResponse {
  student: StudentWithProgress & {
    email?: string;
    joinedAt?: string;
  };
  summary: {
    streak: number;
    totalTime: string;
    rankInGroup: number;
  };
  kpi: StudentDetailKPI;
  skills: Record<string, Skill>;
  vocabulary: {
    total: number;
    retention: number;
    weeklyGain: number;
  };
  activityHeatmap: Array<any>;
  weeklyMinutes: Array<any>;
  topicStats: TopicStat[];
  recentAssignments: Array<{
    title: string;
    status: SubmissionStatus;
    score?: number;
    dueDate: string;
  }>;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'assignment' | 'reminder' | 'achievement' | 'group';
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount: number;
  notifications: Notification[];
}

// ============================================================================
// ADMIN
// ============================================================================

export interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  activeGroups: number;
  totalLessons: number;
  avgDailyActive: number;
}

export interface AdminOverviewResponse {
  stats: AdminStats;
}

export interface AdminAnalyticsResponse {
  dailyActive: Array<{
    date: string;
    count: number;
  }>;
  newRegistrations: Array<{
    date: string;
    count: number;
  }>;
  lessonCompletions: Array<{
    date: string;
    count: number;
  }>;
  topLessons: Array<{
    lessonCode: string;
    completions: number;
  }>;
}

// ============================================================================
// PAGINATION & RESPONSES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: Record<string, any>;
  message?: string;
}

export interface ApiListResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

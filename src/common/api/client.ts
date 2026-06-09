import {
  // Types
  User,
  AuthResponse,
  LoginDto,
  RegisterDto,
  MeResponse,
  Group,
  GroupDetail,
  GroupMember,
  CreateGroupDto,
  Schedule,
  ScheduleLesson,
  CreateScheduleDto,
  Unit,
  Lesson,
  Vocabulary,
  VocabularyStats,
  ProgressResponse,
  CompleteProgressDto,
  CompleteProgressResponse,
  ProgressOverview,
  Gamification,
  GamificationDetail,
  LeaderboardResponse,
  Assignment,
  AssignmentSubmission,
  CreateAssignmentDto,
  SubmitAssignmentDto,
  GradeAssignmentDto,
  AssignmentSubmissionsResponse,
  UserStats,
  MonitoringGroupResponse,
  StudentDetailResponse,
  Notification,
  NotificationsResponse,
  AdminOverviewResponse,
  AdminAnalyticsResponse,
  PaginatedResponse,
  ApiResponse,
  ReadingContent,
  ListeningContent,
} from './types';

type RequestInit = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
};

// ============================================================================
// API Client
// ============================================================================

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1') {
    this.baseUrl = baseUrl;
    this.loadTokensFromStorage();
  }

  // ========================================================================
  // Token Management
  // ========================================================================

  private loadTokensFromStorage(): void {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  private saveTokensToStorage(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // ========================================================================
  // HTTP Methods
  // ========================================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    let response = await fetch(url, config);

    // Handle token refresh on 401
    if (response.status === 401 && this.refreshToken) {
      try {
        const newTokens = await this.refreshAccessToken();
        headers.Authorization = `Bearer ${newTokens.accessToken}`;
        response = await fetch(url, { ...config, headers });
      } catch (error) {
        this.clearTokens();
        throw error;
      }
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  private async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // ========================================================================
  // AUTH
  // ========================================================================

  async login(dto: LoginDto): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>('/auth/login', dto);
    this.saveTokensToStorage(response.accessToken, response.refreshToken);
    return response;
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>('/auth/register', dto);
    this.saveTokensToStorage(response.accessToken, response.refreshToken);
    return response;
  }

  async refreshAccessToken(): Promise<AuthResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    const response = await this.post<AuthResponse>('/auth/refresh', {
      refreshToken: this.refreshToken,
    });
    this.saveTokensToStorage(response.accessToken, response.refreshToken);
    return response;
  }

  async logout(): Promise<{ message: string }> {
    await this.post('/auth/logout');
    this.clearTokens();
    return { message: 'Logged out' };
  }

  async getMe(): Promise<MeResponse> {
    return this.get<MeResponse>('/auth/me');
  }

  // ========================================================================
  // USERS
  // ========================================================================

  async getUsers(params?: {
    role?: string;
    groupId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<User>> {
    const query = new URLSearchParams();
    if (params?.role) query.append('role', params.role);
    if (params?.groupId) query.append('groupId', params.groupId);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);

    return this.get<PaginatedResponse<User>>(
      `/users${query.toString() ? '?' + query.toString() : ''}`,
    );
  }

  async getUserById(id: string): Promise<User> {
    return this.get<User>(`/users/${id}`);
  }

  async updateUser(id: string, dto: Partial<User>): Promise<User> {
    return this.put<User>(`/users/${id}`, dto);
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/users/${id}`);
  }

  // ========================================================================
  // GROUPS
  // ========================================================================

  async getGroups(): Promise<{ data: Group[] }> {
    return this.get<{ data: Group[] }>('/groups');
  }

  async getGroupById(id: string): Promise<GroupDetail> {
    return this.get<GroupDetail>(`/groups/${id}`);
  }

  async createGroup(dto: CreateGroupDto): Promise<Group> {
    return this.post<Group>('/groups', dto);
  }

  async updateGroup(id: string, dto: Partial<CreateGroupDto>): Promise<Group> {
    return this.put<Group>(`/groups/${id}`, dto);
  }

  async deleteGroup(id: string): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/groups/${id}`);
  }

  async addStudentsToGroup(groupId: string, studentIds: string[]): Promise<{ added: number; message: string }> {
    return this.post<{ added: number; message: string }>(
      `/groups/${groupId}/students`,
      { studentIds },
    );
  }

  async removeStudentFromGroup(groupId: string, studentId: string): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/groups/${groupId}/students/${studentId}`);
  }

  async getGroupSchedule(groupId: string): Promise<{ groupId: string; schedule: Schedule[] }> {
    return this.get<{ groupId: string; schedule: Schedule[] }>(
      `/groups/${groupId}/schedule`,
    );
  }

  // ========================================================================
  // SCHEDULE
  // ========================================================================

  async getSchedule(params?: { week?: string }): Promise<{ week: string; lessons: ScheduleLesson[] }> {
    const query = new URLSearchParams();
    if (params?.week) query.append('week', params.week);

    return this.get<{ week: string; lessons: ScheduleLesson[] }>(
      `/schedule${query.toString() ? '?' + query.toString() : ''}`,
    );
  }

  async createSchedule(dto: CreateScheduleDto): Promise<Schedule> {
    return this.post<Schedule>('/schedule', dto);
  }

  async updateSchedule(id: string, dto: Partial<CreateScheduleDto>): Promise<Schedule> {
    return this.put<Schedule>(`/schedule/${id}`, dto);
  }

  async deleteSchedule(id: string): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/schedule/${id}`);
  }

  // ========================================================================
  // LESSONS
  // ========================================================================

  async getLessonUnits(): Promise<{ units: Unit[] }> {
    return this.get<{ units: Unit[] }>('/lessons/units');
  }

  async getLessonUnitById(unitId: string): Promise<{ unit: Unit; lessons: Lesson[] }> {
    return this.get<{ unit: Unit; lessons: Lesson[] }>(`/lessons/units/${unitId}`);
  }

  async getLessonById(lessonId: string): Promise<Lesson> {
    return this.get<Lesson>(`/lessons/${lessonId}`);
  }

  async getReadingContent(unitId: string, lessonId: string): Promise<ReadingContent> {
    return this.get<ReadingContent>(
      `/lessons/units/${unitId}/lessons/${lessonId}/reading`,
    );
  }

  async getListeningContent(unitId: string, lessonId: string): Promise<ListeningContent> {
    return this.get<ListeningContent>(
      `/lessons/units/${unitId}/lessons/${lessonId}/listening`,
    );
  }

  // ========================================================================
  // PROGRESS
  // ========================================================================

  async startLesson(lessonId: string): Promise<{ progressId: string; startedAt: string }> {
    return this.post<{ progressId: string; startedAt: string }>(
      `/progress/lessons/${lessonId}/start`,
    );
  }

  async completeLesson(lessonId: string, dto: CompleteProgressDto): Promise<CompleteProgressResponse> {
    return this.post<CompleteProgressResponse>(
      `/progress/lessons/${lessonId}/complete`,
      dto,
    );
  }

  async getProgressOverview(): Promise<ProgressOverview> {
    return this.get<ProgressOverview>('/progress/overview');
  }

  // ========================================================================
  // VOCABULARY
  // ========================================================================

  async getVocabulary(params?: {
    unitId?: string;
    cefrLevel?: string;
    status?: 'learned' | 'new' | 'reviewing';
  }): Promise<{ words: Vocabulary[]; stats: VocabularyStats }> {
    const query = new URLSearchParams();
    if (params?.unitId) query.append('unitId', params.unitId);
    if (params?.cefrLevel) query.append('cefrLevel', params.cefrLevel);
    if (params?.status) query.append('status', params.status);

    return this.get<{ words: Vocabulary[]; stats: VocabularyStats }>(
      `/vocabulary${query.toString() ? '?' + query.toString() : ''}`,
    );
  }

  async reviewVocabularyWord(wordId: string, quality: number): Promise<{ nextReviewAt: string; xpEarned: number }> {
    return this.post<{ nextReviewAt: string; xpEarned: number }>(
      `/vocabulary/${wordId}/review`,
      { quality },
    );
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  async getUserStats(): Promise<UserStats> {
    return this.get<UserStats>('/stats/my');
  }

  // ========================================================================
  // ASSIGNMENTS
  // ========================================================================

  async getAssignments(params?: { pending?: boolean }): Promise<{ data: Assignment[] }> {
    const query = new URLSearchParams();
    if (params?.pending) query.append('pending', params.pending.toString());

    return this.get<{ data: Assignment[] }>(
      `/assignments${query.toString() ? '?' + query.toString() : ''}`,
    );
  }

  async createAssignment(dto: CreateAssignmentDto): Promise<Assignment> {
    return this.post<Assignment>('/assignments', dto);
  }

  async submitAssignment(assignmentId: string, dto: SubmitAssignmentDto): Promise<{ submissionId: string; status: string }> {
    return this.post<{ submissionId: string; status: string }>(
      `/assignments/${assignmentId}/submit`,
      dto,
    );
  }

  async getAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmissionsResponse> {
    return this.get<AssignmentSubmissionsResponse>(`/assignments/${assignmentId}/submissions`);
  }

  async gradeAssignment(
    assignmentId: string,
    submissionId: string,
    dto: GradeAssignmentDto,
  ): Promise<AssignmentSubmission & { xpEarned: number }> {
    return this.put<AssignmentSubmission & { xpEarned: number }>(
      `/assignments/${assignmentId}/submissions/${submissionId}/grade`,
      dto,
    );
  }

  // ========================================================================
  // MONITORING
  // ========================================================================

  async getGroupMonitoring(
    groupId: string,
    params?: { period?: 'week' | 'month' | 'quarter' },
  ): Promise<MonitoringGroupResponse> {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);

    return this.get<MonitoringGroupResponse>(
      `/monitoring/groups/${groupId}${query.toString() ? '?' + query.toString() : ''}`,
    );
  }

  async getStudentDetail(studentId: string): Promise<StudentDetailResponse> {
    return this.get<StudentDetailResponse>(`/monitoring/students/${studentId}`);
  }

  // ========================================================================
  // GAMIFICATION
  // ========================================================================

  async getLeaderboard(params?: {
    groupId?: string;
    period?: 'week' | 'all';
  }): Promise<LeaderboardResponse> {
    const query = new URLSearchParams();
    if (params?.groupId) query.append('groupId', params.groupId);
    if (params?.period) query.append('period', params.period);

    return this.get<LeaderboardResponse>(
      `/gamification/leaderboard${query.toString() ? '?' + query.toString() : ''}`,
    );
  }

  async getMyGamification(): Promise<GamificationDetail> {
    return this.get<GamificationDetail>('/gamification/my');
  }

  // ========================================================================
  // NOTIFICATIONS
  // ========================================================================

  async getNotifications(): Promise<NotificationsResponse> {
    return this.get<NotificationsResponse>('/notifications');
  }

  async markNotificationAsRead(notificationId: string): Promise<{ message: string }> {
    return this.put<{ message: string }>(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead(): Promise<{ message: string }> {
    return this.put<{ message: string }>('/notifications/read-all');
  }

  // ========================================================================
  // ADMIN
  // ========================================================================

  async getAdminOverview(): Promise<AdminOverviewResponse> {
    return this.get<AdminOverviewResponse>('/admin/overview');
  }

  async getAdminAnalytics(params?: { period?: 'week' | 'month' | 'quarter' }): Promise<AdminAnalyticsResponse> {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);

    return this.get<AdminAnalyticsResponse>(
      `/admin/analytics${query.toString() ? '?' + query.toString() : ''}`,
    );
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiClient = new ApiClient();

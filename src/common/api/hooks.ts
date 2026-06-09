// @ts-nocheck
/**
 * React Hooks for API Client
 * Provides convenient hooks for common API operations in Next.js/React components
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from './client';
import type {
  User,
  AuthResponse,
  MeResponse,
  Group,
  Lesson,
  ProgressOverview,
  UserStats,
  LeaderboardResponse,
  NotificationsResponse,
} from './types';

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseMutationResult<T> {
  mutate: (args?: any) => Promise<T | null>;
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// ============================================================================
// Auth Hooks
// ============================================================================

export function useLogin() {
  const [data, setData] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (credentials: { username: string; password: string }) => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.login(credentials);
        setData(response);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { mutate, data, loading, error };
}

export function useRegister() {
  const [data, setData] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (dto: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.register(dto);
      setData(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, data, loading, error };
}

export function useLogout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.logout();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}

export function useMe(): UseQueryResult<MeResponse> {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getMe();
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, error, refetch };
}

// ============================================================================
// Group Hooks
// ============================================================================

export function useGroups(): UseQueryResult<Group[]> {
  const [data, setData] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getGroups();
      setData(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, error, refetch };
}

export function useGroup(groupId: string | null): UseQueryResult<any> {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getGroupById(groupId);
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    refetch();
  }, [groupId]);

  return { data, loading, error, refetch };
}

// ============================================================================
// Lessons Hooks
// ============================================================================

export function useLessonUnits(): UseQueryResult<any[]> {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getLessonUnits();
      setData(response.units);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, error, refetch };
}

export function useLesson(lessonId: string | null): UseQueryResult<Lesson> {
  const [data, setData] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(!!lessonId);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!lessonId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getLessonById(lessonId);
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    refetch();
  }, [lessonId]);

  return { data, loading, error, refetch };
}

// ============================================================================
// Progress Hooks
// ============================================================================

export function useProgressOverview(): UseQueryResult<ProgressOverview> {
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProgressOverview();
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, error, refetch };
}

export function useCompleteLesson() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<any | null>(null);

  const mutate = useCallback(async (lessonId: string, dto: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.completeLesson(lessonId, dto);
      setData(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, data, loading, error };
}

// ============================================================================
// Statistics Hooks
// ============================================================================

export function useUserStats(): UseQueryResult<UserStats> {
  const [data, setData] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUserStats();
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, error, refetch };
}

// ============================================================================
// Leaderboard Hooks
// ============================================================================

export function useLeaderboard(params?: { groupId?: string; period?: 'week' | 'all' }): UseQueryResult<LeaderboardResponse> {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getLeaderboard(params);
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [params?.groupId, params?.period]);

  useEffect(() => {
    refetch();
  }, [params?.groupId, params?.period]);

  return { data, loading, error, refetch };
}

// ============================================================================
// Notifications Hooks
// ============================================================================

export function useNotifications(): UseQueryResult<NotificationsResponse> {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getNotifications();
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, error, refetch };
}

// ============================================================================
// Assignments Hooks
// ============================================================================

export function useAssignments(params?: any): UseQueryResult<any[]> {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAssignments(params);
      setData(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [params?.pending]);

  useEffect(() => {
    refetch();
  }, [params?.pending]);

  return { data, loading, error, refetch };
}

export function useSubmitAssignment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<any | null>(null);

  const mutate = useCallback(async (assignmentId: string, dto: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.submitAssignment(assignmentId, dto);
      setData(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, data, loading, error };
}

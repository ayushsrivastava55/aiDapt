"use client";

import { useState, useEffect, useCallback } from "react";

export interface Learner {
  id: string;
  sessionId: string;
  displayName: string | null;
  email: string | null;
  streakCount: number;
  totalXp: number;
  level: number;
  createdAt: Date;
  lastActiveAt: Date;
}

interface UseSessionReturn {
  learner: Learner | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  learnerId: string | null;
}

/**
 * Custom hook to manage learner session across the application.
 * Fetches session from the server and provides learner data to components.
 * 
 * Usage:
 * ```tsx
 * const { learner, learnerId, isLoading, error } = useSession();
 * ```
 */
export function useSession(): UseSessionReturn {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/session", {
        method: "GET",
        credentials: "include", // Include cookies
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.learner) {
        setLearner(data.learner);
      } else {
        setLearner(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch session";
      setError(errorMessage);
      console.error("Session fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    learner,
    isLoading,
    error,
    refresh: fetchSession,
    learnerId: learner?.id || null,
  };
}

/**
 * Hook to get only the learner ID without full session data.
 * Useful for components that only need the ID for API calls.
 */
export function useLearnerId(): { learnerId: string | null; isLoading: boolean } {
  const { learnerId, isLoading } = useSession();
  return { learnerId, isLoading };
}

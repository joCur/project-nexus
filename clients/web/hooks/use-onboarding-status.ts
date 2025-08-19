import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';

interface OnboardingStatus {
  isComplete: boolean;
  currentStep: number;
  hasProfile: boolean;
  hasWorkspace: boolean;
  profile?: {
    id: string;
    fullName: string;
    displayName?: string;
  };
  onboarding?: {
    id: string;
    completed: boolean;
    completedAt?: string;
    currentStep: number;
    tutorialProgress?: Record<string, boolean>;
  };
  workspace?: {
    id: string;
    name: string;
    privacy: string;
  };
}

interface UseOnboardingStatusResult {
  status: OnboardingStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOnboardingStatus(): UseOnboardingStatusResult {
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const currentFetchPromiseRef = useRef<Promise<void> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    // If there's already a request in progress, wait for it to complete
    if (currentFetchPromiseRef.current) {
      await currentFetchPromiseRef.current;
      return;
    }

    const fetchPromise = (async () => {
      try {
        setIsFetching(true);
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/user/onboarding/status', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            setStatus(null);
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setStatus(data);

      } catch (err) {
        console.error('Failed to fetch onboarding status:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        
        // Provide safe defaults on error
        setStatus({
          isComplete: false,
          currentStep: 1,
          hasProfile: false,
          hasWorkspace: false,
        });
      } finally {
        setIsLoading(false);
        setIsFetching(false);
        currentFetchPromiseRef.current = null;
      }
    })();

    currentFetchPromiseRef.current = fetchPromise;
    await fetchPromise;
  }, [user]);

  const refetch = useCallback(async () => {
    return fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!authLoading) {
      fetchStatus();
    }
  }, [fetchStatus, authLoading]);

  return {
    status,
    isLoading: isLoading || authLoading,
    error,
    refetch,
  };
}
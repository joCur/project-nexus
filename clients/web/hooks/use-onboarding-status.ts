import { useState, useEffect } from 'react';
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

  const fetchStatus = async () => {
    if (!user) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    try {
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
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchStatus();
    }
  }, [user, authLoading]);

  return {
    status,
    isLoading: isLoading || authLoading,
    error,
    refetch: fetchStatus,
  };
}
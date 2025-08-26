import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { localCache, CACHE_KEYS, CACHE_OPTIONS } from '@/lib/client-cache';
import logger from '@/lib/logger';

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
  isInitialLoad: boolean;
}

/**
 * Enhanced onboarding status hook with race condition prevention and client-side caching
 * 
 * Key improvements:
 * - Waits for Auth0 session to stabilize before making API calls
 * - Implements client-side caching to persist state across refreshes
 * - Provides better error handling that doesn't reset completed status
 * - Tracks initial load state separately from subsequent fetches
 */
export function useOnboardingStatus(): UseOnboardingStatusResult {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const currentFetchPromiseRef = useRef<Promise<void> | null>(null);
  const sessionStableRef = useRef(false);

  /**
   * Load onboarding status from cache first, then optionally fetch fresh data
   */
  const loadFromCache = useCallback((): OnboardingStatus | null => {
    if (!user?.sub) return null;
    
    const cacheKey = `${CACHE_KEYS.ONBOARDING_STATUS}:${user.sub}`;
    return localCache.get<OnboardingStatus>(cacheKey, CACHE_OPTIONS.ONBOARDING_STATUS);
  }, [user?.sub]);

  /**
   * Save onboarding status to cache
   */
  const saveToCache = useCallback((data: OnboardingStatus) => {
    if (!user?.sub) return;
    
    const cacheKey = `${CACHE_KEYS.ONBOARDING_STATUS}:${user.sub}`;
    localCache.set(cacheKey, data, CACHE_OPTIONS.ONBOARDING_STATUS);
  }, [user?.sub]);

  /**
   * Clear cached onboarding status for current user
   */
  const clearCache = useCallback(() => {
    if (!user?.sub) return;
    
    const cacheKey = `${CACHE_KEYS.ONBOARDING_STATUS}:${user.sub}`;
    localCache.remove(cacheKey, CACHE_OPTIONS.ONBOARDING_STATUS);
  }, [user?.sub]);

  /**
   * Fetch onboarding status from API with improved error handling and caching
   */
  const fetchStatus = useCallback(async (forceRefresh = false) => {
    // Don't fetch if auth is still loading or user is not authenticated
    if (authLoading || !isAuthenticated || !user?.sub) {
      if (!authLoading) {
        setStatus(null);
        setIsLoading(false);
        setIsInitialLoad(false);
      }
      return;
    }

    // If there's already a request in progress, wait for it to complete
    if (currentFetchPromiseRef.current) {
      await currentFetchPromiseRef.current;
      return;
    }

    // Load from cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedStatus = loadFromCache();
      if (cachedStatus) {
        setStatus(cachedStatus);
        setIsLoading(false);
        setIsInitialLoad(false);
        setError(null);
        
        // If onboarding is complete, we can trust cached data longer
        if (cachedStatus.isComplete) {
          return;
        }
      }
    }

    const fetchPromise = (async () => {
      try {
        setIsFetching(true);
        if (isInitialLoad) {
          setIsLoading(true);
        }
        setError(null);

        const response = await fetch('/api/user/onboarding/status', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300', // 5 min cache for non-force requests
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            // User is not authenticated, clear everything
            setStatus(null);
            clearCache();
            return;
          }
          
          if (response.status >= 500) {
            // Server error - preserve existing status if we have one
            const currentStatus = status || loadFromCache();
            if (currentStatus) {
              logger.warn('Server error, preserving existing onboarding status', { statusCode: response.status });
              setError(`Server temporarily unavailable (${response.status})`);
              return;
            }
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Validate the response data
        if (typeof data.isComplete !== 'boolean') {
          throw new Error('Invalid response format: missing isComplete');
        }

        setStatus(data);
        saveToCache(data);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to fetch onboarding status', { error: errorMessage });
        setError(errorMessage);
        
        // Preserve existing status if we have it, otherwise use safe defaults
        const existingStatus = status || loadFromCache();
        if (!existingStatus) {
          // Only reset to defaults if we have no existing data
          const defaultStatus: OnboardingStatus = {
            isComplete: false,
            currentStep: 1,
            hasProfile: false,
            hasWorkspace: false,
          };
          setStatus(defaultStatus);
        } else {
          // Keep existing status and let user know about the error
          logger.warn('Preserving existing onboarding status due to fetch error');
        }
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
        setIsFetching(false);
        currentFetchPromiseRef.current = null;
      }
    })();

    currentFetchPromiseRef.current = fetchPromise;
    await fetchPromise;
  }, [user?.sub, authLoading, isAuthenticated, isInitialLoad, status, loadFromCache, saveToCache, clearCache]);

  /**
   * Force refresh onboarding status from API
   */
  const refetch = useCallback(async () => {
    return fetchStatus(true); // Force refresh bypasses cache
  }, [fetchStatus]);

  /**
   * Initialize onboarding status when auth session becomes stable
   */
  useEffect(() => {
    // Mark session as stable after auth finishes loading
    if (!authLoading && !sessionStableRef.current) {
      sessionStableRef.current = true;
    }
  }, [authLoading]);

  /**
   * Load cached data immediately on mount, then fetch fresh data when session is stable
   */
  useEffect(() => {
    // Try to load from cache immediately to prevent flash
    if (user?.sub && !status) {
      const cachedStatus = loadFromCache();
      if (cachedStatus) {
        setStatus(cachedStatus);
        setError(null);
        // Don't set loading to false yet - we still want to fetch fresh data
      }
    }
  }, [user?.sub, status, loadFromCache]);

  /**
   * Fetch fresh data when session becomes stable
   */
  useEffect(() => {
    if (sessionStableRef.current && !authLoading && isAuthenticated) {
      fetchStatus();
    } else if (!authLoading && !isAuthenticated) {
      // User is not authenticated, clear everything
      setStatus(null);
      setIsLoading(false);
      setIsInitialLoad(false);
      setError(null);
    }
  }, [authLoading, isAuthenticated, fetchStatus]);

  /**
   * Clear cache when user changes (logout/login)
   */
  useEffect(() => {
    return () => {
      // Reset session stable flag when component unmounts or user changes
      sessionStableRef.current = false;
    };
  }, [user?.sub]);

  return {
    status,
    isLoading: isLoading || authLoading,
    error,
    refetch,
    isInitialLoad,
  };
}
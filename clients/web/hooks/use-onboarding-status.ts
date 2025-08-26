import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { localCache, CACHE_KEYS, CACHE_OPTIONS } from '@/lib/client-cache';
import logger from '@/lib/logger';

// Error types for robust error handling
interface ApiError {
  type: 'NETWORK_ERROR' | 'HTTP_ERROR' | 'VALIDATION_ERROR' | 'SERVER_ERROR' | 'UNKNOWN_ERROR';
  statusCode?: number;
  message: string;
  cause?: Error;
}

class OnboardingApiError extends Error implements ApiError {
  public type: ApiError['type'];
  public statusCode?: number;
  public cause?: Error;

  constructor(type: ApiError['type'], message: string, statusCode?: number, cause?: Error) {
    super(message);
    this.name = 'OnboardingApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.cause = cause;
  }

  static fromFetchError(error: Error): OnboardingApiError {
    // Network errors (fetch failures, no response, connection issues)
    if (error.message.includes('fetch') || 
        error.message.includes('Network') || 
        error.message.includes('network') ||
        error.name === 'TypeError') {
      return new OnboardingApiError('NETWORK_ERROR', error.message, undefined, error);
    }
    
    // Validation errors (malformed API responses)
    if (error.message.includes('Invalid response format')) {
      return new OnboardingApiError('VALIDATION_ERROR', error.message, undefined, error);
    }
    
    // Default to unknown error
    return new OnboardingApiError('UNKNOWN_ERROR', error.message, undefined, error);
  }

  static fromResponse(response: Response): OnboardingApiError {
    if (response.status >= 500) {
      return new OnboardingApiError('SERVER_ERROR', 'Server temporarily unavailable', response.status);
    }
    
    if (response.status === 401) {
      return new OnboardingApiError('HTTP_ERROR', 'Authentication required', response.status);
    }
    
    if (response.status >= 400) {
      return new OnboardingApiError('HTTP_ERROR', `Client error: ${response.statusText}`, response.status);
    }
    
    return new OnboardingApiError('HTTP_ERROR', `HTTP error: ${response.statusText}`, response.status);
  }
}

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
  const statusRef = useRef<OnboardingStatus | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

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
          const apiError = OnboardingApiError.fromResponse(response);
          
          if (apiError.statusCode === 401) {
            // User is not authenticated, clear everything
            setStatus(null);
            clearCache();
            return;
          }
          
          if (apiError.type === 'SERVER_ERROR') {
            // Server error - preserve existing status if we have one
            const currentStatus = statusRef.current || loadFromCache();
            if (currentStatus) {
              logger.warn('Server error, preserving existing onboarding status', { 
                statusCode: apiError.statusCode,
                errorType: apiError.type 
              });
              setError(apiError.message);
              return;
            }
          }
          
          throw apiError;
        }

        const data = await response.json();
        
        // Validate the response data
        if (typeof data.isComplete !== 'boolean') {
          throw new Error('Invalid response format: missing isComplete');
        }

        setStatus(data);
        saveToCache(data);

      } catch (err) {
        // Convert unknown errors to our typed error system
        const apiError = err instanceof OnboardingApiError 
          ? err 
          : err instanceof Error 
            ? OnboardingApiError.fromFetchError(err)
            : new OnboardingApiError('UNKNOWN_ERROR', 'An unknown error occurred');
        
        logger.error('Failed to fetch onboarding status', { 
          error: apiError.message,
          errorType: apiError.type,
          statusCode: apiError.statusCode
        });
        
        setError(apiError.message);
        
        // Handle different error types appropriately
        if (apiError.type === 'NETWORK_ERROR' || apiError.type === 'SERVER_ERROR' || apiError.type === 'VALIDATION_ERROR') {
          // For network/server/validation errors, preserve existing status if we have it
          const existingStatus = statusRef.current || loadFromCache();
          if (existingStatus) {
            logger.warn('Preserving existing onboarding status due to connectivity/server/validation error', {
              errorType: apiError.type
            });
            return;
          }
        }
        
        // For other error types or when we have no existing data, use safe defaults
        const defaultStatus: OnboardingStatus = {
          isComplete: false,
          currentStep: 1,
          hasProfile: false,
          hasWorkspace: false,
        };
        setStatus(defaultStatus);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
        setIsFetching(false);
        currentFetchPromiseRef.current = null;
      }
    })();

    currentFetchPromiseRef.current = fetchPromise;
    await fetchPromise;
  }, [user?.sub, authLoading, isAuthenticated, isInitialLoad, loadFromCache, saveToCache, clearCache]);

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
   * Clear state when user changes (logout/login between different users)
   */
  useEffect(() => {
    const currentUserId = user?.sub;
    const previousUserId = previousUserIdRef.current;
    
    // Only clear state if switching between different actual users (not initial load)
    if (previousUserId && currentUserId && previousUserId !== currentUserId) {
      setStatus(null);
      setError(null);
      setIsLoading(true);
      setIsInitialLoad(true);
      statusRef.current = null;
      sessionStableRef.current = false;
    }
    
    // Update previous user ID
    previousUserIdRef.current = currentUserId || null;
    
    return () => {
      // Reset session stable flag when component unmounts
      sessionStableRef.current = false;
    };
  }, [user?.sub]);

  // Keep statusRef in sync with status
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  return {
    status,
    isLoading: isLoading || authLoading,
    error,
    refetch,
    isInitialLoad,
  };
}
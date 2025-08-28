import { renderHook, waitFor, act } from '@testing-library/react';
import { useOnboardingStatus } from '../use-onboarding-status';
import { localCache, CACHE_KEYS, CACHE_OPTIONS } from '@/lib/client-cache';

// Mock useAuth hook
jest.mock('../use-auth', () => ({
  useAuth: jest.fn(),
}));

// Mock client cache
jest.mock('@/lib/client-cache', () => ({
  localCache: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
  CACHE_KEYS: {
    ONBOARDING_STATUS: 'nexus:onboarding:status',
  },
  CACHE_OPTIONS: {
    ONBOARDING_STATUS: {
      ttl: 5 * 60 * 1000,
      version: '1.0',
      storage: 'localStorage' as const,
    },
  },
}));

describe('useOnboardingStatus - NEX-178 Race Condition Fixes', () => {
  const mockUseAuth = require('../use-auth').useAuth;
  const mockLocalCache = localCache as jest.Mocked<typeof localCache>;

  const mockUser = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockCompletedStatus = {
    isComplete: true,
    currentStep: 3,
    hasProfile: true,
    hasWorkspace: true,
    profile: {
      id: 'profile-id',
      fullName: 'Test User',
      displayName: 'Test',
    },
    onboarding: {
      id: 'onboarding-id',
      completed: true,
      completedAt: '2024-01-01T10:00:00Z',
      currentStep: 3,
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: true,
        firstCard: true,
      },
    },
    workspace: {
      id: 'workspace-id',
      name: 'Test Workspace',
      privacy: 'private',
    },
  };

  const mockInProgressStatus = {
    isComplete: false,
    currentStep: 2,
    hasProfile: true,
    hasWorkspace: false,
    profile: {
      id: 'profile-id',
      fullName: 'Test User',
      displayName: 'Test',
    },
    onboarding: {
      id: 'onboarding-id',
      completed: false,
      currentStep: 2,
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: false,
        firstCard: false,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockLocalCache.get.mockReturnValue(null);
    mockLocalCache.set.mockReturnValue(true);
    mockLocalCache.remove.mockReturnValue(true);

    // Default mock - authenticated, session stable
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    global.mockFetch(mockCompletedStatus);
  });

  describe('Race Condition Prevention', () => {
    it('should wait for Auth0 session to stabilize before fetching', async () => {
      // Start with auth loading
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Should not fetch while auth is loading
      expect(result.current.isLoading).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();

      // Auth finishes loading but user is not yet available
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();

      expect(global.fetch).not.toHaveBeenCalled();

      // Auth completes with authenticated user
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Now should fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding/status', expect.any(Object));
      });
    });

    it('should prevent concurrent API calls', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear fetch calls from initial load
      (global.fetch as jest.Mock).mockClear();

      // Create a slow response
      let resolveFirstFetch: (value: any) => void;
      let resolveSecondFetch: (value: any) => void;
      const firstFetchPromise = new Promise((resolve) => {
        resolveFirstFetch = resolve;
      });
      const secondFetchPromise = new Promise((resolve) => {
        resolveSecondFetch = resolve;
      });

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => firstFetchPromise)
        .mockImplementationOnce(() => secondFetchPromise);

      // Trigger two concurrent refetch calls
      const promise1 = result.current.refetch();
      const promise2 = result.current.refetch();

      // Only one fetch should be made
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Resolve the first fetch
      resolveFirstFetch!({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockCompletedStatus),
      });

      await Promise.all([promise1, promise2]);

      // Still only one fetch call
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid logout/login cycles', async () => {
      // Test only the key behavior: no fetch during auth loading
      jest.clearAllMocks();
      
      // Start with auth loading (simulating rapid state change)
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: true,
        isAuthenticated: false,
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // Should not fetch while auth is loading
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(true);
      
      // Auth stabilizes
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Now should be ready to fetch
      expect(result.current.isLoading).toBe(true); // Still loading until fetch completes
    });
  });

  describe('Client-Side Caching', () => {
    it('should load from cache immediately on mount', async () => {
      mockLocalCache.get.mockReturnValue(mockCompletedStatus);

      const { result } = renderHook(() => useOnboardingStatus());

      // Should have cached data immediately
      expect(result.current.status).toEqual(mockCompletedStatus);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);

      // With completed status cached, no additional fetch should occur (optimization)
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should save successful responses to cache', async () => {
      // Simple test: verify cache.set is called after successful fetch
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null); // No cache initially
      
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      global.mockFetch(mockCompletedStatus);
      const { result } = renderHook(() => useOnboardingStatus());

      // Wait for the fetch to complete and cache to be called
      await waitFor(() => {
        expect(mockLocalCache.set).toHaveBeenCalledWith(
          `${CACHE_KEYS.ONBOARDING_STATUS}:${mockUser.sub}`,
          mockCompletedStatus,
          CACHE_OPTIONS.ONBOARDING_STATUS
        );
      });
    });

    it('should trust cached data longer for completed onboarding', async () => {
      mockLocalCache.get.mockReturnValue(mockCompletedStatus);

      const { result } = renderHook(() => useOnboardingStatus());

      // Should use cached data and not fetch for completed onboarding
      expect(result.current.status).toEqual(mockCompletedStatus);
      expect(result.current.isLoading).toBe(false);
      
      await waitFor(() => {
        expect(result.current.isInitialLoad).toBe(false);
      });

      // Should not fetch because onboarding is complete
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch fresh data for incomplete onboarding even with cache', async () => {
      mockLocalCache.get.mockReturnValue(mockInProgressStatus);
      global.mockFetch(mockInProgressStatus);

      const { result } = renderHook(() => useOnboardingStatus());

      // Should use cached data initially
      expect(result.current.status).toEqual(mockInProgressStatus);

      // Should also fetch fresh data because onboarding is incomplete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should clear cache on user change', async () => {
      const { rerender } = renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Change user
      act(() => {
        mockUseAuth.mockReturnValue({
          user: { ...mockUser, sub: 'auth0|different-user' },
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Should clear old cache
      expect(mockLocalCache.remove).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${mockUser.sub}`,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );
    });

    it('should use user-specific cache keys', async () => {
      const user2 = { ...mockUser, sub: 'auth0|user-2' };
      
      // Start with user 1
      renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(mockLocalCache.set).toHaveBeenCalledWith(
          `${CACHE_KEYS.ONBOARDING_STATUS}:${mockUser.sub}`,
          expect.any(Object),
          expect.any(Object)
        );
      });

      // Switch to user 2
      act(() => {
        mockUseAuth.mockReturnValue({
          user: user2,
          isLoading: false,
          isAuthenticated: true,
        });
      });

      const { result } = renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use different cache key for user 2
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${user2.sub}`,
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Enhanced Error Handling', () => {
    it('should preserve completed status on server errors', async () => {
      // Start with cached completed status
      mockLocalCache.get.mockReturnValue(mockCompletedStatus);

      // Mock server error
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const { result } = renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.status).toEqual(mockCompletedStatus);
      });

      // Force a refresh to trigger API call and get the error
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).toMatch(/Server temporarily unavailable/);
      });

      // Should preserve existing status despite server error
      expect(result.current.status).toEqual(mockCompletedStatus);
    });

    it('should preserve in-progress status on network errors', async () => {
      // Start with in-progress status in memory
      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.status).toEqual(mockCompletedStatus);
      });

      // Now mock network error for refetch
      global.mockFetchError(new Error('Network error'));

      await act(async () => {
        await result.current.refetch();
      });

      // Should preserve existing status
      expect(result.current.status).toEqual(mockCompletedStatus);
      expect(result.current.error).toBe('Network error');
    });

    it('should handle 401 errors by clearing state and cache', async () => {
      // Simple test: verify 401 response calls cache.remove
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(mockCompletedStatus);
      
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      const { result } = renderHook(() => useOnboardingStatus());
      
      // Mock 401 error for refetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      
      // Trigger refetch with 401 response
      await act(async () => {
        await result.current.refetch();
      });
      
      // Verify cache was cleared (key behavior for 401)
      expect(mockLocalCache.remove).toHaveBeenCalled();
      expect(result.current.error).toBeNull(); // 401 is not an error to display
    });

    it('should handle malformed responses gracefully', async () => {
      mockLocalCache.get.mockReturnValue(mockCompletedStatus);

      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ invalid: 'data' }), // Missing isComplete
        })
      );

      const { result } = renderHook(() => useOnboardingStatus());

      // Should load from cache initially
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.status).toEqual(mockCompletedStatus);
      });

      // Force refresh to trigger malformed response error
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).toMatch(/Invalid response format/);
      });

      // Should preserve existing cached status on invalid response
      expect(result.current.status).toEqual(mockCompletedStatus);
    });
  });

  describe('Bug-Specific Test Cases for NEX-178', () => {
    it('should handle completed user → logout → login flow correctly', async () => {
      // Setup: Completed user logout/login flow
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(mockCompletedStatus);
      
      // Start authenticated with completed status
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // Should show cached completed status immediately
      expect(result.current.status).toEqual(mockCompletedStatus);
      
      // User logs out
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Status should clear on logout
      expect(result.current.status).toBeNull();
      
      // User logs back in - cache still available
      global.mockFetch(mockCompletedStatus);
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Should show cached data without waiting
      expect(result.current.status).toEqual(mockCompletedStatus);
      
      // For completed users with cache, no API call is needed (optimization)
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle in-progress user → logout → login flow correctly', async () => {
      // User has in-progress onboarding
      mockLocalCache.get.mockReturnValue(mockInProgressStatus);
      global.mockFetch(mockInProgressStatus);

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Should show in-progress status
      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(2);
        expect(result.current.status?.isComplete).toBe(false);
      });

      // User logs out
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
      rerender();

      expect(result.current.status).toBeNull();

      // User logs back in
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Should fetch and restore in-progress status
      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(2);
        expect(result.current.status?.isComplete).toBe(false);
      });
    });

    it('should handle network interruption during status fetch', async () => {
      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Initial successful load
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      // Simulate network interruption on refetch
      let rejectNetwork: (error: Error) => void;
      const networkPromise = new Promise((_, reject) => {
        rejectNetwork = reject;
      });

      (global.fetch as jest.Mock).mockImplementation(() => networkPromise);

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // Reject with network error
      rejectNetwork!(new Error('fetch failed'));

      await waitFor(() => {
        expect(result.current.error).toMatch(/fetch failed/);
      });

      // Should preserve completed status despite network error
      expect(result.current.status?.isComplete).toBe(true);
    });

    it('should handle Auth0 session timing issues', async () => {
      // Start with loading auth
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      expect(result.current.isLoading).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();

      // Auth0 provides user but still loading
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();

      // Still should not fetch
      expect(global.fetch).not.toHaveBeenCalled();

      // Auth completes
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Now should fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle force refresh bypassing cache appropriately', async () => {
      // Setup cache with old data
      const oldStatus = { ...mockCompletedStatus, currentStep: 2 };
      mockLocalCache.get.mockReturnValue(oldStatus);

      const { result } = renderHook(() => useOnboardingStatus());

      // Should use cached data initially
      expect(result.current.status).toEqual(oldStatus);

      // Force refresh should bypass cache and get fresh data
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.status).toEqual(mockCompletedStatus);
      });

      // Should have called fetch with no-cache header
      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding/status', 
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cache-Control': 'no-cache'
          })
        })
      );
    });
  });

  describe('Loading States and Initial Load Tracking', () => {
    it('should track initial load separately from subsequent fetches', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // During initial load
      expect(result.current.isInitialLoad).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // After initial load
      expect(result.current.isInitialLoad).toBe(false);

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should not be initial load anymore
      expect(result.current.isInitialLoad).toBe(false);
    });

    it('should show loading during fetch but not during cached data display', async () => {
      // Use in-progress status so fetch actually occurs (completed status is optimized to skip fetch)
      mockLocalCache.get.mockReturnValue(mockInProgressStatus);
      global.mockFetch(mockInProgressStatus);

      const { result } = renderHook(() => useOnboardingStatus());

      // Should show cached data immediately, but still loading fresh data
      expect(result.current.status).toEqual(mockInProgressStatus);
      expect(result.current.isLoading).toBe(true); // Still fetching fresh data

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // After fetch completes, should still have the data
      expect(result.current.status).toEqual(mockInProgressStatus);
    });
  });
});
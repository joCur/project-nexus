import { renderHook, waitFor, act } from '@testing-library/react';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { localCache, CACHE_KEYS, CACHE_OPTIONS } from '@/lib/client-cache';

// Mock dependencies
jest.mock('@/hooks/use-auth');
jest.mock('@/lib/client-cache');

// Mock fetch globally
global.fetch = jest.fn();

/**
 * Integration tests for NEX-178 - Onboarding Flow Logout/Login Race Conditions
 * 
 * These tests simulate real user scenarios where onboarding state needs to persist
 * correctly through authentication cycles and network interruptions.
 */
describe('Onboarding Logout/Login Flow Integration Tests - NEX-178', () => {
  const mockUseAuth = require('@/hooks/use-auth').useAuth;
  const mockLocalCache = localCache as jest.Mocked<typeof localCache>;

  // Test users
  const completedUser = {
    sub: 'auth0|completed-user-123',
    email: 'completed@example.com',
    name: 'Completed User',
  };

  const inProgressUser = {
    sub: 'auth0|inprogress-user-456',
    email: 'inprogress@example.com',
    name: 'In Progress User',
  };

  const newUser = {
    sub: 'auth0|new-user-789',
    email: 'new@example.com',
    name: 'New User',
  };

  // Test data
  const completedOnboardingStatus = {
    isComplete: true,
    currentStep: 3,
    hasProfile: true,
    hasWorkspace: true,
    profile: {
      id: 'profile-123',
      fullName: 'Completed User',
      displayName: 'Completed',
    },
    onboarding: {
      id: 'onboarding-123',
      completed: true,
      completedAt: '2024-01-01T12:00:00Z',
      currentStep: 3,
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: true,
        firstCard: true,
      },
    },
    workspace: {
      id: 'workspace-123',
      name: 'My Workspace',
      privacy: 'private',
    },
  };

  const inProgressOnboardingStatus = {
    isComplete: false,
    currentStep: 2,
    hasProfile: true,
    hasWorkspace: false,
    profile: {
      id: 'profile-456',
      fullName: 'In Progress User',
      displayName: 'Progress',
    },
    onboarding: {
      id: 'onboarding-456',
      completed: false,
      currentStep: 2,
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: false,
        firstCard: false,
      },
    },
  };

  const newUserOnboardingStatus = {
    isComplete: false,
    currentStep: 1,
    hasProfile: false,
    hasWorkspace: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    
    // Default cache mocks
    mockLocalCache.get.mockReturnValue(null);
    mockLocalCache.set.mockReturnValue(true);
    mockLocalCache.remove.mockReturnValue(true);

    // Default auth state - logged out
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Completed User Logout/Login Flow', () => {
    it('should maintain completed status through logout/login cycle', async () => {
      // Setup: Start with fresh state
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null);
      
      // Step 1: User is authenticated with completed onboarding
      mockUseAuth.mockReturnValue({
        user: completedUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.status?.isComplete).toBe(true);
      });
      
      // Verify cache was set
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        expect.stringContaining(completedUser.sub),
        expect.objectContaining({ isComplete: true }),
        expect.any(Object)
      );
      
      // Step 2: User logs out
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Status should clear immediately on logout
      expect(result.current.status).toBeNull();
      expect(result.current.isLoading).toBe(false);
      
      // Step 3: Same user logs back in - cache should be used
      mockLocalCache.get.mockReturnValue(completedOnboardingStatus);
      (global.fetch as jest.Mock).mockClear(); // Clear to track new calls
      
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Should show cached data without loading
      expect(result.current.status).toEqual(completedOnboardingStatus);
      expect(result.current.isLoading).toBe(false);
      
      // No new API call for completed users (cache optimization)
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle server errors while preserving completed status', async () => {
      // Start with cached completed status
      mockLocalCache.get.mockReturnValue(completedOnboardingStatus);

      // User is logged in
      mockUseAuth.mockReturnValue({
        user: completedUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // Should show cached data
      expect(result.current.status).toEqual(completedOnboardingStatus);

      // Force refresh with server error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await act(async () => {
        await result.current.refetch();
      });

      // Should preserve completed status despite server error
      expect(result.current.status).toEqual(completedOnboardingStatus);
      expect(result.current.error).toMatch(/Server temporarily unavailable/);
    });

    it('should handle network interruptions gracefully for completed users', async () => {
      // Setup: User with completed status encounters network issues
      jest.clearAllMocks();
      
      // Step 1: User is authenticated but network fails initially
      mockLocalCache.get.mockReturnValue(null); // No cache yet
      mockUseAuth.mockReturnValue({
        user: completedUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      // Network failure on first attempt
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => useOnboardingStatus());
      
      // Wait for error state
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
      
      // Should show default incomplete status when no cache and network fails
      expect(result.current.status).toEqual({
        isComplete: false,
        currentStep: 1,
        hasProfile: false,
        hasWorkspace: false,
      });
      
      // Step 2: Network recovers - refetch succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });
      
      await act(async () => {
        await result.current.refetch();
      });
      
      // Should now have completed status
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.error).toBeNull();
      
      // Step 3: Subsequent network error should preserve completed status
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await act(async () => {
        await result.current.refetch();
      });
      
      // Should still show completed status despite network error
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('In-Progress User Logout/Login Flow', () => {
    it('should resume from correct step after logout/login', async () => {
      // Setup: In-progress user at step 2
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null);
      
      // Step 1: User with in-progress onboarding logs in
      mockUseAuth.mockReturnValue({
        user: inProgressUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Verify correct step
      expect(result.current.status?.currentStep).toBe(2);
      expect(result.current.status?.isComplete).toBe(false);
      
      // Step 2: User logs out
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Status should clear
      expect(result.current.status).toBeNull();
      
      // Step 3: User logs back in - should resume at correct step
      mockLocalCache.get.mockReturnValue(inProgressOnboardingStatus);
      (global.fetch as jest.Mock).mockClear();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });
      
      act(() => {
        mockUseAuth.mockReturnValue({
          user: inProgressUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Should show cached step 2 immediately
      expect(result.current.status?.currentStep).toBe(2);
      expect(result.current.status?.hasProfile).toBe(true);
      expect(result.current.status?.hasWorkspace).toBe(false);
      
      // For in-progress users, should also fetch fresh data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
      
      // Status should still be at step 2 after fresh fetch
      expect(result.current.status?.currentStep).toBe(2);
    });

    it('should handle progress updates during unstable network', async () => {
      // Setup: User at step 2 with unstable network
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null);
      
      mockUseAuth.mockReturnValue({
        user: inProgressUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      // Initial fetch succeeds - user at step 2
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });
      
      const { result } = renderHook(() => useOnboardingStatus());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Verify initial step
      expect(result.current.status?.currentStep).toBe(2);
      expect(result.current.status?.hasWorkspace).toBe(false);
      
      // User progresses to step 3 server-side but network fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await act(async () => {
        await result.current.refetch();
      });
      
      // Should preserve current progress (step 2) during network error
      expect(result.current.status?.currentStep).toBe(2);
      expect(result.current.error).toBe('Network error');
      
      // Network recovers - server returns updated progress (step 3)
      const updatedStatus = {
        ...inProgressOnboardingStatus,
        currentStep: 3,
        hasWorkspace: true,
        workspace: {
          id: 'workspace-456',
          name: 'Progress Workspace',
          privacy: 'private',
        },
        onboarding: {
          ...inProgressOnboardingStatus.onboarding,
          currentStep: 3,
          tutorialProgress: {
            profileSetup: true,
            workspaceIntro: true,
            firstCard: false,
          },
        },
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedStatus),
      });
      
      await act(async () => {
        await result.current.refetch();
      });
      
      // Should now reflect updated progress
      expect(result.current.status?.currentStep).toBe(3);
      expect(result.current.status?.hasWorkspace).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('New User First-Time Experience', () => {
    it('should handle new user onboarding initiation correctly', async () => {
      // Setup: Brand new user with no onboarding history
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null);
      
      mockUseAuth.mockReturnValue({
        user: newUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      // API returns initial status for new user
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(newUserOnboardingStatus),
      });
      
      const { result } = renderHook(() => useOnboardingStatus());
      
      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // New user should start at step 1
      expect(result.current.status?.currentStep).toBe(1);
      expect(result.current.status?.isComplete).toBe(false);
      expect(result.current.status?.hasProfile).toBe(false);
      expect(result.current.status?.hasWorkspace).toBe(false);
      
      // Should have cached the initial state
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        expect.stringContaining(newUser.sub),
        expect.objectContaining({
          currentStep: 1,
          isComplete: false,
        }),
        expect.any(Object)
      );
      
      // API should have been called once for initial load
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle new user with backend delays', async () => {
      // User logs in but backend is slow
      mockUseAuth.mockReturnValue({
        user: newUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // Simulate slow backend response
      let resolveResponse: (value: any) => void;
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValue(responsePromise);

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve after delay
      resolveResponse!({
        ok: true,
        status: 200,
        json: () => Promise.resolve(newUserOnboardingStatus),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.status?.currentStep).toBe(1);
      });
    });
  });

  describe('Cross-User Contamination Prevention', () => {
    it('should not leak onboarding status between different users', async () => {
      // Setup: Test user isolation
      jest.clearAllMocks();
      
      // Step 1: User 1 (completed) is logged in with cached data
      mockLocalCache.get.mockReturnValue(completedOnboardingStatus);
      mockUseAuth.mockReturnValue({
        user: completedUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // User 1 should see their completed status
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.status?.currentStep).toBe(3);
      
      // Step 2: User 1 logs out completely
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Status should be null when logged out
      expect(result.current.status).toBeNull();
      
      // Step 3: Different user (User 2) logs in
      // Critical: Clear cache mock to simulate different user
      mockLocalCache.get.mockReturnValue(null);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });
      
      act(() => {
        mockUseAuth.mockReturnValue({
          user: inProgressUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Wait for User 2's data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.status).not.toBeNull();
      });
      
      // User 2 should see their own in-progress status, not User 1's completed status
      expect(result.current.status?.currentStep).toBe(2);
      expect(result.current.status?.isComplete).toBe(false);
      expect(result.current.status?.hasProfile).toBe(true);
      expect(result.current.status?.hasWorkspace).toBe(false);
      
      // Verify no data leak from User 1
      expect(result.current.status?.workspace).toBeUndefined();
    });

    it('should use correct cache keys for different users', async () => {
      // Setup: Test cache isolation between users
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null);
      
      // Step 1: User 1 (completed) loads their data
      mockUseAuth.mockReturnValue({
        user: completedUser,
        isLoading: false,
        isAuthenticated: true,
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Verify User 1's cache key
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${completedUser.sub}`,
        completedOnboardingStatus,
        expect.any(Object)
      );
      
      // Step 2: Switch to User 2 without logout
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null); // No cache for new user
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });
      
      act(() => {
        mockUseAuth.mockReturnValue({
          user: inProgressUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(2);
      });
      
      // Verify User 2 uses a different cache key
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${inProgressUser.sub}`,
        inProgressOnboardingStatus,
        expect.any(Object)
      );
      
      // Verify the cache keys are different
      expect(completedUser.sub).not.toBe(inProgressUser.sub);
      expect(`${CACHE_KEYS.ONBOARDING_STATUS}:${completedUser.sub}`).not.toBe(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${inProgressUser.sub}`
      );
    });
  });

  describe('Auth0 Session Race Conditions', () => {
    it('should handle Auth0 session timing edge cases', async () => {
      // Setup: Test Auth0 session stabilization
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null);
      
      // Phase 1: Auth0 is loading (common on page refresh)
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // Should be loading, no API calls yet
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Phase 2: Auth0 found user but still validating
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Still loading, no API calls (session not stable)
      expect(result.current.isLoading).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Phase 3: Auth0 session fully validated
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });
      
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Now should fetch with stable session
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.current.status?.isComplete).toBe(true);
    });

    it('should handle rapid Auth0 state changes', async () => {
      // Setup: Test resilience to Auth0 state flapping
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(null);
      
      // Start with initial loading state
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // Rapid state changes (simulating Auth0 instability)
      // Change 1: User appears but still loading
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Change 2: User disappears (Auth0 re-checking)
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Change 3: User back but still loading
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // No API calls should have been made yet
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Final stable state
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });
      
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Should make exactly one API call after stabilization
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.status?.isComplete).toBe(true);
      });
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle Auth0 session restoration with cached data', async () => {
      // Setup: Cached data exists from previous session
      jest.clearAllMocks();
      mockLocalCache.get.mockReturnValue(completedOnboardingStatus);
      
      // Phase 1: Page refresh, Auth0 is loading
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });
      
      const { result, rerender } = renderHook(() => useOnboardingStatus());
      
      // No status yet (waiting for auth)
      expect(result.current.status).toBeNull();
      expect(result.current.isLoading).toBe(true);
      
      // Phase 2: Auth0 finds user but still validating
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();
      
      // Shows cached data while auth is still loading (optimization)
      expect(result.current.status).toEqual(completedOnboardingStatus);
      expect(result.current.isLoading).toBe(true);
      
      // Phase 3: Auth0 completes validation
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();
      
      // Should immediately show cached data (no loading)
      expect(result.current.status).toEqual(completedOnboardingStatus);
      expect(result.current.isLoading).toBe(false);
      
      // For completed users with cache, no API call needed
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
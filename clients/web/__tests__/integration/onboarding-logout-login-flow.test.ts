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
      // Start logged out
      const { result, rerender } = renderHook(() => useOnboardingStatus());

      expect(result.current.status).toBeNull();
      expect(result.current.isLoading).toBe(false);

      // User logs in - Auth0 session loading
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();

      expect(result.current.isLoading).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();

      // Auth0 session completes - user appears
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });

      // Should fetch onboarding status
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding/status', expect.any(Object));
      });

      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });

      // Verify caching
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${completedUser.sub}`,
        completedOnboardingStatus,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );

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

      // User logs back in - should use cached data initially
      mockLocalCache.get.mockReturnValue(completedOnboardingStatus);

      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Should show cached data immediately
      expect(result.current.status).toEqual(completedOnboardingStatus);

      // Should NOT fetch fresh data for completed onboarding (trusted cache)
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not make additional API calls for completed status
      expect(global.fetch).toHaveBeenCalledTimes(1);
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
      // Start with auth loading
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // User becomes available but network fails
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Mock network failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Should show default status (not completed since no cache)
      expect(result.current.status?.isComplete).toBe(false);

      // Network recovers
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });

      await act(async () => {
        await result.current.refetch();
      });

      // Should now show completed status
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('In-Progress User Logout/Login Flow', () => {
    it('should resume from correct step after logout/login', async () => {
      // User logs in
      mockUseAuth.mockReturnValue({
        user: inProgressUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Mock API response for in-progress
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });

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

      // User logs back in - should fetch fresh data for incomplete onboarding
      mockLocalCache.get.mockReturnValue(inProgressOnboardingStatus);

      act(() => {
        mockUseAuth.mockReturnValue({
          user: inProgressUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Should show cached data initially
      expect(result.current.status).toEqual(inProgressOnboardingStatus);

      // Should also fetch fresh data (incomplete onboarding needs updates)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle progress updates during unstable network', async () => {
      // User is logged in with in-progress onboarding
      mockUseAuth.mockReturnValue({
        user: inProgressUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // Initial load succeeds
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });

      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(2);
      });

      // User completes a step - API call fails
      const updatedStatus = {
        ...inProgressOnboardingStatus,
        currentStep: 3,
        onboarding: {
          ...inProgressOnboardingStatus.onboarding!,
          currentStep: 3,
          tutorialProgress: {
            ...inProgressOnboardingStatus.onboarding!.tutorialProgress,
            workspaceIntro: true,
          },
        },
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await act(async () => {
        await result.current.refetch();
      });

      // Should preserve existing progress
      expect(result.current.status?.currentStep).toBe(2);
      expect(result.current.error).toBe('Update failed');

      // Network recovers - should get updated status
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updatedStatus),
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.status?.currentStep).toBe(3);
      expect(result.current.error).toBeNull();
    });
  });

  describe('New User First-Time Experience', () => {
    it('should handle new user onboarding initiation correctly', async () => {
      // New user logs in for first time
      mockUseAuth.mockReturnValue({
        user: newUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // API returns new user status
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(newUserOnboardingStatus),
      });

      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(1);
        expect(result.current.status?.isComplete).toBe(false);
        expect(result.current.status?.hasProfile).toBe(false);
      });

      // Should cache the initial status
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${newUser.sub}`,
        newUserOnboardingStatus,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );
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
      // User 1 (completed) logs in
      mockLocalCache.get.mockReturnValue(completedOnboardingStatus);
      mockUseAuth.mockReturnValue({
        user: completedUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      expect(result.current.status).toEqual(completedOnboardingStatus);

      // User 1 logs out
      act(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
      rerender();

      expect(result.current.status).toBeNull();

      // User 2 (in-progress) logs in
      mockLocalCache.get.mockReturnValue(null); // Different user, no cache

      act(() => {
        mockUseAuth.mockReturnValue({
          user: inProgressUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });

      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(2);
        expect(result.current.status?.isComplete).toBe(false);
      });

      // Should not have any trace of User 1's completed status
      expect(result.current.status?.workspace).toBeUndefined();
    });

    it('should use correct cache keys for different users', async () => {
      // User 1 session
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

      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      expect(mockLocalCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${completedUser.sub}`,
        completedOnboardingStatus,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );

      // Switch to User 2
      act(() => {
        mockUseAuth.mockReturnValue({
          user: inProgressUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(inProgressOnboardingStatus),
      });

      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(2);
      });

      // Should use different cache key for User 2
      expect(mockLocalCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${inProgressUser.sub}`,
        inProgressOnboardingStatus,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );
    });
  });

  describe('Auth0 Session Race Conditions', () => {
    it('should handle Auth0 session timing edge cases', async () => {
      // Simulate Auth0 session restoration timing issues
      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Initial state - Auth0 loading
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });
      rerender();

      expect(result.current.isLoading).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();

      // Auth0 provides user but authentication still processing
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();

      // Should still not fetch
      expect(global.fetch).not.toHaveBeenCalled();

      // Authentication completes
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });

      // Now should fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        expect(result.current.status?.isComplete).toBe(true);
      });
    });

    it('should handle rapid Auth0 state changes', async () => {
      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Rapid state changes simulating Auth0 session restoration issues
      const stateChanges = [
        { user: null, isLoading: true, isAuthenticated: false },
        { user: completedUser, isLoading: true, isAuthenticated: false },
        { user: null, isLoading: true, isAuthenticated: false },
        { user: completedUser, isLoading: false, isAuthenticated: true },
      ];

      for (const state of stateChanges) {
        act(() => {
          mockUseAuth.mockReturnValue(state);
        });
        rerender();
      }

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completedOnboardingStatus),
      });

      // Should stabilize and fetch only once
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle Auth0 session restoration with cached data', async () => {
      // Start with cached data available
      mockLocalCache.get.mockReturnValue(completedOnboardingStatus);

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Auth0 session restoring
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });
      rerender();

      expect(result.current.status).toBeNull(); // No user yet

      // User appears during session restoration
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: true,
          isAuthenticated: false,
        });
      });
      rerender();

      // Should still not show cached data until auth completes
      expect(result.current.status).toBeNull();

      // Auth completes
      act(() => {
        mockUseAuth.mockReturnValue({
          user: completedUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Should show cached data immediately
      expect(result.current.status).toEqual(completedOnboardingStatus);
    });
  });
});
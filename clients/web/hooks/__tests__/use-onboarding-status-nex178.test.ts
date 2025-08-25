import { renderHook, waitFor, act } from '@testing-library/react';
import { useOnboardingStatus } from '../use-onboarding-status';

// Mock useAuth hook
jest.mock('../use-auth', () => ({
  useAuth: jest.fn(),
}));

/**
 * Focused tests for NEX-178 - Race Condition Fixes
 * 
 * These tests validate that the specific bugs fixed in NEX-178 work correctly:
 * - Users who completed onboarding don't see it again after logout/login
 * - Race conditions are prevented with Auth0 session dependency
 * - Client-side caching persists onboarding status correctly
 */
describe('useOnboardingStatus - NEX-178 Race Condition Fixes', () => {
  const mockUseAuth = require('../use-auth').useAuth;

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

    // Default mock - authenticated, session stable
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
    });

    // Default successful response
    global.mockFetch(mockCompletedStatus);
  });

  describe('Core NEX-178 Bug Scenarios', () => {
    it('should wait for Auth0 session to stabilize before making API calls', async () => {
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

      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle completed user logout/login flow without showing onboarding again', async () => {
      // Start with authenticated user
      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
        expect(result.current.isLoading).toBe(false);
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

      // User logs back in (simulating session restoration)
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Should fetch again and show completed status
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      // Verify the user sees the workspace, not onboarding
      expect(result.current.status?.workspace).toBeDefined();
      expect(result.current.status?.onboarding?.completed).toBe(true);
    });

    it('should handle in-progress user logout/login flow correctly', async () => {
      // Mock in-progress response
      global.mockFetch(mockInProgressStatus);

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      // Wait for initial load
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

      // Should resume from step 2, not restart
      await waitFor(() => {
        expect(result.current.status?.currentStep).toBe(2);
        expect(result.current.status?.isComplete).toBe(false);
      });
    });

    it('should preserve completed status during server errors', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // Initial successful load
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      // Mock server error on refetch
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      // Force refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should preserve the existing completed status
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.error).toMatch(/Server temporarily unavailable/);
    });

    it('should handle network errors without resetting completed status', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // Initial successful load
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      // Mock network error on refetch
      global.mockFetchError(new Error('Network error'));

      // Force refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should preserve existing status on network error
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.error).toBe('Network error');
    });

    it('should handle Auth0 session timing edge cases', async () => {
      // Simulate Auth0 session restoration timing issues
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      expect(result.current.isLoading).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();

      // Auth0 provides user but authentication still processing
      act(() => {
        mockUseAuth.mockReturnValue({
          user: mockUser,
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
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });
      });
      rerender();

      // Now should fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        expect(result.current.status?.isComplete).toBe(true);
      });
    });

    it('should prevent concurrent API calls during rapid refetch', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear fetch calls from initial load
      (global.fetch as jest.Mock).mockClear();

      // Create a slow response to test concurrency
      let resolveResponse: (value: any) => void;
      const slowPromise = new Promise((resolve) => {
        resolveResponse = resolve;
      });

      (global.fetch as jest.Mock).mockImplementation(() => slowPromise);

      // Trigger multiple concurrent refetch calls
      const promise1 = result.current.refetch();
      const promise2 = result.current.refetch();
      const promise3 = result.current.refetch();

      // Should only make one API call
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Resolve the response
      resolveResponse!({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockCompletedStatus),
      });

      await Promise.all([promise1, promise2, promise3]);

      // Should still only have made one call
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
    });

    it('should handle 401 errors by clearing state', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // Initial successful load
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      // Mock 401 error on refetch
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      // Force refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should clear state on 401
      expect(result.current.status).toBeNull();
    });

    it('should handle malformed API responses gracefully', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // Initial successful load
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      // Mock invalid response on refetch
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ invalid: 'data' }), // Missing isComplete
        })
      );

      // Force refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should preserve existing status on invalid response
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.error).toMatch(/Invalid response format/);
    });
  });

  describe('Caching Behavior', () => {
    it('should handle unauthenticated state without errors', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useOnboardingStatus());

      expect(result.current.status).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should track initial load state correctly', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // During initial load
      expect(result.current.isInitialLoad).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // After initial load
      expect(result.current.isInitialLoad).toBe(false);

      // After refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should not be initial load anymore
      expect(result.current.isInitialLoad).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary network issues', async () => {
      const { result } = renderHook(() => useOnboardingStatus());

      // Initial successful load
      await waitFor(() => {
        expect(result.current.status?.isComplete).toBe(true);
      });

      // Simulate network failure
      global.mockFetchError(new Error('Network timeout'));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe('Network timeout');
      expect(result.current.status?.isComplete).toBe(true); // Preserved

      // Network recovers
      global.mockFetch(mockCompletedStatus);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.status?.isComplete).toBe(true);
    });

    it('should provide default status for new users on error', async () => {
      // Mock network error from the start
      global.mockFetchError(new Error('API down'));

      const { result } = renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should show default incomplete status
      expect(result.current.status?.isComplete).toBe(false);
      expect(result.current.status?.currentStep).toBe(1);
      expect(result.current.error).toBe('API down');
    });
  });
});
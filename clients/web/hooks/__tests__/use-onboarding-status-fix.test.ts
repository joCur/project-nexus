/**
 * Test for the NEX-178 fix: Race condition and state management improvements
 * 
 * These tests verify the specific bug fixes:
 * 1. No API calls until Auth0 session is stable
 * 2. Client-side caching preserves state across refreshes
 * 3. Better error handling that doesn't reset completed status
 */

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
      storage: 'localStorage',
    },
  },
}));

describe('useOnboardingStatus - NEX-178 Bug Fixes', () => {
  const mockUseAuth = require('../use-auth').useAuth;
  const mockCache = localCache as jest.Mocked<typeof localCache>;
  
  const mockUser = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockOnboardingStatus = {
    isComplete: true,
    currentStep: 4,
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
      completedAt: '2024-01-01T00:00:00Z',
      currentStep: 4,
    },
    workspace: {
      id: 'workspace-id',
      name: 'My Workspace',
      privacy: 'private',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn();
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockReturnValue(true);
    mockCache.remove.mockReturnValue(true);
  });

  describe('Race Condition Prevention', () => {
    it('should not make API calls while auth is loading', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: true,
        isAuthenticated: false, // Still authenticating
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // Should be in loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isInitialLoad).toBe(true);
      expect(result.current.status).toBeNull();

      // Should not have made any API calls yet
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should wait for auth session to stabilize before fetching', async () => {
      // Start with loading auth
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      expect(result.current.isLoading).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();

      // Auth finishes loading and user is authenticated
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOnboardingStatus),
      });

      // Trigger re-render to simulate auth state change
      rerender();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding/status', {
        method: 'GET',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });
    });
  });

  describe('Client-side Caching', () => {
    it('should load from cache immediately to prevent flash', async () => {
      const cachedStatus = { ...mockOnboardingStatus };
      mockCache.get.mockReturnValue(cachedStatus);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // Should immediately load cached data
      expect(mockCache.get).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${mockUser.sub}`,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );

      // Should show cached status right away
      expect(result.current.status).toEqual(cachedStatus);
    });

    it('should cache successful API responses', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOnboardingStatus),
      });

      const { result } = renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(result.current.status).toEqual(mockOnboardingStatus);
      });

      // Should cache the successful response
      expect(mockCache.set).toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${mockUser.sub}`,
        mockOnboardingStatus,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );
    });
  });

  describe('Improved Error Handling', () => {
    it('should preserve cached completed status on server errors', async () => {
      const completedStatus = { ...mockOnboardingStatus, isComplete: true };
      mockCache.get.mockReturnValue(completedStatus);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      // Mock server error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // Should load from cache immediately (no error yet since no API call for completed status)
      await waitFor(() => {
        expect(result.current.status).toEqual(completedStatus);
      });
      
      // Force a refresh to trigger API call and get the error
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Should preserve the cached completed status despite the error
      expect(result.current.status).toEqual(completedStatus);
      expect(result.current.status?.isComplete).toBe(true);
      expect(result.current.error).toContain('Server temporarily unavailable');
    });

    it('should preserve cache during logout/login for same user (NEX-178 fix)', async () => {
      const completedStatus = { ...mockOnboardingStatus, isComplete: true };
      mockCache.get.mockReturnValue(completedStatus);

      // Start authenticated
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result, rerender } = renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(result.current.status).toEqual(completedStatus);
      });

      // Simulate logout - user becomes null but cache should not be cleared
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.status).toBeNull(); // State cleared but cache preserved
      });

      // Verify cache was NOT cleared for same user
      expect(mockCache.remove).not.toHaveBeenCalledWith(
        `${CACHE_KEYS.ONBOARDING_STATUS}:${mockUser.sub}`,
        CACHE_OPTIONS.ONBOARDING_STATUS
      );

      // Simulate login with same user
      mockCache.get.mockReturnValue(completedStatus); // Cache still has data
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      rerender();

      // Should load from cache immediately, preventing onboarding flash
      await waitFor(() => {
        expect(result.current.status).toEqual(completedStatus);
      });

      expect(result.current.status?.isComplete).toBe(true);
    });

    it('should return proper error codes for different failure types', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      // Test timeout error (not AbortError since we now ignore those)
      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Request timeout'), { name: 'TimeoutError' })
      );

      const { result } = renderHook(() => useOnboardingStatus());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toContain('timeout');
    });

    it('should not reset to incomplete for network errors if cache shows completed', async () => {
      const completedStatus = { ...mockOnboardingStatus, isComplete: true };
      mockCache.get.mockReturnValue(completedStatus);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error('fetch failed'));

      const { result } = renderHook(() => useOnboardingStatus());

      // Should load from cache immediately
      await waitFor(() => {
        expect(result.current.status).toEqual(completedStatus);
      });
      
      // Force a refresh to trigger API call and get the network error
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Should keep the cached completed status
      expect(result.current.status).toEqual(completedStatus);
      expect(result.current.status?.isComplete).toBe(true);
    });
  });

  describe('Force Refresh', () => {
    it('should bypass cache when refetch is called', async () => {
      const cachedStatus = { ...mockOnboardingStatus };
      mockCache.get.mockReturnValue(cachedStatus);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useOnboardingStatus());

      // Mock fresh API response
      const freshStatus = { ...mockOnboardingStatus, currentStep: 5 };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(freshStatus),
      });

      await act(async () => {
        await result.current.refetch();
      });

      // Should make API call with AbortSignal
      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding/status', {
        method: 'GET',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });

      expect(result.current.status).toEqual(freshStatus);
    });
  });
});
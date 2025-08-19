import { renderHook, waitFor } from '@testing-library/react';
import { useOnboardingStatus } from '../use-onboarding-status';

// Mock useAuth hook
jest.mock('../use-auth', () => ({
  useAuth: jest.fn(),
}));

describe('useOnboardingStatus', () => {
  const mockUseAuth = require('../use-auth').useAuth;
  
  const mockUser = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockOnboardingStatus = {
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
    
    // Default mock setup
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
    });
  });

  it('should return loading state initially', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: true, // Auth is still loading
    });

    const { result } = renderHook(() => useOnboardingStatus());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should fetch onboarding status successfully', async () => {
    global.mockFetch(mockOnboardingStatus);

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual(mockOnboardingStatus);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding/status', {
      method: 'GET',
      credentials: 'include',
    });
  });

  it('should return null when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle 401 unauthorized gracefully', async () => {
    global.mockFetch({}, false);
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })
    );

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle HTTP errors with error state', async () => {
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
    });

    expect(result.current.status).toEqual({
      isComplete: false,
      currentStep: 1,
      hasProfile: false,
      hasWorkspace: false,
    });
    expect(result.current.error).toBe('HTTP 500: Internal Server Error');
  });

  it('should handle network errors', async () => {
    global.mockFetchError(new Error('Network error'));

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual({
      isComplete: false,
      currentStep: 1,
      hasProfile: false,
      hasWorkspace: false,
    });
    expect(result.current.error).toBe('Network error');
  });

  it('should handle malformed JSON responses', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })
    );

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual({
      isComplete: false,
      currentStep: 1,
      hasProfile: false,
      hasWorkspace: false,
    });
    expect(result.current.error).toBe('Invalid JSON');
  });

  it('should refetch status when refetch is called', async () => {
    global.mockFetch(mockOnboardingStatus);

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Update mock response
    const updatedStatus = {
      ...mockOnboardingStatus,
      currentStep: 3,
      isComplete: true,
    };
    global.mockFetch(updatedStatus);

    // Call refetch
    await result.current.refetch();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    await waitFor(() => {
      expect(result.current.status).toEqual(updatedStatus);
    });
  });

  it('should not fetch when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
    });

    renderHook(() => useOnboardingStatus());

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should re-fetch when user changes', async () => {
    const firstUser = { ...mockUser, sub: 'auth0|user-1' };
    const secondUser = { ...mockUser, sub: 'auth0|user-2' };

    // Start with first user
    mockUseAuth.mockReturnValue({
      user: firstUser,
      isLoading: false,
    });

    global.mockFetch(mockOnboardingStatus);

    const { rerender } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Change to second user
    mockUseAuth.mockReturnValue({
      user: secondUser,
      isLoading: false,
    });

    const updatedStatus = { ...mockOnboardingStatus, currentStep: 3 };
    global.mockFetch(updatedStatus);

    rerender();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle complete onboarding status', async () => {
    const completeStatus = {
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
        completedAt: '2023-01-01T00:00:00Z',
        currentStep: 3,
        tutorialProgress: {
          profileSetup: true,
          workspaceIntro: true,
          firstCard: true,
        },
      },
      workspace: {
        id: 'workspace-id',
        name: 'My Workspace',
        privacy: 'private',
      },
    };

    global.mockFetch(completeStatus);

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual(completeStatus);
    expect(result.current.status?.isComplete).toBe(true);
    expect(result.current.status?.workspace).toBeDefined();
  });

  it('should handle empty onboarding status', async () => {
    const emptyStatus = {
      isComplete: false,
      currentStep: 1,
      hasProfile: false,
      hasWorkspace: false,
    };

    global.mockFetch(emptyStatus);

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual(emptyStatus);
    expect(result.current.status?.profile).toBeUndefined();
    expect(result.current.status?.onboarding).toBeUndefined();
    expect(result.current.status?.workspace).toBeUndefined();
  });

  it('should handle concurrent fetch requests', async () => {
    global.mockFetch(mockOnboardingStatus);

    const { result } = renderHook(() => useOnboardingStatus());

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear fetch calls from initial load
    (global.fetch as jest.Mock).mockClear();
    global.mockFetch(mockOnboardingStatus);

    // Trigger multiple refetch calls rapidly
    const promises = [
      result.current.refetch(),
      result.current.refetch(),
      result.current.refetch(),
    ];

    await Promise.all(promises);

    // Should handle concurrent requests gracefully
    expect(result.current.error).toBeNull();
    expect(result.current.status).toEqual(mockOnboardingStatus);
  });

  it('should maintain loading state during fetch', async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as jest.Mock).mockImplementation(() => pendingPromise);

    const { result } = renderHook(() => useOnboardingStatus());

    // Should be loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.status).toBeNull();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockOnboardingStatus),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual(mockOnboardingStatus);
  });

  it('should handle fetch cancellation', async () => {
    global.mockFetch(mockOnboardingStatus);

    const { result, unmount } = renderHook(() => useOnboardingStatus());

    // Unmount component before fetch completes
    unmount();

    // Should not cause any errors or state updates
    await waitFor(() => {
      // Component is unmounted, so we can't check result.current
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should handle partial onboarding data', async () => {
    const partialStatus = {
      isComplete: false,
      currentStep: 2,
      hasProfile: true,
      hasWorkspace: false,
      profile: {
        id: 'profile-id',
        fullName: 'Test User',
        // Missing displayName
      },
      // Missing onboarding object
      // Missing workspace object
    };

    global.mockFetch(partialStatus);

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual(partialStatus);
    expect(result.current.status?.onboarding).toBeUndefined();
    expect(result.current.status?.workspace).toBeUndefined();
  });

  it('should handle timeout scenarios', async () => {
    // Simulate a timeout after 30 seconds
    jest.useFakeTimers();
    
    let rejectPromise: (error: Error) => void;
    const timeoutPromise = new Promise((_, reject) => {
      rejectPromise = reject;
    });

    (global.fetch as jest.Mock).mockImplementation(() => timeoutPromise);

    const { result } = renderHook(() => useOnboardingStatus());

    expect(result.current.isLoading).toBe(true);

    // Fast-forward time and reject with timeout
    setTimeout(() => {
      rejectPromise!(new Error('Request timeout'));
    }, 30000);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Request timeout');
    
    jest.useRealTimers();
  });
});
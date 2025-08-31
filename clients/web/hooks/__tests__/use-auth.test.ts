import { renderHook, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth, useAuthState, useRequireAuth, Permissions, Roles } from '../use-auth';

// Mock Auth0 useUser hook
jest.mock('@auth0/nextjs-auth0/client', () => ({
  useUser: jest.fn(),
}));


// Mock utils
jest.mock('@/lib/utils', () => ({
  announceToScreenReader: jest.fn(),
}));

// Mock navigation utils
jest.mock('@/lib/navigation', () => ({
  navigationUtils: {
    navigateToUrl: jest.fn(),
    getCurrentUrl: jest.fn(() => ''),
  },
}));

describe('useAuth', () => {
  const mockUseUser = require('@auth0/nextjs-auth0/client').useUser;
  const mockAnnounceToScreenReader = require('@/lib/utils').announceToScreenReader;
  const mockNavigateToUrl = require('@/lib/navigation').navigationUtils.navigateToUrl;

  const mockAuth0User = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
        name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    updated_at: '2023-01-01T00:00:00Z',
    'https://api.nexus-app.de/roles': ['user', 'premium'],
    'https://api.nexus-app.de/permissions': ['read:cards', 'write:cards', 'read:workspaces'],
    'https://api.nexus-app.de/user_id': 'internal-user-id-123',
  };

  const expectedExtendedUser = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
        name: 'Test User',
    nickname: undefined,
    picture: 'https://example.com/avatar.jpg',
    updated_at: '2023-01-01T00:00:00Z',
    org_id: undefined,
    roles: ['user', 'premium'],
    permissions: ['read:cards', 'write:cards', 'read:workspaces'],
    internalUserId: 'internal-user-id-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default Auth0 user state
    mockUseUser.mockReturnValue({
      user: mockAuth0User,
      error: null,
      isLoading: false,
    });

    // Reset navigation mock
    mockNavigateToUrl.mockClear();
  });

  describe('Authentication State', () => {
    it('should return authenticated state when user is logged in', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.user).toEqual(expectedExtendedUser);
    });

    it('should return loading state', () => {
      mockUseUser.mockReturnValue({
        user: null,
        error: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
    });

    it('should return unauthenticated state', () => {
      mockUseUser.mockReturnValue({
        user: null,
        error: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should return error state', () => {
      const authError = new Error('Authentication failed');
      mockUseUser.mockReturnValue({
        user: null,
        error: authError,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe(authError);
      expect(result.current.user).toBeNull();
    });

    it('should handle user without custom claims', () => {
      const userWithoutClaims = {
        sub: 'auth0|test-user-id',
        email: 'test@example.com',
                name: 'Test User',
      };

      mockUseUser.mockReturnValue({
        user: userWithoutClaims,
        error: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual({
        ...userWithoutClaims,
        roles: [],
        permissions: [],
        internalUserId: undefined,
      });
    });

    it('should handle user with complete profile', () => {
      const userWithCompleteProfile = {
        ...mockAuth0User,
        name: 'Complete User',
      };

      mockUseUser.mockReturnValue({
        user: userWithCompleteProfile,
        error: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user?.name).toBe('Complete User');
      expect(result.current.user?.email).toBe(mockAuth0User.email);
    });
  });

  describe('Login Functionality', () => {
    it('should redirect to login page', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login();
      });

      expect(mockNavigateToUrl).toHaveBeenCalledWith('/api/auth/login');
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Redirecting to login page', 'polite');
    });

    it('should handle login with returnTo option', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login({ returnTo: '/workspace' });
      });

      expect(mockNavigateToUrl).toHaveBeenCalledWith('/api/auth/login?returnTo=%2Fworkspace');
    });

    it('should handle login with all options', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login({
          returnTo: '/workspace',
          organization: 'org-123',
          invitation: 'inv-456',
          screen_hint: 'signup',
        });
      });

      expect(mockNavigateToUrl).toHaveBeenCalledWith(
        '/api/auth/login?returnTo=%2Fworkspace&organization=org-123&invitation=inv-456&screen_hint=signup'
      );
    });

    it('should handle login errors', async () => {
      // Mock navigation utility to throw error
      mockNavigateToUrl.mockImplementationOnce(() => {
        throw new Error('Navigation failed');
      });

      const { result } = renderHook(() => useAuth());

      await expect(result.current.login()).rejects.toThrow('Navigation failed');
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Login failed. Please try again.', 'assertive');
    });
  });

  describe('Logout Functionality', () => {
    it('should redirect to logout page', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockNavigateToUrl).toHaveBeenCalledWith('/api/auth/logout');
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Logging out and redirecting', 'polite');
    });

    it('should handle logout with options', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout({ 
          returnTo: '/goodbye',
          federated: true 
        });
      });

      expect(mockNavigateToUrl).toHaveBeenCalledWith('/api/auth/logout?returnTo=%2Fgoodbye&federated=true');
    });

    it('should handle logout errors', async () => {
      // Mock navigation utility to throw error
      mockNavigateToUrl.mockImplementationOnce(() => {
        throw new Error('Logout failed');
      });

      const { result } = renderHook(() => useAuth());

      await expect(result.current.logout()).rejects.toThrow('Logout failed');
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Logout failed. Please try again.', 'assertive');
    });
  });

  describe('Permission Checking', () => {
    it('should check permissions correctly', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.checkPermission('read:cards')).toBe(true);
      expect(result.current.checkPermission('write:cards')).toBe(true);
      expect(result.current.checkPermission('delete:cards')).toBe(false);
      expect(result.current.checkPermission('admin:system')).toBe(false);
    });

    it('should return false for permissions when user is not authenticated', () => {
      mockUseUser.mockReturnValue({
        user: null,
        error: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.checkPermission('read:cards')).toBe(false);
    });

    it('should handle user without permissions', () => {
      const userWithoutPermissions = {
        ...mockAuth0User,
        'https://api.nexus-app.de/permissions': undefined,
      };

      mockUseUser.mockReturnValue({
        user: userWithoutPermissions,
        error: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.checkPermission('read:cards')).toBe(false);
    });
  });

  describe('Role Checking', () => {
    it('should check roles correctly', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.hasRole('user')).toBe(true);
      expect(result.current.hasRole('premium')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);
      expect(result.current.hasRole('super_admin')).toBe(false);
    });

    it('should return false for roles when user is not authenticated', () => {
      mockUseUser.mockReturnValue({
        user: null,
        error: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.hasRole('user')).toBe(false);
    });

    it('should handle user without roles', () => {
      const userWithoutRoles = {
        ...mockAuth0User,
        'https://api.nexus-app.de/roles': undefined,
      };

      mockUseUser.mockReturnValue({
        user: userWithoutRoles,
        error: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.hasRole('user')).toBe(false);
    });
  });

  describe('User Refresh', () => {
    it('should refresh user data successfully', async () => {
      global.mockFetch({ success: true });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/[auth0]', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh-user',
        }),
      });

      expect(global.mockRouter.refresh).toHaveBeenCalled();
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Refreshing user data', 'polite');
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('User data refreshed successfully', 'polite');
    });

    it('should handle refresh errors', async () => {
      global.mockFetch({}, false);

      const { result } = renderHook(() => useAuth());

      await expect(result.current.refreshUser()).rejects.toThrow('Failed to refresh user data');
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Failed to refresh user data', 'assertive');
    });

    it('should handle network errors during refresh', async () => {
      global.mockFetchError(new Error('Network error'));

      const { result } = renderHook(() => useAuth());

      await expect(result.current.refreshUser()).rejects.toThrow('Network error');
      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Failed to refresh user data', 'assertive');
    });
  });

  describe('Accessibility Announcements', () => {
    it('should announce successful authentication', () => {
      renderHook(() => useAuth());

      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith(
        'Welcome, Test User. You are now authenticated.',
        'polite'
      );
    });

    it('should announce authentication errors', () => {
      const authError = new Error('Authentication failed');
      mockUseUser.mockReturnValue({
        user: null,
        error: authError,
        isLoading: false,
      });

      renderHook(() => useAuth());

      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith(
        'Authentication failed. Please try again.',
        'assertive'
      );
    });

    it('should announce custom auth status', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.announceAuthStatus('Custom message', 'assertive');
      });

      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Custom message', 'assertive');
    });

    it('should use default priority for auth status announcements', () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.announceAuthStatus('Default priority message');
      });

      expect(mockAnnounceToScreenReader).toHaveBeenCalledWith('Default priority message', 'polite');
    });
  });

  describe('State Changes', () => {
    it('should update when user changes', () => {
      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);

      // Change to unauthenticated state
      mockUseUser.mockReturnValue({
        user: null,
        error: null,
        isLoading: false,
      });

      rerender();

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should update when loading state changes', () => {
      mockUseUser.mockReturnValue({
        user: null,
        error: null,
        isLoading: true,
      });

      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);

      // Change to loaded state with user
      mockUseUser.mockReturnValue({
        user: mockAuth0User,
        error: null,
        isLoading: false,
      });

      rerender();

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });
});

describe('useAuthState', () => {
  const mockUseUser = require('@auth0/nextjs-auth0/client').useUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseUser.mockReturnValue({
      user: {
        sub: 'auth0|test-user-id',
        email: 'test@example.com',
              },
      error: null,
      isLoading: false,
    });
  });

  it('should return only auth state without actions', () => {
    const { result } = renderHook(() => useAuthState());

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('isAuthenticated');

    // Should not have action methods
    expect(result.current).not.toHaveProperty('login');
    expect(result.current).not.toHaveProperty('logout');
    expect(result.current).not.toHaveProperty('checkPermission');
  });
});

describe('useRequireAuth', () => {
  const mockUseUser = require('@auth0/nextjs-auth0/client').useUser;
  const mockNavigateToUrl = require('@/lib/navigation').navigationUtils.navigateToUrl;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset navigation mock
    mockNavigateToUrl.mockClear();
  });

  it('should return user when authenticated', () => {
    const mockUser = {
      sub: 'auth0|test-user-id',
      email: 'test@example.com',
          };

    mockUseUser.mockReturnValue({
      user: mockUser,
      error: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current).toBeTruthy();
    expect(result.current?.sub).toBe('auth0|test-user-id');
  });

  it('should redirect to login when not authenticated', () => {
    mockUseUser.mockReturnValue({
      user: null,
      error: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useRequireAuth('/custom-redirect'));

    expect(result.current).toBeNull();
    expect(mockNavigateToUrl).toHaveBeenCalledWith('/api/auth/login?returnTo=%2Fcustom-redirect');
  });

  it('should not redirect while loading', () => {
    mockUseUser.mockReturnValue({
      user: null,
      error: null,
      isLoading: true,
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current).toBeNull();
    expect(mockNavigateToUrl).not.toHaveBeenCalled();
  });

  it('should use default redirect path', () => {
    mockUseUser.mockReturnValue({
      user: null,
      error: null,
      isLoading: false,
    });

    renderHook(() => useRequireAuth());

    expect(mockNavigateToUrl).toHaveBeenCalledWith('/api/auth/login?returnTo=%2Fworkspace');
  });
});

describe('Permission and Role Constants', () => {
  it('should export correct permission constants', () => {
    expect(Permissions.CARD_READ).toBe('card:read');
    expect(Permissions.CARD_CREATE).toBe('card:create');
    expect(Permissions.CARD_DELETE).toBe('card:delete');
    expect(Permissions.WORKSPACE_READ).toBe('workspace:read');
    expect(Permissions.ADMIN_SYSTEM).toBe('admin:system');
  });

  it('should export correct role constants', () => {
    expect(Roles.USER).toBe('user');
    expect(Roles.PREMIUM).toBe('premium');
    expect(Roles.ADMIN).toBe('admin');
    expect(Roles.SUPER_ADMIN).toBe('super_admin');
  });
});
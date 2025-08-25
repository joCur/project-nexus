import { useUser, UserProfile } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useEffect } from 'react';
import { announceToScreenReader } from '@/lib/utils';
import { navigationUtils } from '@/lib/navigation';

/**
 * Extended user interface with custom claims from Auth0
 */
export interface ExtendedUserProfile extends UserProfile {
  // Custom claims from Auth0 Rules/Actions
  roles?: string[];
  permissions?: string[];
  internalUserId?: string;
  
  // Standard Auth0 fields we explicitly use
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  updated_at?: string;
}

/**
 * Authentication state interface
 */
export interface AuthState {
  user: ExtendedUserProfile | null;
  isLoading: boolean;
  error?: Error;
  isAuthenticated: boolean;
}

/**
 * Authentication actions interface
 */
export interface AuthActions {
  login: (options?: LoginOptions) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
  checkPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  refreshUser: () => Promise<void>;
  announceAuthStatus: (message: string, priority?: 'polite' | 'assertive') => void;
}

/**
 * Login options
 */
export interface LoginOptions {
  returnTo?: string;
  organization?: string;
  invitation?: string;
  screen_hint?: 'login' | 'signup';
}

/**
 * Logout options  
 */
export interface LogoutOptions {
  returnTo?: string;
  federated?: boolean;
}

/**
 * Complete authentication hook return type
 */
export interface UseAuthReturn extends AuthState, AuthActions {}

/**
 * Custom authentication hook that wraps Auth0's useUser hook
 * with additional functionality and type safety
 * 
 * This hook provides:
 * - Type-safe user profile with custom claims
 * - Convenient authentication state management
 * - Login/logout functions with options
 * - Permission and role checking utilities
 * - User data refresh functionality
 */
export function useAuth(): UseAuthReturn {
  const { user, error, isLoading } = useUser();
  const router = useRouter();

  // Announce authentication state changes to screen readers
  useEffect(() => {
    if (!isLoading && user) {
      announceToScreenReader(`Welcome, ${user.name || 'user'}. You are now authenticated.`, 'polite');
    } else if (!isLoading && error) {
      announceToScreenReader('Authentication failed. Please try again.', 'assertive');
    }
  }, [user, error, isLoading]);

  // Extend user profile with custom claims and type safety
  const extendedUser: ExtendedUserProfile | null = useMemo(() => {
    if (!user) return null;

    return {
      // Spread user but handle null values
      sub: user.sub!,
      email: user.email!,
      name: user.name ?? undefined,
      nickname: user.nickname ?? undefined,
      picture: user.picture ?? undefined,
      updated_at: user.updated_at ?? undefined,
      org_id: user.org_id ?? undefined,
      
      // Extract custom claims (ensure they're arrays)
      roles: Array.isArray(user['https://api.nexus-app.de/roles']) 
        ? user['https://api.nexus-app.de/roles'] 
        : [],
      permissions: Array.isArray(user['https://api.nexus-app.de/permissions'])
        ? user['https://api.nexus-app.de/permissions']
        : [],
      internalUserId: user['https://api.nexus-app.de/user_id'] as string | undefined,
    };
  }, [user]);

  /**
   * Initiate Auth0 login with optional parameters and accessibility announcements
   */
  const login = useCallback(async (options: LoginOptions = {}) => {
    try {
      announceToScreenReader('Redirecting to login page', 'polite');
      
      const params = new URLSearchParams();
      
      if (options.returnTo) {
        params.set('returnTo', options.returnTo);
      }
      
      if (options.organization) {
        params.set('organization', options.organization);
      }
      
      if (options.invitation) {
        params.set('invitation', options.invitation);
      }
      
      if (options.screen_hint) {
        params.set('screen_hint', options.screen_hint);
      }

      const loginUrl = `/api/auth/login${params.toString() ? `?${params.toString()}` : ''}`;
      
      // Use navigation utility for Auth0 redirect
      navigationUtils.navigateToUrl(loginUrl);
    } catch (error) {
      console.error('Login error:', error);
      announceToScreenReader('Login failed. Please try again.', 'assertive');
      throw error;
    }
  }, []);

  /**
   * Initiate Auth0 logout with optional parameters and accessibility announcements
   */
  const logout = useCallback(async (options: LogoutOptions = {}) => {
    try {
      announceToScreenReader('Logging out and redirecting', 'polite');
      
      const params = new URLSearchParams();
      
      if (options.returnTo) {
        params.set('returnTo', options.returnTo);
      }
      
      if (options.federated) {
        params.set('federated', 'true');
      }

      const logoutUrl = `/api/auth/logout${params.toString() ? `?${params.toString()}` : ''}`;
      
      // Use navigation utility for Auth0 redirect
      navigationUtils.navigateToUrl(logoutUrl);
    } catch (error) {
      console.error('Logout error:', error);
      announceToScreenReader('Logout failed. Please try again.', 'assertive');
      throw error;
    }
  }, []);

  /**
   * Check if user has a specific permission
   */
  const checkPermission = useCallback((permission: string): boolean => {
    if (!extendedUser?.permissions) return false;
    return extendedUser.permissions.includes(permission);
  }, [extendedUser?.permissions]);

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback((role: string): boolean => {
    if (!extendedUser?.roles) return false;
    return extendedUser.roles.includes(role);
  }, [extendedUser?.roles]);

  /**
   * Refresh user data from Auth0 with accessibility announcements
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      announceToScreenReader('Refreshing user data', 'polite');
      
      const response = await fetch('/api/auth/[auth0]', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh-user',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh user data');
      }

      // Refresh the page to reload user session
      router.refresh();
      announceToScreenReader('User data refreshed successfully', 'polite');
    } catch (error) {
      console.error('Error refreshing user:', error);
      announceToScreenReader('Failed to refresh user data', 'assertive');
      throw error;
    }
  }, [router]);

  /**
   * Announce authentication status to screen readers
   */
  const announceAuthStatus = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, []);

  return {
    // State
    user: extendedUser,
    isLoading,
    error,
    isAuthenticated: !!extendedUser && !isLoading,
    
    // Actions
    login,
    logout,
    checkPermission,
    hasRole,
    refreshUser,
    announceAuthStatus,
  };
}

/**
 * Hook for checking authentication state only (no actions)
 * Useful for components that only need to read auth state
 */
export function useAuthState(): AuthState {
  const { user, isLoading, error, isAuthenticated } = useAuth();
  
  return {
    user,
    isLoading,
    error,
    isAuthenticated,
  };
}

/**
 * Hook for requiring authentication
 * Automatically redirects to login if user is not authenticated
 */
export function useRequireAuth(redirectTo: string = '/workspace'): ExtendedUserProfile | null {
  const { user, isLoading, login } = useAuth();
  
  // Redirect to login if not authenticated and not loading
  if (!isLoading && !user) {
    login({ returnTo: redirectTo });
    return null;
  }
  
  return user;
}

/**
 * Permission checking utilities
 */
export const Permissions = {
  // Card permissions
  READ_CARDS: 'read:cards',
  WRITE_CARDS: 'write:cards',
  DELETE_CARDS: 'delete:cards',
  
  // Workspace permissions  
  READ_WORKSPACES: 'read:workspaces',
  WRITE_WORKSPACES: 'write:workspaces',
  DELETE_WORKSPACES: 'delete:workspaces',
  ADMIN_WORKSPACES: 'admin:workspaces',
  
  // User permissions
  READ_PROFILE: 'read:profile',
  WRITE_PROFILE: 'write:profile',
  
  // Admin permissions
  ADMIN_USERS: 'admin:users',
  ADMIN_SYSTEM: 'admin:system',
} as const;

/**
 * Role checking utilities
 */
export const Roles = {
  USER: 'user',
  PREMIUM: 'premium',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;
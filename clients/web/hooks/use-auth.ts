import { useUser, UserProfile } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useEffect } from 'react';
import { announceToScreenReader } from '@/lib/utils';
import { navigationUtils } from '@/lib/navigation';
import { 
  checkUserPermission, 
  checkUserRole, 
  checkAnyUserPermission, 
  checkAllUserPermissions,
  createWorkspacePermissionChecker 
} from '@/lib/utils/permissions';
import { ExtendedUserProfile, LoginOptions, LogoutOptions, UseAuthReturn, AuthState, AUTH0_CLAIM_URLS } from '@/types/auth';

/**
 * Extended user interface with custom claims from Auth0
 */


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
  // Note: permissions are no longer extracted from Auth0 JWT - they come from backend
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
      roles: Array.isArray(user[AUTH0_CLAIM_URLS.ROLES]) 
        ? (user[AUTH0_CLAIM_URLS.ROLES] as string[]) 
        : [],
      internalUserId: user[AUTH0_CLAIM_URLS.USER_ID] as string | undefined,
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
   * This is a convenience method that uses the global permission context.
   * For workspace-specific permission checks, use the usePermissions hook directly.
   * 
   * @param permission - The permission to check
   * @param workspaceId - Optional workspace ID (overrides global context)
   */
  const checkPermission = useCallback((permission: string, workspaceId?: string): boolean => {
    return checkUserPermission(extendedUser, permission, workspaceId);
  }, [extendedUser]);

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback((role: string): boolean => {
    return checkUserRole(extendedUser, role);
  }, [extendedUser]);

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
   * Check if user has any of the specified permissions
   * @param permissions - Array of permissions to check
   * @param workspaceId - Optional workspace ID (overrides global context)
   */
  const hasAnyPermission = useCallback((permissions: string[], workspaceId?: string): boolean => {
    return checkAnyUserPermission(extendedUser, permissions, workspaceId);
  }, [extendedUser]);

  /**
   * Check if user has all of the specified permissions
   * @param permissions - Array of permissions to check
   * @param workspaceId - Optional workspace ID (overrides global context)
   */
  const hasAllPermissions = useCallback((permissions: string[], workspaceId?: string): boolean => {
    return checkAllUserPermissions(extendedUser, permissions, workspaceId);
  }, [extendedUser]);

  /**
   * Create a workspace-specific permission checker
   * @param workspaceId - The workspace ID to create checker for
   */
  const createPermissionChecker = useCallback((workspaceId: string) => {
    return createWorkspacePermissionChecker(extendedUser, workspaceId);
  }, [extendedUser]);

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
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    createPermissionChecker,
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
 * Updated to match backend permission system format
 */
export const Permissions = {
  // Workspace permissions
  WORKSPACE_READ: 'workspace:read',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_MANAGE_MEMBERS: 'workspace:manage_members',
  
  // Card permissions
  CARD_READ: 'card:read',
  CARD_CREATE: 'card:create',
  CARD_UPDATE: 'card:update',
  CARD_DELETE: 'card:delete',
  
  // Canvas permissions
  CANVAS_READ: 'canvas:read',
  CANVAS_CREATE: 'canvas:create',
  CANVAS_UPDATE: 'canvas:update',
  CANVAS_DELETE: 'canvas:delete',
  
  // Connection permissions
  CONNECTION_READ: 'connection:read',
  CONNECTION_CREATE: 'connection:create',
  CONNECTION_UPDATE: 'connection:update',
  CONNECTION_DELETE: 'connection:delete',
  
  // User permissions
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
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
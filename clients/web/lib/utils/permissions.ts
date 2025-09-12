/**
 * Shared permission checking utilities for the frontend
 * 
 * This module provides centralized permission checking logic integrated with
 * the backend WorkspaceAuthorizationService via GraphQL queries.
 * 
 * @see NEX-186 - Frontend permission integration with backend GraphQL queries
 */

import { ExtendedUserProfile } from '@/types/auth';
import { permissionLogger } from './permissionLogger';

/**
 * Permission checking context interface
 * Used to provide workspace context to permission utilities
 */
interface PermissionContext {
  workspaceId?: string;
  permissions?: string[];
  permissionsByWorkspace?: { [workspaceId: string]: string[] };
}

// Global permission context - can be set by workspace providers
let globalPermissionContext: PermissionContext = {};

/**
 * Set the global permission context
 * This allows legacy permission checking functions to work with workspace-scoped permissions
 */
export function setPermissionContext(context: PermissionContext): void {
  globalPermissionContext = context;
}

/**
 * Get the current permission context
 */
export function getPermissionContext(): PermissionContext {
  return globalPermissionContext;
}

/**
 * Clear the global permission context
 */
export function clearPermissionContext(): void {
  globalPermissionContext = {};
}

/**
 * Check if a user has a specific permission
 * 
 * This function now integrates with the backend permission system.
 * It uses the global permission context to determine workspace scope.
 * For new code, prefer using the usePermissions hook directly.
 * 
 * @param user - The authenticated user profile  
 * @param permission - The permission string to check
 * @param workspaceId - Optional workspace ID (overrides global context)
 * @returns True if user has the permission, false otherwise
 */
export function checkUserPermission(
  user: ExtendedUserProfile | null, 
  permission: string,
  workspaceId?: string
): boolean {
  const startTime = performance.now();
  
  if (!user?.sub || !permission) {
    return false;
  }

  const context = globalPermissionContext;
  const targetWorkspaceId = workspaceId || context.workspaceId;
  
  let result = false;

  try {
    if (targetWorkspaceId && context.permissionsByWorkspace) {
      // Check workspace-specific permissions from context
      const workspacePermissions = context.permissionsByWorkspace[targetWorkspaceId];
      result = Array.isArray(workspacePermissions) && workspacePermissions.includes(permission);
    } else if (context.permissions) {
      // Fall back to general permissions array
      result = context.permissions.includes(permission);
    } else {
      // No permission context available - secure by default
      result = false;
      
      if (process.env.NODE_ENV !== 'test') {
        console.warn(
          'Permission check without context. Use usePermissions hook or setPermissionContext.',
          { permission, userId: user.sub, workspaceId: targetWorkspaceId }
        );
      }
    }

    // Log the permission check
    permissionLogger.logPermissionCheck(permission, result, user.sub, targetWorkspaceId);
    
  } catch (error) {
    // Secure by default on error
    result = false;
    permissionLogger.logError('Permission check failed', {
      permission,
      userId: user.sub,
      workspaceId: targetWorkspaceId
    });
  }

  // Log performance metrics
  const duration = performance.now() - startTime;
  permissionLogger.logPerformanceMetric('checkUserPermission', duration, user.sub, targetWorkspaceId, {
    permission,
    result,
  });

  return result;
}

/**
 * Check if a user has any of the specified permissions
 * 
 * @param user - The authenticated user profile
 * @param permissions - Array of permission strings to check
 * @param workspaceId - Optional workspace ID (overrides global context)
 * @returns True if user has any of the permissions, false otherwise
 */
export function checkAnyUserPermission(
  user: ExtendedUserProfile | null, 
  permissions: string[],
  workspaceId?: string
): boolean {
  if (!user?.sub || !permissions.length) {
    return false;
  }

  // Use the more efficient approach - check each permission individually
  return permissions.some(permission => checkUserPermission(user, permission, workspaceId));
}

/**
 * Check if a user has all of the specified permissions
 * 
 * @param user - The authenticated user profile
 * @param permissions - Array of permission strings to check
 * @param workspaceId - Optional workspace ID (overrides global context)
 * @returns True if user has all of the permissions, false otherwise
 */
export function checkAllUserPermissions(
  user: ExtendedUserProfile | null, 
  permissions: string[],
  workspaceId?: string
): boolean {
  if (!user?.sub || !permissions.length) {
    return false;
  }

  // All permissions must be present
  return permissions.every(permission => checkUserPermission(user, permission, workspaceId));
}

/**
 * Check if a user has a specific role
 * 
 * Note: Role checking still works as roles are extracted from Auth0 JWT
 * 
 * @param user - The authenticated user profile
 * @param role - The role string to check
 * @returns True if user has the role, false otherwise
 */
export function checkUserRole(user: ExtendedUserProfile | null, role: string): boolean {
  if (!user?.roles) {
    return false;
  }
  
  return user.roles.includes(role);
}

/**
 * Check if a user has any of the specified roles
 * 
 * @param user - The authenticated user profile
 * @param roles - Array of role strings to check
 * @returns True if user has any of the roles, false otherwise
 */
export function checkAnyUserRole(user: ExtendedUserProfile | null, roles: string[]): boolean {
  if (!user?.roles) {
    return false;
  }
  
  return roles.some(role => user.roles!.includes(role));
}

/**
 * Check if a user has all of the specified roles
 * 
 * @param user - The authenticated user profile
 * @param roles - Array of role strings to check
 * @returns True if user has all of the roles, false otherwise
 */
export function checkAllUserRoles(user: ExtendedUserProfile | null, roles: string[]): boolean {
  if (!user?.roles) {
    return false;
  }
  
  return roles.every(role => user.roles!.includes(role));
}

/**
 * Backend integration status and utilities
 */

/**
 * Check if backend integration is ready for permission checking
 * 
 * @returns true if backend permission system is enabled
 * @deprecated Backend integration is now complete. This always returns true.
 */
export function isBackendIntegrationReady(): boolean {
  // Backend integration is now complete as of NEX-186
  return true;
}

/**
 * Constants for permission checking
 */
export const PERMISSION_CHECK_CONFIG = {
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  SUPPRESS_WARNINGS_IN_TEST: true,
  PERFORMANCE_TARGET_CACHED_MS: 100,
  PERFORMANCE_TARGET_UNCACHED_MS: 500,
} as const;

/**
 * Helper functions for workspace permission integration
 */

/**
 * Create a workspace-aware permission checker function
 * Useful for components that need to check multiple permissions in a specific workspace
 */
export function createWorkspacePermissionChecker(
  user: ExtendedUserProfile | null,
  workspaceId: string
) {
  return {
    hasPermission: (permission: string) => checkUserPermission(user, permission, workspaceId),
    hasAnyPermission: (permissions: string[]) => checkAnyUserPermission(user, permissions, workspaceId),
    hasAllPermissions: (permissions: string[]) => checkAllUserPermissions(user, permissions, workspaceId),
  };
}

/**
 * Utility to validate permission string format
 * Permissions should follow the format: resource:action (e.g., 'canvas:create')
 */
export function isValidPermissionFormat(permission: string): boolean {
  if (typeof permission !== 'string') return false;
  return /^[a-z]+:[a-z_]+$/.test(permission);
}
/**
 * Custom hook for workspace-aware permission fetching
 * 
 * Provides efficient permission checking with Apollo Client caching,
 * workspace context awareness, and proper error handling.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import { useQuery } from '@apollo/client';
import { useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import {
  GET_USER_WORKSPACE_PERMISSIONS,
  CHECK_USER_PERMISSION,
  GET_USER_PERMISSIONS_FOR_CONTEXT,
  GetUserWorkspacePermissionsVariables,
  GetUserWorkspacePermissionsData,
  CheckUserPermissionVariables,
  CheckUserPermissionData,
  GetUserPermissionsForContextVariables,
  GetUserPermissionsForContextData,
} from '@/lib/graphql/userOperations';
import { permissionCacheManager } from '@/lib/apollo-permission-cache';

/**
 * Cache configuration for permission queries
 */
const PERMISSION_CACHE_CONFIG = {
  // 5 minutes TTL as specified in requirements
  TTL_MS: 5 * 60 * 1000,
  
  // Apollo Client cache policies
  FETCH_POLICY: 'cache-first' as const,
  ERROR_POLICY: 'all' as const,
  
  // Performance targets from requirements
  PERFORMANCE_TARGET_CACHED_MS: 100,
  PERFORMANCE_TARGET_UNCACHED_MS: 500,
} as const;

/**
 * Permission hook options
 */
interface UsePermissionsOptions {
  workspaceId?: string;
  enabled?: boolean;
  errorPolicy?: 'secure-by-default' | 'permissive';
}

/**
 * Permission check result
 */
interface PermissionCheckResult {
  hasPermission: boolean;
  loading: boolean;
  error?: Error;
  refetch: () => Promise<void>;
}

/**
 * Workspace permissions result
 */
interface WorkspacePermissionsResult {
  permissions: string[];
  loading: boolean;
  error?: Error;
  refetch: () => Promise<void>;
  checkPermission: (permission: string) => boolean;
}

/**
 * Context permissions result (all workspaces)
 */
interface ContextPermissionsResult {
  permissionsByWorkspace: { [workspaceId: string]: string[] };
  loading: boolean;
  error?: Error;
  refetch: () => Promise<void>;
  checkPermissionInWorkspace: (workspaceId: string, permission: string) => boolean;
  getAllPermissions: () => string[];
}

/**
 * Hook for getting user permissions in a specific workspace
 */
export function useWorkspacePermissions(
  workspaceId: string,
  options: UsePermissionsOptions = {}
): WorkspacePermissionsResult {
  const { user } = useAuth();
  const { enabled = true, errorPolicy = 'secure-by-default' } = options;

  const { data, loading, error, refetch } = useQuery<
    GetUserWorkspacePermissionsData,
    GetUserWorkspacePermissionsVariables
  >(GET_USER_WORKSPACE_PERMISSIONS, {
    variables: {
      userId: user?.sub || '',
      workspaceId,
    },
    skip: !enabled || !user?.sub || !workspaceId,
    fetchPolicy: PERMISSION_CACHE_CONFIG.FETCH_POLICY,
    errorPolicy: PERMISSION_CACHE_CONFIG.ERROR_POLICY,
    // Cache for 5 minutes as specified in requirements
    pollInterval: 0, // Don't poll, rely on cache TTL
    notifyOnNetworkStatusChange: true,
  });

  // Memoize permissions array to avoid unnecessary re-renders
  const permissions = useMemo(() => {
    if (error && errorPolicy === 'secure-by-default') {
      // Secure by default: deny permissions on error
      return [];
    }
    return data?.getUserWorkspacePermissions || [];
  }, [data, error, errorPolicy]);

  // Memoized permission checker function
  const checkPermission = useCallback(
    (permission: string): boolean => {
      if (!permission) return false;
      return permissions.includes(permission);
    },
    [permissions]
  );

  // Memoized refetch function
  const refetchPermissions = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    permissions,
    loading,
    error: error || undefined,
    refetch: refetchPermissions,
    checkPermission,
  };
}

/**
 * Hook for checking a single permission in a workspace
 * More efficient than fetching all permissions when only checking one
 */
export function usePermissionCheck(
  workspaceId: string,
  permission: string,
  options: UsePermissionsOptions = {}
): PermissionCheckResult {
  const { user } = useAuth();
  const { enabled = true, errorPolicy = 'secure-by-default' } = options;

  const { data, loading, error, refetch } = useQuery<
    CheckUserPermissionData,
    CheckUserPermissionVariables
  >(CHECK_USER_PERMISSION, {
    variables: {
      userId: user?.sub || '',
      workspaceId,
      permission,
    },
    skip: !enabled || !user?.sub || !workspaceId || !permission,
    fetchPolicy: PERMISSION_CACHE_CONFIG.FETCH_POLICY,
    errorPolicy: PERMISSION_CACHE_CONFIG.ERROR_POLICY,
    notifyOnNetworkStatusChange: true,
  });

  // Determine permission result based on error policy
  const hasPermission = useMemo(() => {
    if (error && errorPolicy === 'secure-by-default') {
      // Secure by default: deny permission on error
      return false;
    }
    return data?.checkUserPermission || false;
  }, [data, error, errorPolicy]);

  // Memoized refetch function
  const refetchPermission = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    hasPermission,
    loading,
    error: error || undefined,
    refetch: refetchPermission,
  };
}

/**
 * Hook for getting user permissions across all workspaces
 * Used for global permission checking and context resolution
 */
export function useContextPermissions(
  options: UsePermissionsOptions = {}
): ContextPermissionsResult {
  const { user } = useAuth();
  const { enabled = true, errorPolicy = 'secure-by-default' } = options;

  const { data, loading, error, refetch } = useQuery<
    GetUserPermissionsForContextData,
    GetUserPermissionsForContextVariables
  >(GET_USER_PERMISSIONS_FOR_CONTEXT, {
    variables: {
      userId: user?.sub || '',
    },
    skip: !enabled || !user?.sub,
    fetchPolicy: PERMISSION_CACHE_CONFIG.FETCH_POLICY,
    errorPolicy: PERMISSION_CACHE_CONFIG.ERROR_POLICY,
    notifyOnNetworkStatusChange: true,
  });

  // Memoize permissions context to avoid unnecessary re-renders
  const permissionsByWorkspace = useMemo(() => {
    if (error && errorPolicy === 'secure-by-default') {
      // Secure by default: return empty permissions on error
      return {};
    }
    return data?.getUserPermissionsForContext || {};
  }, [data, error, errorPolicy]);

  // Memoized workspace permission checker
  const checkPermissionInWorkspace = useCallback(
    (workspaceId: string, permission: string): boolean => {
      if (!workspaceId || !permission) return false;
      const workspacePermissions = permissionsByWorkspace[workspaceId];
      return Array.isArray(workspacePermissions) && workspacePermissions.includes(permission);
    },
    [permissionsByWorkspace]
  );

  // Memoized function to get all unique permissions across workspaces
  const getAllPermissions = useCallback((): string[] => {
    const allPermissions = Object.values(permissionsByWorkspace)
      .flat()
      .filter((permission): permission is string => typeof permission === 'string');
    return Array.from(new Set(allPermissions));
  }, [permissionsByWorkspace]);

  // Memoized refetch function
  const refetchContext = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    permissionsByWorkspace,
    loading,
    error: error || undefined,
    refetch: refetchContext,
    checkPermissionInWorkspace,
    getAllPermissions,
  };
}

/**
 * Hook for warming the permission cache
 * Preloads permissions for commonly accessed workspaces
 */
export function usePermissionCacheWarming() {
  const { user } = useAuth();

  const warmWorkspacePermissions = useCallback(
    async (workspaceIds: string[]): Promise<void> => {
      if (!user?.sub || !workspaceIds.length) return;
      
      // Use the integrated cache manager for warming
      await permissionCacheManager.warmUserPermissionCache(user.sub, workspaceIds);
    },
    [user?.sub]
  );

  const warmContextPermissions = useCallback(
    async (): Promise<void> => {
      if (!user?.sub) return;

      // Context permissions are warmed as part of the user cache warming
      await permissionCacheManager.warmUserPermissionCache(user.sub);
    },
    [user?.sub]
  );

  return {
    warmWorkspacePermissions,
    warmContextPermissions,
  };
}

/**
 * Hook for invalidating permission cache
 * Useful when user roles change or workspace membership updates
 */
export function usePermissionCacheInvalidation() {
  const invalidateWorkspacePermissions = useCallback(
    (userId: string, workspaceId: string): void => {
      // Use smart invalidation that includes background warming
      permissionCacheManager.smartInvalidateUserPermissions(userId, workspaceId);
    },
    []
  );

  const invalidateAllUserPermissions = useCallback(
    (userId: string): void => {
      // Use smart invalidation for all user permissions
      permissionCacheManager.smartInvalidateUserPermissions(userId);
    },
    []
  );

  return {
    invalidateWorkspacePermissions,
    invalidateAllUserPermissions,
  };
}

/**
 * Combined permissions hook that provides all permission functionality
 * Convenient for components that need multiple permission features
 */
export function usePermissions(workspaceId?: string, options: UsePermissionsOptions = {}) {
  const workspacePermissions = useWorkspacePermissions(workspaceId || '', {
    ...options,
    enabled: options.enabled !== false && Boolean(workspaceId),
  });
  
  const contextPermissions = useContextPermissions(options);
  const cacheWarming = usePermissionCacheWarming();
  const cacheInvalidation = usePermissionCacheInvalidation();

  return {
    ...workspacePermissions,
    contextPermissions,
    cacheWarming,
    cacheInvalidation,
  };
}
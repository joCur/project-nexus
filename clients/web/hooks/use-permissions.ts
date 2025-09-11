/**
 * Custom hook for workspace-aware permission fetching
 * 
 * Provides efficient permission checking with Apollo Client caching,
 * workspace context awareness, and proper error handling.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import { useQuery } from '@apollo/client';
import { useCallback, useMemo, useEffect, useRef } from 'react';
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
import { emitPermissionEvent } from '@/lib/permission-notification-system';
import { permissionPreloader } from '@/lib/permission-preloader';

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

  // Track previous permissions for change detection
  const previousPermissions = useRef<string[]>([]);

  // Memoize permissions array to avoid unnecessary re-renders
  const permissions = useMemo(() => {
    if (error && errorPolicy === 'secure-by-default') {
      // Secure by default: deny permissions on error
      return [];
    }
    return data?.getUserWorkspacePermissions || [];
  }, [data, error, errorPolicy]);

  // Detect permission changes and emit events
  useEffect(() => {
    if (!user?.sub || !workspaceId || permissions.length === 0) {
      return;
    }

    const currentPermissions = [...permissions].sort();
    const previousPerms = [...previousPermissions.current].sort();

    // Only check for changes if we have previous permissions
    if (previousPerms.length > 0) {
      // Find newly granted permissions
      const grantedPermissions = currentPermissions.filter(
        perm => !previousPerms.includes(perm)
      );

      // Find revoked permissions
      const revokedPermissions = previousPerms.filter(
        perm => !currentPermissions.includes(perm)
      );

      // Emit events for granted permissions
      grantedPermissions.forEach(permission => {
        emitPermissionEvent({
          type: 'permissionGranted',
          timestamp: Date.now(),
          userId: user.sub,
          workspaceId,
          permission,
        });
      });

      // Emit events for revoked permissions
      revokedPermissions.forEach(permission => {
        emitPermissionEvent({
          type: 'permissionRevoked',
          timestamp: Date.now(),
          userId: user.sub,
          workspaceId,
          permission,
        });
      });
    }

    // Update previous permissions reference
    previousPermissions.current = currentPermissions;
  }, [permissions, user?.sub, workspaceId]);

  // Handle errors
  useEffect(() => {
    if (error && user?.sub && workspaceId) {
      emitPermissionEvent({
        type: 'permissionQueryError',
        timestamp: Date.now(),
        userId: user.sub,
        queryType: 'workspace',
        workspaceId,
        error: error.message || 'Unknown error',
        retryCount: 0,
      });
    }
  }, [error, user?.sub, workspaceId]);

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

  // Handle permission check failures
  useEffect(() => {
    if (error && user?.sub && workspaceId && permission) {
      emitPermissionEvent({
        type: 'permissionCheckFailed',
        timestamp: Date.now(),
        userId: user.sub,
        workspaceId,
        permission,
        error: error.message || 'Unknown error',
        fallbackUsed: errorPolicy === 'secure-by-default',
      });
    }
  }, [error, user?.sub, workspaceId, permission, errorPolicy]);

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
    variables: {},
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
 * Hook for permission preloading optimization
 * Proactively loads permissions based on user navigation patterns
 */
export function usePermissionPreloading() {
  const { user } = useAuth();

  const initializePreloader = useCallback(
    (workspaceId?: string): void => {
      if (!user?.sub) return;
      
      permissionPreloader.initialize(user.sub, workspaceId);
    },
    [user?.sub]
  );

  const updateWorkspaceContext = useCallback(
    (workspaceId: string): void => {
      if (!user?.sub) return;
      
      permissionPreloader.updateWorkspaceContext(user.sub, workspaceId);
    },
    [user?.sub]
  );

  const preloadSpecificPermission = useCallback(
    async (workspaceId: string, permission: string, priority?: 'low' | 'medium' | 'high'): Promise<boolean> => {
      if (!user?.sub) return false;
      
      return permissionPreloader.preloadPermission(user.sub, workspaceId, permission, priority);
    },
    [user?.sub]
  );

  const getPreloadStatistics = useCallback(() => {
    return permissionPreloader.getStatistics();
  }, []);

  const getActivePreloads = useCallback(() => {
    return permissionPreloader.getActiveRequests();
  }, []);

  return {
    initializePreloader,
    updateWorkspaceContext,
    preloadSpecificPermission,
    getPreloadStatistics,
    getActivePreloads,
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
  const preloading = usePermissionPreloading();

  return {
    ...workspacePermissions,
    contextPermissions,
    cacheWarming,
    cacheInvalidation,
    preloading,
  };
}
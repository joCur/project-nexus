/**
 * Apollo Client Permission Cache Integration
 * 
 * Provides enhanced cache management utilities specifically designed for the 
 * permission system in Project Nexus. This module bridges the gap between 
 * Apollo Client's caching and our permission-specific requirements.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import { apolloClient, permissionCacheUtils } from './apollo-client';
import { 
  GET_USER_WORKSPACE_PERMISSIONS,
  GET_USER_PERMISSIONS_FOR_CONTEXT,
  CHECK_USER_PERMISSION,
  GetUserWorkspacePermissionsVariables,
  GetUserWorkspacePermissionsData,
  GetUserPermissionsForContextVariables,
  GetUserPermissionsForContextData,
  CheckUserPermissionVariables,
  CheckUserPermissionData,
} from './graphql/userOperations';
import { emitPermissionEvent } from './permission-notification-system';

/**
 * Enhanced permission cache manager with workspace-aware operations
 */
export class PermissionCacheManager {
  private static instance: PermissionCacheManager;
  
  /**
   * Singleton instance getter
   */
  static getInstance(): PermissionCacheManager {
    if (!PermissionCacheManager.instance) {
      PermissionCacheManager.instance = new PermissionCacheManager();
    }
    return PermissionCacheManager.instance;
  }

  /**
   * Warm cache for user's commonly accessed workspaces
   * This is typically called during authentication or workspace switching
   */
  async warmUserPermissionCache(userId: string, priorityWorkspaceIds?: string[]): Promise<void> {
    if (!userId) {
      console.warn('PermissionCacheManager: Cannot warm cache without userId');
      return;
    }

    const startTime = Date.now();
    let cacheEntries = 0;

    try {
      // Always warm context permissions first as they provide global overview
      await this.warmContextPermissions();
      cacheEntries++;

      // Warm specific workspace permissions if provided
      if (priorityWorkspaceIds?.length) {
        await this.warmWorkspacePermissions(userId, priorityWorkspaceIds);
        cacheEntries += priorityWorkspaceIds.length;
      }

      const duration = Date.now() - startTime;
      console.log(`Permission cache warmed for user: ${userId}`);

      // Emit cache warmed event
      emitPermissionEvent({
        type: 'permissionCacheWarmed',
        timestamp: Date.now(),
        userId,
        workspaceIds: priorityWorkspaceIds || [],
        cacheEntries,
        duration,
      });
    } catch (error) {
      console.warn('Failed to warm user permission cache:', error);
      
      // Emit cache error event
      emitPermissionEvent({
        type: 'permissionQueryError',
        timestamp: Date.now(),
        userId,
        queryType: 'context',
        error: error instanceof Error ? error.message : String(error),
        retryCount: 0,
      });
    }
  }

  /**
   * Warm context permissions (all workspaces for a user)
   */
  private async warmContextPermissions(): Promise<void> {
    try {
      await apolloClient.query<GetUserPermissionsForContextData, GetUserPermissionsForContextVariables>({
        query: GET_USER_PERMISSIONS_FOR_CONTEXT,
        variables: {},
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      });
    } catch (error) {
      console.warn('Failed to warm context permissions:', error);
    }
  }

  /**
   * Warm workspace-specific permissions
   */
  private async warmWorkspacePermissions(userId: string, workspaceIds: string[]): Promise<void> {
    const warmingPromises = workspaceIds.map(workspaceId =>
      apolloClient.query<GetUserWorkspacePermissionsData, GetUserWorkspacePermissionsVariables>({
        query: GET_USER_WORKSPACE_PERMISSIONS,
        variables: { userId, workspaceId },
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      }).catch(error => {
        console.warn(`Failed to warm cache for workspace ${workspaceId}:`, error);
      })
    );

    await Promise.allSettled(warmingPromises);
  }

  /**
   * Preload a specific permission check
   * Useful for critical permissions that might be checked frequently
   */
  async preloadPermissionCheck(userId: string, workspaceId: string, permission: string): Promise<void> {
    try {
      await apolloClient.query<CheckUserPermissionData, CheckUserPermissionVariables>({
        query: CHECK_USER_PERMISSION,
        variables: { userId, workspaceId, permission },
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      });
    } catch (error) {
      console.warn(`Failed to preload permission ${permission} for workspace ${workspaceId}:`, error);
    }
  }

  /**
   * Smart cache invalidation that handles cascading effects
   * When a user's role changes, we need to invalidate related cache entries
   */
  smartInvalidateUserPermissions(userId: string, affectedWorkspaceId?: string): void {
    const cacheKeys: string[] = [];
    
    if (affectedWorkspaceId) {
      // Workspace-specific role change
      permissionCacheUtils.invalidateWorkspacePermissions(userId, affectedWorkspaceId);
      cacheKeys.push(`workspace_${affectedWorkspaceId}`);
    } else {
      // Global role change - invalidate everything
      permissionCacheUtils.invalidateUserPermissions(userId);
      cacheKeys.push('all_user_permissions');
    }

    // Emit cache invalidated event
    emitPermissionEvent({
      type: 'permissionCacheInvalidated',
      timestamp: Date.now(),
      userId,
      workspaceId: affectedWorkspaceId,
      cacheKeys,
      reason: 'role-change',
    });

    // Trigger cache warming for commonly accessed data
    this.scheduleBackgroundCacheWarming(userId, affectedWorkspaceId);
  }

  /**
   * Schedule background cache warming after invalidation
   */
  private scheduleBackgroundCacheWarming(userId: string, workspaceId?: string): void {
    // Use setTimeout to avoid blocking the invalidation operation
    setTimeout(async () => {
      try {
        if (workspaceId) {
          // Warm specific workspace
          await this.warmWorkspacePermissions(userId, [workspaceId]);
        } else {
          // Warm context permissions
          await this.warmContextPermissions();
        }
      } catch (error) {
        console.warn('Background cache warming failed:', error);
      }
    }, 100); // Small delay to ensure invalidation completes first
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): {
    cacheSize: number;
    cacheSizeExceeded: boolean;
    estimatedEntryCount: number;
  } {
    const cacheSize = permissionCacheUtils.getCacheSize();
    const cacheSizeExceeded = permissionCacheUtils.isCacheSizeExceeded();
    
    // Rough estimation of cache entries based on size
    // Average permission cache entry is approximately 100-200 bytes
    const estimatedEntryCount = Math.floor(cacheSize / 150);

    return {
      cacheSize,
      cacheSizeExceeded,
      estimatedEntryCount,
    };
  }

  /**
   * Perform comprehensive cache maintenance
   */
  performMaintenance(): void {
    try {
      permissionCacheUtils.performMaintenance();
      
      const metrics = this.getCacheMetrics();
      console.log('Permission cache metrics:', metrics);
      
      // If cache is getting too large, consider more aggressive cleanup
      if (metrics.cacheSizeExceeded) {
        console.warn('Permission cache size exceeded, performing aggressive cleanup');
        this.performAggressiveCleanup();
      }
    } catch (error) {
      console.warn('Permission cache maintenance failed:', error);
    }
  }

  /**
   * Perform aggressive cache cleanup when size limits are exceeded
   */
  private performAggressiveCleanup(): void {
    try {
      const cache = apolloClient.cache;
      
      // Use Apollo Client's built-in eviction for permission-related queries
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'getUserWorkspacePermissions'
      });
      
      cache.evict({
        id: 'ROOT_QUERY', 
        fieldName: 'checkUserPermission'
      });
      
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'getUserPermissionsForContext'
      });

      // Run garbage collection to free memory
      cache.gc();
      
      console.log('Aggressive cleanup completed: evicted all permission cache entries');
    } catch (error) {
      console.warn('Aggressive cache cleanup failed:', error);
    }
  }
}

/**
 * Export singleton instance for easy access throughout the application
 */
export const permissionCacheManager = PermissionCacheManager.getInstance();

/**
 * Convenient function for warming user permissions during authentication
 */
export async function warmUserPermissions(userId: string, priorityWorkspaceIds?: string[]): Promise<void> {
  return permissionCacheManager.warmUserPermissionCache(userId, priorityWorkspaceIds);
}

/**
 * Convenient function for invalidating user permissions when roles change
 */
export function invalidateUserPermissions(userId: string, affectedWorkspaceId?: string): void {
  permissionCacheManager.smartInvalidateUserPermissions(userId, affectedWorkspaceId);
}

/**
 * Convenient function for preloading critical permissions
 */
export async function preloadPermission(userId: string, workspaceId: string, permission: string): Promise<void> {
  return permissionCacheManager.preloadPermissionCheck(userId, workspaceId, permission);
}

/**
 * Get current cache performance metrics
 */
export function getPermissionCacheMetrics() {
  return permissionCacheManager.getCacheMetrics();
}
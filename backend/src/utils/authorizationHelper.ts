import { AuthenticationError, AuthorizationError } from '@/utils/errors';
import { securityLogger, createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';

const logger = createContextLogger({ service: 'AuthorizationHelper' });

/**
 * Cache to prevent N+1 queries for permission checks within a single request
 * Key format: `${userId}:permissions` or `${userId}:${workspaceId}:permission:${permission}`
 */
class RequestPermissionCache {
  private cache = new Map<string, any>();
  private cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0
  };

  get(key: string): any {
    if (this.cache.has(key)) {
      this.cacheStats.hits++;
      return this.cache.get(key);
    }
    this.cacheStats.misses++;
    return undefined;
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheStats.sets++;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0, sets: 0 };
  }

  getStats() {
    return { ...this.cacheStats };
  }

  size(): number {
    return this.cache.size;
  }
}

const requestPermissionCache = new RequestPermissionCache();

/**
 * Clear the permission cache - should be called at the start of each request
 */
export const clearPermissionCache = (): void => {
  const stats = requestPermissionCache.getStats();
  if (stats.hits + stats.misses > 0) {
    logger.debug('Permission cache cleared', {
      event: 'cache_cleared',
      stats,
      cacheSize: requestPermissionCache.size()
    });
  }
  requestPermissionCache.clear();
};

/**
 * Extended security logger with consistent authorization logging
 */
export const extendedSecurityLogger = {
  ...securityLogger,
  authorizationSuccess: (userId: string, resource: string, action: string, metadata?: Record<string, unknown>) => {
    // Log at info level for important authorization events, debug for routine ones
    const logLevel = metadata?.authorizationContext === 'self_access' ? 'debug' : 'info';
    
    const logData = {
      event: 'authorization_success',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    if (logLevel === 'debug') {
      logger.debug('Authorization successful', logData);
    } else {
      logger.info('Authorization successful', logData);
    }
  },
  authorizationCacheHit: (userId: string, cacheType: string, metadata?: Record<string, unknown>) => {
    logger.debug('Authorization cache hit', {
      event: 'authorization_cache_hit',
      userId,
      cacheType,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },
  authorizationCacheMiss: (userId: string, cacheType: string, metadata?: Record<string, unknown>) => {
    logger.debug('Authorization cache miss', {
      event: 'authorization_cache_miss',
      userId,
      cacheType,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },
};

/**
 * Authorization helper to reduce code duplication and improve performance
 */
export class AuthorizationHelper {
  private workspaceAuthService: WorkspaceAuthorizationService;
  private userId: string;

  constructor(context: GraphQLContext) {
    if (!context) {
      throw new Error('GraphQL context is required');
    }

    if (!context.isAuthenticated || !context.user) {
      throw new AuthenticationError();
    }

    if (!context.dataSources?.workspaceAuthorizationService) {
      throw new Error('WorkspaceAuthorizationService is required in context.dataSources');
    }

    if (!context.user.id || typeof context.user.id !== 'string') {
      throw new Error('Valid user ID is required');
    }

    this.workspaceAuthService = context.dataSources.workspaceAuthorizationService;
    this.userId = context.user.id;
  }

  /**
   * Get user permissions across all workspaces with caching
   */
  private async getUserPermissionsWithCache(): Promise<Record<string, string[]>> {
    const cacheKey = `${this.userId}:permissions`;
    
    if (requestPermissionCache.has(cacheKey)) {
      const cached = requestPermissionCache.get(cacheKey);
      logger.debug('Permission cache hit', {
        userId: this.userId,
        cacheKey,
        workspaceCount: Object.keys(cached || {}).length
      });
      return cached;
    }

    try {
      const permissions = await this.workspaceAuthService.getUserPermissionsForContext(this.userId);
      
      // Enhanced null safety checks
      if (!permissions) {
        logger.warn('No permissions returned from workspace authorization service', {
          userId: this.userId,
          service: 'WorkspaceAuthorizationService',
          method: 'getUserPermissionsForContext'
        });
        const emptyPermissions = {};
        requestPermissionCache.set(cacheKey, emptyPermissions);
        return emptyPermissions;
      }

      if (typeof permissions !== 'object' || Array.isArray(permissions)) {
        if (logger && logger.error) {
          logger.error('Invalid permissions structure returned - expected object with workspace IDs as keys', {
            userId: this.userId,
            permissionsType: typeof permissions,
            isArray: Array.isArray(permissions),
            service: 'WorkspaceAuthorizationService',
            method: 'getUserPermissionsForContext'
          });
        }
        const emptyPermissions = {};
        requestPermissionCache.set(cacheKey, emptyPermissions);
        return emptyPermissions;
      }

      // Validate each workspace's permissions array
      const validatedPermissions: Record<string, string[]> = {};
      for (const [workspaceId, workspacePermissions] of Object.entries(permissions)) {
        if (!workspaceId || typeof workspaceId !== 'string') {
          logger.warn('Invalid workspace ID in permissions', {
            userId: this.userId,
            invalidWorkspaceId: workspaceId
          });
          continue;
        }

        if (!Array.isArray(workspacePermissions)) {
          logger.warn('Invalid workspace permissions - expected array', {
            userId: this.userId,
            workspaceId,
            permissionsType: typeof workspacePermissions
          });
          validatedPermissions[workspaceId] = [];
          continue;
        }

        // Filter out invalid permissions
        const validPermissions = workspacePermissions.filter((perm): perm is string => 
          typeof perm === 'string' && perm.length > 0
        );
        
        if (validPermissions.length !== workspacePermissions.length) {
          logger.warn('Filtered out invalid permissions in workspace', {
            userId: this.userId,
            workspaceId,
            originalCount: workspacePermissions.length,
            validCount: validPermissions.length
          });
        }

        validatedPermissions[workspaceId] = validPermissions;
      }

      logger.debug('Permission cache miss - fetched from service', {
        userId: this.userId,
        cacheKey,
        workspaceCount: Object.keys(validatedPermissions).length,
        totalPermissions: Object.values(validatedPermissions).flat().length
      });

      requestPermissionCache.set(cacheKey, validatedPermissions);
      return validatedPermissions;
    } catch (error) {
      if (logger && logger.error) {
        logger.error('Failed to get user permissions', {
          userId: this.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          service: 'WorkspaceAuthorizationService',
          method: 'getUserPermissionsForContext'
        });
      }
      const emptyPermissions = {};
      requestPermissionCache.set(cacheKey, emptyPermissions);
      return emptyPermissions;
    }
  }

  /**
   * Get flattened permissions across all workspaces
   */
  async getFlatPermissions(): Promise<string[]> {
    const permissionsByWorkspace = await this.getUserPermissionsWithCache();
    
    // Additional safety check even though getUserPermissionsWithCache should handle this
    if (!permissionsByWorkspace || typeof permissionsByWorkspace !== 'object') {
      logger.warn('Invalid permissions structure in getFlatPermissions', {
        userId: this.userId,
        permissionsType: typeof permissionsByWorkspace
      });
      return [];
    }

    const allPermissions = Object.values(permissionsByWorkspace);
    const flatPermissions: string[] = [];
    
    // Safely flatten permissions from all workspaces
    for (const workspacePermissions of allPermissions) {
      if (Array.isArray(workspacePermissions)) {
        for (const perm of workspacePermissions) {
          if (typeof perm === 'string' && perm.length > 0) {
            flatPermissions.push(perm);
          }
        }
      }
    }
    
    // Remove duplicates while preserving order using Set
    const uniquePermissions = [...new Set(flatPermissions)];
    
    logger.debug('Flattened permissions computed', {
      userId: this.userId,
      workspaceCount: Object.keys(permissionsByWorkspace).length,
      totalPermissions: flatPermissions.length,
      uniquePermissions: uniquePermissions.length,
      duplicatesRemoved: flatPermissions.length - uniquePermissions.length
    });

    return uniquePermissions;
  }

  /**
   * Check if user has a specific permission across any workspace
   */
  async hasGlobalPermission(permission: string): Promise<boolean> {
    const flatPermissions = await this.getFlatPermissions();
    return flatPermissions.includes(permission);
  }

  /**
   * Check if user has permission in a specific workspace with caching
   */
  async hasWorkspacePermission(workspaceId: string, permission: string): Promise<boolean> {
    // Input validation
    if (!workspaceId || typeof workspaceId !== 'string') {
      logger.warn('Invalid workspaceId provided to hasWorkspacePermission', {
        userId: this.userId,
        workspaceId,
        permission,
        workspaceIdType: typeof workspaceId
      });
      return false;
    }

    if (!permission || typeof permission !== 'string') {
      logger.warn('Invalid permission provided to hasWorkspacePermission', {
        userId: this.userId,
        workspaceId,
        permission,
        permissionType: typeof permission
      });
      return false;
    }

    const cacheKey = `${this.userId}:${workspaceId}:permission:${permission}`;
    
    if (requestPermissionCache.has(cacheKey)) {
      const cached = requestPermissionCache.get(cacheKey);
      logger.debug('Workspace permission cache hit', {
        userId: this.userId,
        workspaceId,
        permission,
        result: cached
      });
      return cached;
    }

    try {
      const hasPermission = await this.workspaceAuthService.hasPermissionInWorkspace(
        this.userId,
        workspaceId,
        permission
      );
      
      // Ensure we get a boolean result
      const booleanResult = Boolean(hasPermission);
      
      logger.debug('Workspace permission cache miss - fetched from service', {
        userId: this.userId,
        workspaceId,
        permission,
        result: booleanResult,
        service: 'WorkspaceAuthorizationService',
        method: 'hasPermissionInWorkspace'
      });
      
      requestPermissionCache.set(cacheKey, booleanResult);
      return booleanResult;
    } catch (error) {
      if (logger && logger.error) {
        logger.error('Failed to check workspace permission', {
          userId: this.userId,
          workspaceId,
          permission,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          service: 'WorkspaceAuthorizationService',
          method: 'hasPermissionInWorkspace'
        });
      }
      // Cache false result to prevent repeated failed calls
      requestPermissionCache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Require a global permission or throw AuthorizationError
   */
  async requireGlobalPermission(
    permission: string, 
    errorMessage?: string,
    resource = 'system',
    action = 'access'
  ): Promise<void> {
    // Input validation
    if (!permission || typeof permission !== 'string') {
      const error = new AuthorizationError(
        'Invalid permission provided',
        'INVALID_PERMISSION',
        permission,
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid permission',
        requiredPermission: permission,
        userPermissions: []
      });
      
      throw error;
    }

    const hasPermission = await this.hasGlobalPermission(permission);
    
    if (!hasPermission) {
      const flatPermissions = await this.getFlatPermissions();
      const fullErrorMessage = errorMessage || `Missing required permission: ${permission}`;
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        requiredPermission: permission,
        userPermissions: flatPermissions,
        errorMessage: fullErrorMessage,
        authorizationContext: 'global_permission',
        workspaceCount: Object.keys(await this.getUserPermissionsWithCache()).length || 0
      });

      throw new AuthorizationError(
        fullErrorMessage,
        'INSUFFICIENT_PERMISSIONS',
        permission,
        flatPermissions
      );
    }

    // Log successful authorization
    extendedSecurityLogger.authorizationSuccess(this.userId, resource, action, {
      permission,
      checkType: 'global',
      authorizationContext: 'global_permission'
    });
  }

  /**
   * Require a workspace-specific permission or throw AuthorizationError
   */
  async requireWorkspacePermission(
    workspaceId: string,
    permission: string,
    errorMessage?: string,
    resource = 'workspace',
    action = 'access'
  ): Promise<void> {
    // Input validation
    if (!workspaceId || typeof workspaceId !== 'string') {
      const error = new AuthorizationError(
        'Invalid workspace ID provided',
        'INVALID_WORKSPACE_ID',
        permission,
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid workspace ID',
        workspaceId,
        requiredPermission: permission,
        userPermissions: []
      });
      
      throw error;
    }

    if (!permission || typeof permission !== 'string') {
      const error = new AuthorizationError(
        'Invalid permission provided',
        'INVALID_PERMISSION',
        permission,
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid permission',
        workspaceId,
        requiredPermission: permission,
        userPermissions: []
      });
      
      throw error;
    }

    const hasPermission = await this.hasWorkspacePermission(workspaceId, permission);
    
    if (!hasPermission) {
      // Get user permissions for better error context with null safety
      let userPermissions: string[] = [];
      try {
        const workspacePermissions = await this.getUserWorkspacePermissions(workspaceId);
        userPermissions = workspacePermissions || [];
      } catch (permError) {
        logger.warn('Failed to get workspace permissions for error context', {
          userId: this.userId,
          workspaceId,
          error: permError instanceof Error ? permError.message : 'Unknown error'
        });
      }
      
      const fullErrorMessage = errorMessage || `Missing required permission: ${permission} in workspace ${workspaceId}`;
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        workspaceId,
        requiredPermission: permission,
        userPermissions,
        errorMessage: fullErrorMessage,
        authorizationContext: 'workspace_specific'
      });

      throw new AuthorizationError(
        fullErrorMessage,
        'INSUFFICIENT_PERMISSIONS',
        permission,
        userPermissions
      );
    }

    // Log successful authorization
    extendedSecurityLogger.authorizationSuccess(this.userId, resource, action, {
      workspaceId,
      permission,
      checkType: 'workspace',
      authorizationContext: 'workspace_specific'
    });
  }

  /**
   * Check if user can access another user's data (self or admin)
   */
  async canAccessUserData(targetUserId: string): Promise<boolean> {
    // Users can always access their own data
    if (this.userId === targetUserId) {
      return true;
    }

    // Check for admin permission
    return await this.hasGlobalPermission('admin:user_management');
  }

  /**
   * Require access to user data or throw AuthorizationError
   */
  async requireUserDataAccess(
    targetUserId: string,
    errorMessage?: string,
    resource = 'user_data',
    action = 'access'
  ): Promise<void> {
    // Input validation
    if (!targetUserId || typeof targetUserId !== 'string') {
      const error = new AuthorizationError(
        'Invalid target user ID provided',
        'INVALID_USER_ID',
        'admin:user_management',
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid target user ID',
        targetUserId,
        userPermissions: []
      });
      
      throw error;
    }

    const canAccess = await this.canAccessUserData(targetUserId);
    
    if (!canAccess) {
      const flatPermissions = await this.getFlatPermissions();
      const fullErrorMessage = errorMessage || 'Cannot access other user data';
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        targetUserId,
        requiredPermission: 'admin:user_management',
        userPermissions: flatPermissions,
        errorMessage: fullErrorMessage,
        authorizationContext: 'user_data_access',
        isSelfAccess: this.userId === targetUserId
      });

      throw new AuthorizationError(
        fullErrorMessage,
        'INSUFFICIENT_PERMISSIONS',
        'admin:user_management',
        flatPermissions
      );
    }

    // Log successful authorization if accessing other user's data
    if (this.userId !== targetUserId) {
      extendedSecurityLogger.authorizationSuccess(this.userId, resource, action, {
        targetUserId,
        permission: 'admin:user_management',
        authorizationContext: 'cross_user_access'
      });
    } else {
      // Log self-access for audit purposes (at debug level)
      logger.debug('User accessing own data', {
        userId: this.userId,
        resource,
        action,
        authorizationContext: 'self_access'
      });
    }
  }

  /**
   * Get user permissions in a specific workspace with null safety
   */
  async getUserWorkspacePermissions(workspaceId: string): Promise<string[]> {
    // Input validation
    if (!workspaceId || typeof workspaceId !== 'string') {
      logger.warn('Invalid workspaceId provided to getUserWorkspacePermissions', {
        userId: this.userId,
        workspaceId,
        workspaceIdType: typeof workspaceId
      });
      return [];
    }

    const cacheKey = `${this.userId}:${workspaceId}:workspace_permissions`;
    
    if (requestPermissionCache.has(cacheKey)) {
      const cached = requestPermissionCache.get(cacheKey);
      logger.debug('Workspace permissions cache hit', {
        userId: this.userId,
        workspaceId,
        permissionCount: cached?.length || 0
      });
      return cached || [];
    }

    try {
      const permissions = await this.workspaceAuthService.getUserPermissionsInWorkspace(this.userId, workspaceId);
      
      // Enhanced null safety and validation
      if (!permissions) {
        logger.debug('No permissions returned for user in workspace', {
          userId: this.userId,
          workspaceId,
          service: 'WorkspaceAuthorizationService',
          method: 'getUserPermissionsInWorkspace'
        });
        const emptyPermissions: string[] = [];
        requestPermissionCache.set(cacheKey, emptyPermissions);
        return emptyPermissions;
      }

      if (!Array.isArray(permissions)) {
        if (logger && logger.error) {
          logger.error('Invalid permissions format - expected array', {
            userId: this.userId,
            workspaceId,
            permissionsType: typeof permissions,
            service: 'WorkspaceAuthorizationService',
            method: 'getUserPermissionsInWorkspace'
          });
        }
        const emptyPermissions: string[] = [];
        requestPermissionCache.set(cacheKey, emptyPermissions);
        return emptyPermissions;
      }

      // Filter and validate permission strings
      const validPermissions = permissions.filter((perm): perm is string => 
        typeof perm === 'string' && perm.length > 0
      );

      if (validPermissions.length !== permissions.length) {
        logger.warn('Filtered out invalid permissions in workspace', {
          userId: this.userId,
          workspaceId,
          originalCount: permissions.length,
          validCount: validPermissions.length,
          invalidPermissions: permissions.filter(perm => typeof perm !== 'string' || perm.length === 0)
        });
      }

      logger.debug('Workspace permissions cache miss - fetched from service', {
        userId: this.userId,
        workspaceId,
        permissionCount: validPermissions.length,
        service: 'WorkspaceAuthorizationService',
        method: 'getUserPermissionsInWorkspace'
      });

      requestPermissionCache.set(cacheKey, validPermissions);
      return validPermissions;
    } catch (error) {
      if (logger && logger.error) {
        logger.error('Failed to get workspace permissions', {
          userId: this.userId,
          workspaceId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          service: 'WorkspaceAuthorizationService',
          method: 'getUserPermissionsInWorkspace'
        });
      }
      const emptyPermissions: string[] = [];
      requestPermissionCache.set(cacheKey, emptyPermissions);
      return emptyPermissions;
    }
  }
}

/**
 * Factory function to create AuthorizationHelper instance
 */
export const createAuthorizationHelper = (context: GraphQLContext): AuthorizationHelper => {
  if (!context) {
    throw new Error('GraphQL context is required to create AuthorizationHelper');
  }
  
  return new AuthorizationHelper(context);
};

/**
 * Get permission cache statistics for monitoring
 */
export const getPermissionCacheStats = () => {
  return {
    ...requestPermissionCache.getStats(),
    size: requestPermissionCache.size()
  };
};

/**
 * Utility function to validate workspace ID format
 */
export const isValidWorkspaceId = (workspaceId: unknown): workspaceId is string => {
  return typeof workspaceId === 'string' && workspaceId.length > 0;
};

/**
 * Utility function to validate permission format
 */
export const isValidPermission = (permission: unknown): permission is string => {
  return typeof permission === 'string' && 
         permission.length > 0 && 
         /^[a-zA-Z0-9_:]+$/.test(permission); // Basic permission format validation
};
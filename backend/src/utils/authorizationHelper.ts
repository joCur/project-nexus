import { AuthenticationError, AuthorizationError } from '@/utils/errors';
import { securityLogger, createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { 
  ERROR_CODES, 
  GENERIC_ERROR_MESSAGES, 
  DEBUG_ERROR_MESSAGES, 
  getErrorMessage,
  isDevelopmentMode 
} from '@/constants/errorCodes';

const logger = createContextLogger({ service: 'AuthorizationHelper' });

// Safe logger to prevent undefined access in tests
const safeLog = (level: 'debug' | 'error' | 'warn' | 'info', message: string, meta?: any) => {
  if (logger && logger[level]) {
    logger[level](message, meta);
  }
};

/**
 * Cache to prevent N+1 queries for permission checks within a single request
 * Key format: `${userId}:permissions` or `${userId}:${workspaceId}:permission:${permission}`
 */
class RequestPermissionCache {
  private cache = new Map<string, any>();
  private cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };
  
  // Cache configuration
  private static readonly MAX_CACHE_SIZE = 1000; // Prevent memory bloat
  private static readonly CACHE_TTL_MS = 300000; // 5 minutes TTL
  private accessTimes = new Map<string, number>(); // Track access for LRU

  get(key: string): any {
    // Check TTL first
    const now = Date.now();
    if (this.cache.has(key)) {
      const accessTime = this.accessTimes.get(key);
      if (accessTime && (now - accessTime) > RequestPermissionCache.CACHE_TTL_MS) {
        // Entry expired
        this.cache.delete(key);
        this.accessTimes.delete(key);
        this.cacheStats.misses++;
        return undefined;
      }
      
      // Update access time for LRU
      this.accessTimes.set(key, now);
      this.cacheStats.hits++;
      return this.cache.get(key);
    }
    this.cacheStats.misses++;
    return undefined;
  }

  set(key: string, value: any): void {
    const now = Date.now();
    
    // Enforce cache size limit with LRU eviction
    if (this.cache.size >= RequestPermissionCache.MAX_CACHE_SIZE) {
      this.evictLRU();
    }
    
    this.cache.set(key, value);
    this.accessTimes.set(key, now);
    this.cacheStats.sets++;
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Date.now();
    
    // Find the least recently used entry
    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
      this.cacheStats.evictions++;
      
      safeLog('debug', 'Cache LRU eviction performed', {
        evictedKey: oldestKey.substring(0, 20) + '...', // Partial logging for security
        cacheSize: this.cache.size,
        evictionCount: this.cacheStats.evictions
      });
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
    this.cacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  getStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0 
      ? this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) 
      : 0;
      
    return { 
      ...this.cacheStats,
      size: this.cache.size,
      hitRate: parseFloat((hitRate * 100).toFixed(2)),
      maxSize: RequestPermissionCache.MAX_CACHE_SIZE,
      ttlMs: RequestPermissionCache.CACHE_TTL_MS
    };
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries periodically
  cleanupExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, accessTime] of this.accessTimes.entries()) {
      if ((now - accessTime) > RequestPermissionCache.CACHE_TTL_MS) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      safeLog('debug', 'Cache cleanup completed', {
        cleanedEntries: cleanedCount,
        remainingSize: this.cache.size
      });
    }
    
    return cleanedCount;
  }
}

const requestPermissionCache = new RequestPermissionCache();

/**
 * Performance monitoring for authorization checks
 */
class AuthorizationPerformanceMonitor {
  private metrics = {
    permissionChecks: 0,
    totalLatencyMs: 0,
    maxLatencyMs: 0,
    minLatencyMs: Infinity,
    cacheHits: 0,
    cacheMisses: 0
  };

  startTimer(): { end: () => number } {
    const startTime = Date.now();
    return {
      end: () => {
        const latency = Date.now() - startTime;
        this.recordLatency(latency);
        return latency;
      }
    };
  }

  private recordLatency(latencyMs: number): void {
    this.metrics.permissionChecks++;
    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.maxLatencyMs = Math.max(this.metrics.maxLatencyMs, latencyMs);
    this.metrics.minLatencyMs = Math.min(this.metrics.minLatencyMs, latencyMs);
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  getMetrics() {
    const avgLatencyMs = this.metrics.permissionChecks > 0 
      ? this.metrics.totalLatencyMs / this.metrics.permissionChecks 
      : 0;
      
    const cacheHitRate = this.metrics.cacheHits + this.metrics.cacheMisses > 0
      ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
      : 0;

    return {
      ...this.metrics,
      avgLatencyMs: parseFloat(avgLatencyMs.toFixed(2)),
      cacheHitRatePercent: parseFloat((cacheHitRate * 100).toFixed(2)),
      minLatencyMs: this.metrics.minLatencyMs === Infinity ? 0 : this.metrics.minLatencyMs
    };
  }

  reset(): void {
    this.metrics = {
      permissionChecks: 0,
      totalLatencyMs: 0,
      maxLatencyMs: 0,
      minLatencyMs: Infinity,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

const performanceMonitor = new AuthorizationPerformanceMonitor();

/**
 * Clear the permission cache - MUST be called at the start of each request
 * Security-critical: Prevents permission leakage between requests
 */
export const clearPermissionCache = (): void => {
  const stats = requestPermissionCache.getStats();
  const cacheSize = requestPermissionCache.size();
  
  // Log performance metrics before clearing (for production monitoring)
  if (stats.hits + stats.misses >= 10) { // Only log if there was significant activity
    logCachePerformance();
  }
  
  // Always clear the cache regardless of stats
  requestPermissionCache.clear();
  
  // Log cache clearing for security auditing (but not sensitive data)
  if (stats.hits + stats.misses > 0) {
    const hitRate = stats.hits / (stats.hits + stats.misses);
    safeLog('debug', 'Permission cache cleared for new request', {
      event: 'cache_cleared',
      previousCacheSize: cacheSize,
      cacheHits: stats.hits,
      cacheMisses: stats.misses,
      hitRatePercent: parseFloat((hitRate * 100).toFixed(2)),
      timestamp: new Date().toISOString()
    });
  }
  
  // Security validation: Ensure cache is truly empty
  if (requestPermissionCache.size() > 0) {
    safeLog('error', 'SECURITY WARNING: Permission cache not properly cleared', {
      event: 'cache_clear_failed',
      remainingCacheSize: requestPermissionCache.size(),
      timestamp: new Date().toISOString()
    });
    // Force clear again
    requestPermissionCache.clear();
  }
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
      safeLog('debug', 'Authorization successful', logData);
    } else {
      safeLog('info', 'Authorization successful', logData);
    }
  },
  authorizationCacheHit: (userId: string, cacheType: string, metadata?: Record<string, unknown>) => {
    safeLog('debug', 'Authorization cache hit', {
      event: 'authorization_cache_hit',
      userId,
      cacheType,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },
  authorizationCacheMiss: (userId: string, cacheType: string, metadata?: Record<string, unknown>) => {
    safeLog('debug', 'Authorization cache miss', {
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
      safeLog('debug', 'Permission cache hit', {
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
        safeLog('warn', 'No permissions returned from workspace authorization service', {
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
          safeLog('warn', 'Invalid workspace ID in permissions', {
            userId: this.userId,
            invalidWorkspaceId: workspaceId
          });
          continue;
        }

        if (!Array.isArray(workspacePermissions)) {
          safeLog('warn', 'Invalid workspace permissions - expected array', {
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
          safeLog('warn', 'Filtered out invalid permissions in workspace', {
            userId: this.userId,
            workspaceId,
            originalCount: workspacePermissions.length,
            validCount: validPermissions.length
          });
        }

        validatedPermissions[workspaceId] = validPermissions;
      }

      safeLog('debug', 'Permission cache miss - fetched from service', {
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
      safeLog('warn', 'Invalid permissions structure in getFlatPermissions', {
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
    
    safeLog('debug', 'Flattened permissions computed', {
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
    const timer = performanceMonitor.startTimer();
    
    try {
      const flatPermissions = await this.getFlatPermissions();
      const hasPermission = flatPermissions.includes(permission);
      
      // Record cache hit/miss for monitoring
      if (requestPermissionCache.has(`${this.userId}:permissions`)) {
        performanceMonitor.recordCacheHit();
      } else {
        performanceMonitor.recordCacheMiss();
      }
      
      return hasPermission;
    } finally {
      timer.end();
    }
  }

  /**
   * Check if user has permission in a specific workspace with caching
   */
  async hasWorkspacePermission(workspaceId: string, permission: string): Promise<boolean> {
    const timer = performanceMonitor.startTimer();
    
    try {
      // Enhanced input validation with security checks
      if (!isValidWorkspaceId(workspaceId)) {
        safeLog('warn', 'Invalid workspaceId provided to hasWorkspacePermission', {
          userId: this.userId,
          // Don't log potentially malicious input
          workspaceIdLength: (workspaceId as any)?.length || 'unknown',
          workspaceIdType: typeof workspaceId,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      if (!isValidPermission(permission)) {
        safeLog('warn', 'Invalid permission provided to hasWorkspacePermission', {
          userId: this.userId,
          workspaceId: workspaceId.substring(0, 8) + '...', // Partial logging
          permissionLength: (permission as any)?.length || 'unknown',
          permissionType: typeof permission,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      const cacheKey = `${this.userId}:${workspaceId}:permission:${permission}`;
      
      if (requestPermissionCache.has(cacheKey)) {
        const cached = requestPermissionCache.get(cacheKey);
        performanceMonitor.recordCacheHit();
        safeLog('debug', 'Workspace permission cache hit', {
          userId: this.userId,
          workspaceId,
          permission,
          result: cached
        });
        return cached;
      }

      const hasPermission = await this.workspaceAuthService.hasPermissionInWorkspace(
        this.userId,
        workspaceId,
        permission
      );
      
      // Ensure we get a boolean result
      const booleanResult = Boolean(hasPermission);
      
      safeLog('debug', 'Workspace permission cache miss - fetched from service', {
        userId: this.userId,
        workspaceId,
        permission,
        result: booleanResult,
        service: 'WorkspaceAuthorizationService',
        method: 'hasPermissionInWorkspace'
      });
      
      requestPermissionCache.set(cacheKey, booleanResult);
      performanceMonitor.recordCacheMiss();
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
      const errorCacheKey = `${this.userId}:${workspaceId}:permission:${permission}`;
      requestPermissionCache.set(errorCacheKey, false);
      performanceMonitor.recordCacheMiss();
      return false;
    } finally {
      timer.end();
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
    // Enhanced input validation with security checks
    if (!isValidPermission(permission)) {
      const debugMessage = isDevelopmentMode() 
        ? DEBUG_ERROR_MESSAGES.AUTHORIZATION.INVALID_PERMISSION(permission)
        : undefined;

      const error = new AuthorizationError(
        getErrorMessage(GENERIC_ERROR_MESSAGES.INVALID_REQUEST, debugMessage),
        ERROR_CODES.AUTHORIZATION.INVALID_PERMISSION,
        'redacted', // Don't leak potentially malicious input
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid permission format',
        // Don't log the actual invalid permission to prevent log injection
        permissionLength: (permission as any)?.length || 'unknown',
        permissionType: typeof permission
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

      const debugMessage = isDevelopmentMode() 
        ? DEBUG_ERROR_MESSAGES.AUTHORIZATION.MISSING_PERMISSION(permission)
        : undefined;

      throw new AuthorizationError(
        getErrorMessage(GENERIC_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, debugMessage),
        ERROR_CODES.AUTHORIZATION.GLOBAL_PERMISSION_DENIED,
        permission,
        [] // Don't expose user's actual permissions in error
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
    // Enhanced input validation with security checks
    if (!isValidWorkspaceId(workspaceId)) {
      const debugMessage = isDevelopmentMode() 
        ? DEBUG_ERROR_MESSAGES.AUTHORIZATION.INVALID_WORKSPACE_ID(workspaceId)
        : undefined;

      const error = new AuthorizationError(
        getErrorMessage(GENERIC_ERROR_MESSAGES.INVALID_REQUEST, debugMessage),
        ERROR_CODES.AUTHORIZATION.INVALID_WORKSPACE_ID,
        'redacted',
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid workspace ID format',
        // Don't log potentially malicious input
        workspaceIdLength: (workspaceId as any)?.length || 'unknown',
        workspaceIdType: typeof workspaceId
      });
      
      throw error;
    }

    if (!isValidPermission(permission)) {
      const debugMessage = isDevelopmentMode() 
        ? DEBUG_ERROR_MESSAGES.AUTHORIZATION.INVALID_PERMISSION(permission)
        : undefined;

      const error = new AuthorizationError(
        getErrorMessage(GENERIC_ERROR_MESSAGES.INVALID_REQUEST, debugMessage),
        ERROR_CODES.AUTHORIZATION.INVALID_PERMISSION,
        'redacted',
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid permission format',
        workspaceId: workspaceId.substring(0, 8) + '...', // Partial logging for debugging
        permissionLength: (permission as any)?.length || 'unknown',
        permissionType: typeof permission
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
        safeLog('warn', 'Failed to get workspace permissions for error context', {
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

      const debugMessage = isDevelopmentMode() 
        ? DEBUG_ERROR_MESSAGES.AUTHORIZATION.MISSING_PERMISSION(permission, workspaceId)
        : undefined;

      throw new AuthorizationError(
        getErrorMessage(GENERIC_ERROR_MESSAGES.WORKSPACE_ACCESS_DENIED, debugMessage),
        ERROR_CODES.AUTHORIZATION.WORKSPACE_ACCESS_DENIED,
        permission,
        [] // Don't expose user's actual permissions in error
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
    // Enhanced input validation with security checks
    if (!targetUserId || typeof targetUserId !== 'string' || targetUserId.trim().length === 0) {
      const debugMessage = isDevelopmentMode() 
        ? DEBUG_ERROR_MESSAGES.VALIDATION.FIELD_REQUIRED('targetUserId')
        : undefined;

      const error = new AuthorizationError(
        getErrorMessage(GENERIC_ERROR_MESSAGES.INVALID_REQUEST, debugMessage),
        ERROR_CODES.AUTHORIZATION.INVALID_USER_ID,
        'admin:user_management',
        []
      );
      
      securityLogger.authorizationFailure(this.userId, resource, action, {
        error: 'Invalid target user ID format',
        // Don't log potentially malicious input
        targetUserIdLength: (targetUserId as any)?.length || 'unknown',
        targetUserIdType: typeof targetUserId
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

      const debugMessage = isDevelopmentMode() 
        ? `User '${this.userId}' lacks permission 'admin:user_management' to access data for user '${targetUserId}'`
        : undefined;

      throw new AuthorizationError(
        getErrorMessage(GENERIC_ERROR_MESSAGES.ACCESS_DENIED, debugMessage),
        ERROR_CODES.AUTHORIZATION.USER_DATA_ACCESS_DENIED,
        'admin:user_management',
        [] // Don't expose user's actual permissions in error
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
      safeLog('debug', 'User accessing own data', {
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
    // Enhanced input validation with security checks
    if (!isValidWorkspaceId(workspaceId)) {
      safeLog('warn', 'Invalid workspaceId provided to getUserWorkspacePermissions', {
        userId: this.userId,
        workspaceIdLength: (workspaceId as any)?.length || 'unknown',
        workspaceIdType: typeof workspaceId,
        timestamp: new Date().toISOString()
      });
      return [];
    }

    const cacheKey = `${this.userId}:${workspaceId}:workspace_permissions`;
    
    if (requestPermissionCache.has(cacheKey)) {
      const cached = requestPermissionCache.get(cacheKey);
      safeLog('debug', 'Workspace permissions cache hit', {
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
        safeLog('debug', 'No permissions returned for user in workspace', {
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
        safeLog('warn', 'Filtered out invalid permissions in workspace', {
          userId: this.userId,
          workspaceId,
          originalCount: permissions.length,
          validCount: validPermissions.length,
          invalidPermissions: permissions.filter(perm => typeof perm !== 'string' || perm.length === 0)
        });
      }

      safeLog('debug', 'Workspace permissions cache miss - fetched from service', {
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
 * Get comprehensive permission and performance statistics for monitoring
 */
export const getPermissionCacheStats = () => {
  const cacheStats = requestPermissionCache.getStats();
  const perfStats = performanceMonitor.getMetrics();
  
  return {
    cache: {
      ...cacheStats,
      efficiency: {
        utilization: cacheStats.size > 0 ? 'active' : 'empty',
        performance: cacheStats.hitRate > 70 ? 'excellent' : cacheStats.hitRate > 50 ? 'good' : cacheStats.hitRate > 30 ? 'fair' : 'poor'
      }
    },
    performance: perfStats,
    combined: {
      totalOperations: perfStats.permissionChecks,
      avgResponseTime: perfStats.avgLatencyMs,
      cacheEffectiveness: cacheStats.hitRate,
      memoryUsage: {
        currentEntries: cacheStats.size,
        maxEntries: cacheStats.maxSize,
        utilizationPercent: parseFloat(((cacheStats.size / cacheStats.maxSize) * 100).toFixed(2))
      }
    }
  };
};

/**
 * Log cache performance metrics for monitoring
 */
export const logCachePerformance = (): void => {
  const stats = getPermissionCacheStats();
  
  // Only log if there's been activity
  if (stats.cache.hits + stats.cache.misses > 0) {
    safeLog('info', 'Permission cache performance metrics', {
      event: 'cache_performance',
      metrics: stats,
      recommendations: generateCacheRecommendations(stats),
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Generate performance recommendations based on cache stats
 */
const generateCacheRecommendations = (stats: any): string[] => {
  const recommendations: string[] = [];
  const cacheStats = stats.cache;
  const perfStats = stats.performance;
  
  if (cacheStats.hitRate < 30) {
    recommendations.push('Low cache hit rate - consider reviewing caching strategy');
  }
  
  if (cacheStats.size > 100) {
    recommendations.push('Large cache size - monitor memory usage');
  }
  
  if (cacheStats.hits > 1000) {
    recommendations.push('High cache usage - performing well');
  }
  
  if (cacheStats.efficiency.performance === 'poor') {
    recommendations.push('Poor cache performance - investigate query patterns');
  }
  
  if (perfStats.avgLatencyMs > 50) {
    recommendations.push('High average latency - consider optimizing permission checks');
  }
  
  if (stats.combined.memoryUsage.utilizationPercent > 80) {
    recommendations.push('Cache utilization high - consider increasing cache size limit');
  }
  
  return recommendations;
};


/**
 * Utility function to validate permission format
 * Security: Prevents injection attacks through malformed permissions
 */
export const isValidPermission = (permission: unknown): permission is string => {
  if (typeof permission !== 'string') {
    return false;
  }
  
  // Security validations
  const trimmedPermission = permission.trim();
  
  // Must not be empty after trimming
  if (trimmedPermission.length === 0) {
    return false;
  }
  
  // Must be reasonable length (prevent DoS attacks)
  if (trimmedPermission.length > 100) {
    return false;
  }
  
  // Only allow alphanumeric, underscore, colon, and dash
  if (!/^[a-zA-Z0-9_:-]+$/.test(trimmedPermission)) {
    return false;
  }
  
  // Must not start or end with special characters
  if (/^[_:-]|[_:-]$/.test(trimmedPermission)) {
    return false;
  }
  
  // Must not have consecutive special characters  
  if (/[_:-]{2,}/.test(trimmedPermission)) {
    return false;
  }
  
  return true;
};

/**
 * Enhanced workspace ID validation with security checks
 */
export const isValidWorkspaceId = (workspaceId: unknown): workspaceId is string => {
  if (typeof workspaceId !== 'string') {
    return false;
  }
  
  const trimmedId = workspaceId.trim();
  
  // Must not be empty
  if (trimmedId.length === 0) {
    return false;
  }
  
  // Must be reasonable length
  if (trimmedId.length > 100) {
    return false;
  }
  
  // For UUIDs or similar safe formats
  if (/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
    return true;
  }
  
  return false;
};

/**
 * Get comprehensive authorization performance metrics
 * Includes both cache performance and latency metrics
 */
export const getAuthorizationPerformanceMetrics = () => {
  return performanceMonitor.getMetrics();
};

/**
 * Reset authorization performance metrics
 * Useful for testing or periodic resets
 */
export const resetAuthorizationMetrics = (): void => {
  performanceMonitor.reset();
};

/**
 * Cleanup expired cache entries manually
 * Returns the number of entries cleaned
 */
export const cleanupExpiredCacheEntries = (): number => {
  return requestPermissionCache.cleanupExpired();
};

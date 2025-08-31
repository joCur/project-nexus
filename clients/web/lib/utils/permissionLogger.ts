/**
 * Dedicated logger utility for permission operations
 * Provides structured logging for permission checks, cache operations, and backend integration
 */

import { ENV_CONFIG } from '@/lib/config/auth';

/**
 * Permission operation types for logging
 */
export enum PermissionLogType {
  CHECK = 'permission_check',
  CACHE_HIT = 'permission_cache_hit',
  CACHE_MISS = 'permission_cache_miss',
  CACHE_INVALIDATION = 'permission_cache_invalidation',
  BACKEND_FETCH = 'permission_backend_fetch',
  ERROR = 'permission_error',
  WARNING = 'permission_warning',
  PERFORMANCE = 'permission_performance',
}

/**
 * Log levels for permission operations
 */
export enum PermissionLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Permission log entry structure
 */
export interface PermissionLogEntry {
  type: PermissionLogType;
  level: PermissionLogLevel;
  message: string;
  userId?: string;
  workspaceId?: string;
  permission?: string;
  permissions?: string[];
  duration?: number;
  cacheKey?: string;
  error?: Error | string;
  metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Permission logger class with structured logging capabilities
 */
export class PermissionLogger {
  private static instance: PermissionLogger;
  private logBuffer: PermissionLogEntry[] = [];
  private readonly maxBufferSize = 100;
  private readonly isEnabled: boolean;

  constructor() {
    this.isEnabled = ENV_CONFIG.ENABLE_PERMISSION_WARNINGS || ENV_CONFIG.IS_DEVELOPMENT;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PermissionLogger {
    if (!PermissionLogger.instance) {
      PermissionLogger.instance = new PermissionLogger();
    }
    return PermissionLogger.instance;
  }

  /**
   * Log a permission check operation
   */
  logPermissionCheck(
    permission: string,
    result: boolean,
    userId?: string,
    workspaceId?: string,
    metadata?: Record<string, any>
  ): void {
    this.log({
      type: PermissionLogType.CHECK,
      level: PermissionLogLevel.DEBUG,
      message: `Permission check: ${permission} = ${result}`,
      userId,
      workspaceId,
      permission,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log cache operations
   */
  logCacheOperation(
    operation: 'hit' | 'miss' | 'invalidation',
    cacheKey: string,
    userId?: string,
    workspaceId?: string,
    metadata?: Record<string, any>
  ): void {
    const typeMap = {
      hit: PermissionLogType.CACHE_HIT,
      miss: PermissionLogType.CACHE_MISS,
      invalidation: PermissionLogType.CACHE_INVALIDATION,
    };

    this.log({
      type: typeMap[operation],
      level: PermissionLogLevel.DEBUG,
      message: `Cache ${operation}: ${cacheKey}`,
      userId,
      workspaceId,
      cacheKey,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log backend integration warnings
   */
  logBackendIntegrationWarning(
    permission: string,
    userId?: string,
    workspaceId?: string
  ): void {
    if (!this.isEnabled) return;

    const message = `Permission checking now requires backend integration. Permission: ${permission}`;
    
    // Log to console in non-test environments
    if (ENV_CONFIG.ENABLE_PERMISSION_WARNINGS) {
      console.warn('Permission checking now requires backend integration. Permission:', permission);
    }

    this.log({
      type: PermissionLogType.WARNING,
      level: PermissionLogLevel.WARN,
      message,
      userId,
      workspaceId,
      permission,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log backend fetch operations
   */
  logBackendFetch(
    permissions: string[],
    duration: number,
    userId?: string,
    workspaceId?: string,
    success = true,
    error?: Error
  ): void {
    this.log({
      type: PermissionLogType.BACKEND_FETCH,
      level: success ? PermissionLogLevel.INFO : PermissionLogLevel.ERROR,
      message: `Backend permission fetch ${success ? 'completed' : 'failed'} in ${duration}ms`,
      userId,
      workspaceId,
      permissions,
      duration,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetric(
    operation: string,
    duration: number,
    userId?: string,
    workspaceId?: string,
    metadata?: Record<string, any>
  ): void {
    this.log({
      type: PermissionLogType.PERFORMANCE,
      level: PermissionLogLevel.INFO,
      message: `Permission operation ${operation} took ${duration}ms`,
      userId,
      workspaceId,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log errors
   */
  logError(
    error: Error | string,
    context: {
      permission?: string;
      userId?: string;
      workspaceId?: string;
      operation?: string;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.error('Permission Error:', errorMessage, context);
    }

    this.log({
      type: PermissionLogType.ERROR,
      level: PermissionLogLevel.ERROR,
      message: `Permission error: ${errorMessage}`,
      error,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Internal logging method
   */
  private log(entry: PermissionLogEntry): void {
    if (!this.isEnabled && entry.level === PermissionLogLevel.DEBUG) {
      return;
    }

    // Add to buffer
    this.logBuffer.push(entry);

    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // In development, also log to console with structured format
    if (ENV_CONFIG.IS_DEVELOPMENT && entry.level !== PermissionLogLevel.DEBUG) {
      this.consoleLog(entry);
    }
  }

  /**
   * Console logging with structured format
   */
  private consoleLog(entry: PermissionLogEntry): void {
    const logMethod = {
      [PermissionLogLevel.DEBUG]: console.debug,
      [PermissionLogLevel.INFO]: console.info,
      [PermissionLogLevel.WARN]: console.warn,
      [PermissionLogLevel.ERROR]: console.error,
    }[entry.level];

    logMethod(`[${entry.type}] ${entry.message}`, {
      userId: entry.userId,
      workspaceId: entry.workspaceId,
      permission: entry.permission,
      duration: entry.duration,
      timestamp: entry.timestamp,
      ...(entry.metadata || {}),
    });
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count = 100): PermissionLogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get logs by type
   */
  getLogsByType(type: PermissionLogType): PermissionLogEntry[] {
    return this.logBuffer.filter(entry => entry.type === type);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageDuration: number;
    totalOperations: number;
    cacheHitRate: number;
  } {
    const performanceLogs = this.getLogsByType(PermissionLogType.PERFORMANCE);
    const cacheHits = this.getLogsByType(PermissionLogType.CACHE_HIT);
    const cacheMisses = this.getLogsByType(PermissionLogType.CACHE_MISS);

    const totalDuration = performanceLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const averageDuration = performanceLogs.length > 0 ? totalDuration / performanceLogs.length : 0;

    const totalCacheOperations = cacheHits.length + cacheMisses.length;
    const cacheHitRate = totalCacheOperations > 0 ? cacheHits.length / totalCacheOperations : 0;

    return {
      averageDuration: Math.round(averageDuration * 100) / 100,
      totalOperations: performanceLogs.length,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    };
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }
}

/**
 * Singleton permission logger instance
 */
export const permissionLogger = PermissionLogger.getInstance();

/**
 * Convenience functions for common logging operations
 */
export const logPermissionCheck = (permission: string, result: boolean, userId?: string, workspaceId?: string) => {
  permissionLogger.logPermissionCheck(permission, result, userId, workspaceId);
};

export const logBackendIntegrationWarning = (permission: string, userId?: string, workspaceId?: string) => {
  permissionLogger.logBackendIntegrationWarning(permission, userId, workspaceId);
};

export const logPermissionError = (error: Error | string, context?: Record<string, any>) => {
  permissionLogger.logError(error, context);
};

export const logCacheOperation = (operation: 'hit' | 'miss' | 'invalidation', cacheKey: string) => {
  permissionLogger.logCacheOperation(operation, cacheKey);
};
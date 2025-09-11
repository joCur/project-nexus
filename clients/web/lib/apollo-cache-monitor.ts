/**
 * Apollo Cache Performance Monitor and Debugging Tools
 * 
 * Provides real-time monitoring, performance metrics, and debugging
 * utilities for the Apollo Client permission cache system.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import { apolloClient, permissionCacheUtils } from './apollo-client';
import { permissionCacheManager } from './apollo-permission-cache';
import { DocumentNode } from 'graphql';

/**
 * Performance monitoring configuration
 */
const MONITORING_CONFIG = {
  // Enable/disable performance monitoring in development
  ENABLED: process.env.NODE_ENV === 'development',
  
  // Metrics collection interval (5 minutes)
  METRICS_INTERVAL_MS: 5 * 60 * 1000,
  
  // Performance thresholds
  CACHE_SIZE_WARNING_MB: 8,
  CACHE_SIZE_CRITICAL_MB: 12,
  QUERY_TIME_WARNING_MS: 500,
  QUERY_TIME_CRITICAL_MS: 1000,
};

/**
 * Cache performance metrics
 */
interface CacheMetrics {
  timestamp: number;
  cacheSize: number;
  cacheSizeMB: number;
  estimatedEntryCount: number;
  hitRate: number;
  averageQueryTime: number;
  permissionQueries: {
    workspace: number;
    context: number;
    single: number;
  };
  errors: number;
}

/**
 * Query performance tracking
 */
interface QueryPerformance {
  queryName: string;
  duration: number;
  cacheHit: boolean;
  variables: Record<string, unknown>;
  timestamp: number;
  error?: string;
}

/**
 * Apollo Cache Monitor for performance tracking and debugging
 */
export class ApolloCacheMonitor {
  private static instance: ApolloCacheMonitor;
  private queryPerformance: QueryPerformance[] = [];
  private metricsHistory: CacheMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private queryObserver?: any;

  /**
   * Singleton instance
   */
  static getInstance(): ApolloCacheMonitor {
    if (!ApolloCacheMonitor.instance) {
      ApolloCacheMonitor.instance = new ApolloCacheMonitor();
    }
    return ApolloCacheMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (!MONITORING_CONFIG.ENABLED) {
      return;
    }

    console.log('Apollo Cache Monitor: Starting performance monitoring');

    // Set up periodic metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, MONITORING_CONFIG.METRICS_INTERVAL_MS);

    // Set up query performance tracking
    this.setupQueryTracking();

    // Log initial metrics
    this.collectMetrics();
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.queryObserver) {
      this.queryObserver.unsubscribe();
      this.queryObserver = undefined;
    }

    console.log('Apollo Cache Monitor: Stopped performance monitoring');
  }

  /**
   * Set up query performance tracking using Apollo Client's query manager
   */
  private setupQueryTracking(): void {
    // Wrap Apollo Client query method to track performance
    const originalQuery = apolloClient.query.bind(apolloClient);
    
    apolloClient.query = async (options: any) => {
      const startTime = Date.now();
      const queryName = this.extractQueryName(options.query);
      const isPermissionQuery = this.isPermissionQuery(queryName);

      if (!isPermissionQuery) {
        return originalQuery(options);
      }

      let cacheHit = false;
      let error: string | undefined;

      try {
        // Check if data is already in cache
        const cacheResult = apolloClient.cache.readQuery({
          query: options.query,
          variables: options.variables,
        });
        
        cacheHit = !!cacheResult;

        const result = await originalQuery(options);
        
        const duration = Date.now() - startTime;
        
        this.recordQueryPerformance({
          queryName,
          duration,
          cacheHit,
          variables: options.variables || {},
          timestamp: Date.now(),
        });

        return result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        const duration = Date.now() - startTime;
        
        this.recordQueryPerformance({
          queryName,
          duration,
          cacheHit,
          variables: options.variables || {},
          timestamp: Date.now(),
          error,
        });

        throw err;
      }
    };
  }

  /**
   * Extract query name from GraphQL query
   */
  private extractQueryName(query: DocumentNode): string {
    try {
      const definition = query?.definitions?.[0] as any;
      if (definition?.name?.value) {
        return definition.name.value;
      }
      if (definition?.selectionSet?.selections?.[0]?.name?.value) {
        return definition.selectionSet.selections[0].name.value;
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if query is a permission-related query
   */
  private isPermissionQuery(queryName: string): boolean {
    return queryName.includes('Permission') || 
           queryName.includes('getUserWorkspace') ||
           queryName.includes('getUserPermissionsForContext') ||
           queryName.includes('checkUserPermission');
  }

  /**
   * Record query performance data
   */
  private recordQueryPerformance(performance: QueryPerformance): void {
    this.queryPerformance.push(performance);

    // Keep only last 100 queries to prevent memory leaks
    if (this.queryPerformance.length > 100) {
      this.queryPerformance.shift();
    }

    // Log performance warnings
    this.checkPerformanceWarnings(performance);
  }

  /**
   * Check for performance issues and log warnings
   */
  private checkPerformanceWarnings(performance: QueryPerformance): void {
    if (performance.duration > MONITORING_CONFIG.QUERY_TIME_CRITICAL_MS) {
      console.error(`🔴 Critical query performance: ${performance.queryName} took ${performance.duration}ms`, {
        variables: performance.variables,
        cacheHit: performance.cacheHit,
        error: performance.error,
      });
    } else if (performance.duration > MONITORING_CONFIG.QUERY_TIME_WARNING_MS) {
      console.warn(`🟡 Slow query performance: ${performance.queryName} took ${performance.duration}ms`, {
        variables: performance.variables,
        cacheHit: performance.cacheHit,
      });
    }
  }

  /**
   * Collect comprehensive cache metrics
   */
  private collectMetrics(): void {
    try {
      const cacheSize = permissionCacheUtils.getCacheSize();
      const cacheSizeMB = cacheSize / (1024 * 1024);
      const { estimatedEntryCount } = permissionCacheManager.getCacheMetrics();

      // Calculate cache hit rate from recent queries
      const recentQueries = this.queryPerformance.slice(-50);
      const hitRate = recentQueries.length > 0 
        ? recentQueries.filter(q => q.cacheHit).length / recentQueries.length 
        : 0;

      // Calculate average query time
      const averageQueryTime = recentQueries.length > 0
        ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
        : 0;

      // Count permission query types
      const permissionQueries = recentQueries.reduce((counts, query) => {
        if (query.queryName.includes('getUserWorkspacePermissions')) {
          counts.workspace++;
        } else if (query.queryName.includes('getUserPermissionsForContext')) {
          counts.context++;
        } else if (query.queryName.includes('checkUserPermission')) {
          counts.single++;
        }
        return counts;
      }, { workspace: 0, context: 0, single: 0 });

      // Count recent errors
      const errors = recentQueries.filter(q => q.error).length;

      const metrics: CacheMetrics = {
        timestamp: Date.now(),
        cacheSize,
        cacheSizeMB,
        estimatedEntryCount,
        hitRate,
        averageQueryTime,
        permissionQueries,
        errors,
      };

      this.metricsHistory.push(metrics);

      // Keep only last 24 hours of metrics (assuming 5-minute intervals)
      if (this.metricsHistory.length > 288) {
        this.metricsHistory.shift();
      }

      // Log metrics summary
      this.logMetricsSummary(metrics);

      // Check for critical issues
      this.checkCriticalIssues(metrics);

    } catch (error) {
      console.warn('Failed to collect cache metrics:', error);
    }
  }

  /**
   * Log metrics summary to console
   */
  private logMetricsSummary(metrics: CacheMetrics): void {
    console.log('📊 Apollo Cache Metrics:', {
      cacheSize: `${metrics.cacheSizeMB.toFixed(2)} MB`,
      entries: metrics.estimatedEntryCount,
      hitRate: `${(metrics.hitRate * 100).toFixed(1)}%`,
      avgQueryTime: `${metrics.averageQueryTime.toFixed(0)}ms`,
      recentQueries: metrics.permissionQueries,
      errors: metrics.errors,
    });
  }

  /**
   * Check for critical performance issues
   */
  private checkCriticalIssues(metrics: CacheMetrics): void {
    // Cache size warnings
    if (metrics.cacheSizeMB > MONITORING_CONFIG.CACHE_SIZE_CRITICAL_MB) {
      console.error('🔴 Critical cache size exceeded!', {
        currentSize: `${metrics.cacheSizeMB.toFixed(2)} MB`,
        limit: `${MONITORING_CONFIG.CACHE_SIZE_CRITICAL_MB} MB`,
        recommendation: 'Consider aggressive cache cleanup',
      });
      
      // Trigger aggressive cleanup automatically
      permissionCacheManager.performMaintenance();
      
    } else if (metrics.cacheSizeMB > MONITORING_CONFIG.CACHE_SIZE_WARNING_MB) {
      console.warn('🟡 Cache size approaching limit', {
        currentSize: `${metrics.cacheSizeMB.toFixed(2)} MB`,
        limit: `${MONITORING_CONFIG.CACHE_SIZE_CRITICAL_MB} MB`,
      });
    }

    // Low cache hit rate warning
    if (metrics.hitRate < 0.5) {
      console.warn('🟡 Low cache hit rate detected', {
        hitRate: `${(metrics.hitRate * 100).toFixed(1)}%`,
        recommendation: 'Consider cache warming strategies',
      });
    }

    // High error rate warning
    if (metrics.errors > 5) {
      console.warn('🟡 High permission query error rate', {
        errors: metrics.errors,
        recommendation: 'Check network connectivity and backend health',
      });
    }
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(): {
    metrics: CacheMetrics | null;
    recentQueries: QueryPerformance[];
    recommendations: string[];
  } {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1] || null;
    const recentQueries = this.queryPerformance.slice(-10);
    const recommendations = this.generateRecommendations(latestMetrics, recentQueries);

    return {
      metrics: latestMetrics,
      recentQueries,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: CacheMetrics | null, queries: QueryPerformance[]): string[] {
    const recommendations: string[] = [];

    if (!metrics) {
      return ['No metrics available yet'];
    }

    if (metrics.cacheSizeMB > MONITORING_CONFIG.CACHE_SIZE_WARNING_MB) {
      recommendations.push('Consider reducing cache size or increasing cleanup frequency');
    }

    if (metrics.hitRate < 0.7) {
      recommendations.push('Cache hit rate is low - consider cache warming strategies');
    }

    if (metrics.averageQueryTime > MONITORING_CONFIG.QUERY_TIME_WARNING_MS) {
      recommendations.push('Query performance is slower than expected - check network conditions');
    }

    const errorQueries = queries.filter(q => q.error);
    if (errorQueries.length > 0) {
      recommendations.push('Some queries are failing - check backend connectivity');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache performance is within acceptable limits');
    }

    return recommendations;
  }

  /**
   * Export performance data for external analysis
   */
  exportPerformanceData(): {
    metricsHistory: CacheMetrics[];
    queryPerformance: QueryPerformance[];
    summary: {
      metrics: CacheMetrics | null;
      recentQueries: QueryPerformance[];
      recommendations: string[];
    };
  } {
    return {
      metricsHistory: this.metricsHistory,
      queryPerformance: this.queryPerformance,
      summary: this.getPerformanceSummary(),
    };
  }

  /**
   * Clear performance data
   */
  clearPerformanceData(): void {
    this.queryPerformance = [];
    this.metricsHistory = [];
    console.log('Performance data cleared');
  }
}

// Export singleton instance
export const apolloCacheMonitor = ApolloCacheMonitor.getInstance();

// Auto-start monitoring in development mode
if (MONITORING_CONFIG.ENABLED) {
  apolloCacheMonitor.start();
}

// Development tools for debugging
declare global {
  interface Window {
    __APOLLO_CACHE_MONITOR__: ApolloCacheMonitor;
  }
}

// Expose monitor to window for debugging in browser
if (typeof window !== 'undefined' && MONITORING_CONFIG.ENABLED) {
  window.__APOLLO_CACHE_MONITOR__ = apolloCacheMonitor;
}
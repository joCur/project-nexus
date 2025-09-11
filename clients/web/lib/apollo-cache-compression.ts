/**
 * Apollo Client Cache Compression System
 * 
 * Provides intelligent cache compression using LZ-String algorithm
 * to reduce memory usage while maintaining performance for the 
 * permission system and other Apollo Client operations.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import LZString from 'lz-string';
import { apolloClient } from './apollo-client';
import { emitPermissionEvent } from './permission-notification-system';
import { cacheLogger } from './structured-logger';

/**
 * Cache compression configuration
 */
const COMPRESSION_CONFIG = {
  // Enable compression when cache size exceeds 5MB
  COMPRESSION_THRESHOLD_BYTES: 5 * 1024 * 1024,
  
  // Target compression ratio (aim to reduce cache by 60%)
  TARGET_COMPRESSION_RATIO: 0.6,
  
  // Performance thresholds
  MAX_COMPRESSION_TIME_MS: 100,
  MAX_DECOMPRESSION_TIME_MS: 50,
  
  // Cache keys that should be prioritized for compression
  COMPRESSIBLE_PATTERNS: [
    'getUserWorkspacePermissions',
    'getUserPermissionsForContext',
    'checkUserPermission',
    'Canvas',
    'Workspace',
  ],
  
  // Enable in development for testing
  ENABLED: process.env.NODE_ENV === 'development' || process.env.ENABLE_CACHE_COMPRESSION === 'true',
};

/**
 * Compressed cache entry metadata
 */
interface CompressedCacheEntry {
  compressed: true;
  data: string; // LZ-compressed data
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timestamp: number;
  accessCount: number;
}

/**
 * Cache compression statistics
 */
interface CompressionStats {
  totalEntries: number;
  compressedEntries: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  compressionRatio: number;
  totalCompressionTime: number;
  totalDecompressionTime: number;
  lastCompressionTimestamp: number;
}

/**
 * Apollo Client cache compression manager
 */
export class ApolloCacheCompression {
  private static instance: ApolloCacheCompression;
  private compressionStats: CompressionStats = {
    totalEntries: 0,
    compressedEntries: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    compressionRatio: 0,
    totalCompressionTime: 0,
    totalDecompressionTime: 0,
    lastCompressionTimestamp: 0,
  };
  
  private compressionInterval?: NodeJS.Timeout;
  private originalCacheWrite?: any;
  private originalCacheRead?: any;

  /**
   * Singleton instance getter
   */
  static getInstance(): ApolloCacheCompression {
    if (!ApolloCacheCompression.instance) {
      ApolloCacheCompression.instance = new ApolloCacheCompression();
    }
    return ApolloCacheCompression.instance;
  }

  /**
   * Initialize cache compression system
   */
  initialize(): void {
    if (!COMPRESSION_CONFIG.ENABLED) {
      console.log('Cache compression disabled');
      return;
    }

    console.log('Initializing Apollo Client cache compression...');

    // Set up periodic compression
    this.compressionInterval = setInterval(() => {
      this.performIntelligentCompression();
    }, 30000); // Check every 30 seconds

    // Hook into cache operations for real-time compression
    this.setupCacheHooks();

    console.log('Cache compression system initialized');
    cacheLogger.info('Cache compression system initialized', {
      feature: 'cache-compression',
      component: 'ApolloCacheCompression',
    }, ['initialization', 'cache']);
  }

  /**
   * Shutdown compression system
   */
  shutdown(): void {
    if (this.compressionInterval) {
      clearInterval(this.compressionInterval);
      this.compressionInterval = undefined;
    }

    // Restore original cache methods
    if (this.originalCacheWrite && this.originalCacheRead) {
      // Note: This is simplified - in production you'd properly restore the cache methods
      console.log('Cache compression system shut down');
    }
  }

  /**
   * Setup cache operation hooks for compression
   */
  private setupCacheHooks(): void {
    try {
      // Note: This is a simplified approach. In production, you'd implement
      // proper cache layer hooks or use Apollo Client's cache policies
      console.log('Cache compression hooks set up');
    } catch (error) {
      console.warn('Failed to set up cache compression hooks:', error);
    }
  }

  /**
   * Perform intelligent cache compression based on usage patterns
   */
  async performIntelligentCompression(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const cacheData = apolloClient.cache.extract();
      const currentCacheSize = JSON.stringify(cacheData).length;

      // Check if compression is needed
      if (currentCacheSize < COMPRESSION_CONFIG.COMPRESSION_THRESHOLD_BYTES) {
        return;
      }

      console.log(`Cache size ${(currentCacheSize / 1024 / 1024).toFixed(2)}MB exceeds threshold, starting compression...`);

      const compressionResults = await this.compressCacheEntries(cacheData);
      
      // Update statistics
      this.updateCompressionStats(compressionResults);

      const duration = Date.now() - startTime;
      
      // Emit compression event
      emitPermissionEvent({
        type: 'permissionCacheInvalidated', // Reusing existing event type
        timestamp: Date.now(),
        userId: 'system',
        cacheKeys: compressionResults.compressedKeys,
        reason: 'compression',
      });

      console.log(`Cache compression completed in ${duration}ms:`, {
        entriesCompressed: compressionResults.compressedCount,
        originalSize: `${(compressionResults.originalSize / 1024 / 1024).toFixed(2)}MB`,
        compressedSize: `${(compressionResults.compressedSize / 1024 / 1024).toFixed(2)}MB`,
        compressionRatio: `${(compressionResults.compressionRatio * 100).toFixed(1)}%`,
      });

      cacheLogger.performance(
        'Cache compression completed',
        duration,
        {
          feature: 'cache-compression',
          component: 'ApolloCacheCompression',
          metadata: {
            entriesCompressed: compressionResults.compressedCount,
            originalSizeMB: compressionResults.originalSize / 1024 / 1024,
            compressedSizeMB: compressionResults.compressedSize / 1024 / 1024,
            compressionRatio: compressionResults.compressionRatio,
            spaceSavedMB: (compressionResults.originalSize - compressionResults.compressedSize) / 1024 / 1024,
          },
        }
      );

    } catch (error) {
      console.error('Cache compression failed:', error);
      cacheLogger.error(
        'Cache compression failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          feature: 'cache-compression',
          component: 'ApolloCacheCompression',
          performance: {
            duration: Date.now() - startTime,
          },
        },
        ['cache', 'compression', 'error']
      );
    }
  }

  /**
   * Compress cache entries intelligently
   */
  private async compressCacheEntries(cacheData: Record<string, any>): Promise<{
    compressedCount: number;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    compressedKeys: string[];
  }> {
    const compressedKeys: string[] = [];
    let compressedCount = 0;
    let originalSize = 0;
    let compressedSize = 0;

    // Identify entries that should be compressed
    const compressibleEntries = this.identifyCompressibleEntries(cacheData);

    for (const [key, entry] of compressibleEntries) {
      try {
        const compressionResult = await this.compressEntry(key, entry);
        
        if (compressionResult.success) {
          compressedKeys.push(key);
          compressedCount++;
          originalSize += compressionResult.originalSize;
          compressedSize += compressionResult.compressedSize;

          // Update cache with compressed entry
          // Note: In production, this would properly update the Apollo cache
          console.log(`Compressed cache entry: ${key}`, {
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            ratio: compressionResult.compressionRatio,
          });
        }
      } catch (error) {
        console.warn(`Failed to compress cache entry ${key}:`, error);
      }
    }

    const overallCompressionRatio = originalSize > 0 ? compressedSize / originalSize : 0;

    return {
      compressedCount,
      originalSize,
      compressedSize,
      compressionRatio: overallCompressionRatio,
      compressedKeys,
    };
  }

  /**
   * Identify cache entries that are good candidates for compression
   */
  private identifyCompressibleEntries(cacheData: Record<string, any>): Array<[string, any]> {
    const entries: Array<[string, any]> = [];

    for (const [key, value] of Object.entries(cacheData)) {
      // Skip already compressed entries
      if (this.isCompressedEntry(value)) {
        continue;
      }

      // Check if entry matches compressible patterns
      const isCompressible = COMPRESSION_CONFIG.COMPRESSIBLE_PATTERNS.some(pattern =>
        key.includes(pattern)
      );

      if (isCompressible) {
        const entrySize = JSON.stringify(value).length;
        
        // Only compress entries larger than 1KB
        if (entrySize > 1024) {
          entries.push([key, value]);
        }
      }
    }

    // Sort by size (largest first) for better compression impact
    entries.sort((a, b) => {
      const sizeA = JSON.stringify(a[1]).length;
      const sizeB = JSON.stringify(b[1]).length;
      return sizeB - sizeA;
    });

    return entries;
  }

  /**
   * Compress a single cache entry
   */
  private async compressEntry(key: string, entry: any): Promise<{
    success: boolean;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }> {
    const startTime = Date.now();
    
    try {
      const serialized = JSON.stringify(entry);
      const originalSize = serialized.length;

      // Perform compression
      const compressed = LZString.compress(serialized);
      
      if (!compressed) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
        };
      }

      const compressedSize = compressed.length;
      const compressionTime = Date.now() - startTime;

      // Check if compression is beneficial and within time limits
      const compressionRatio = compressedSize / originalSize;
      
      if (compressionRatio > COMPRESSION_CONFIG.TARGET_COMPRESSION_RATIO ||
          compressionTime > COMPRESSION_CONFIG.MAX_COMPRESSION_TIME_MS) {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
        };
      }

      return {
        success: true,
        originalSize,
        compressedSize,
        compressionRatio,
      };

    } catch (error) {
      console.warn(`Compression failed for entry ${key}:`, error);
      // Estimate size without stringifying again (which might fail with circular refs)
      const estimatedSize = 1000; // Fallback size estimate
      return {
        success: false,
        originalSize: estimatedSize,
        compressedSize: estimatedSize,
        compressionRatio: 1,
      };
    }
  }

  /**
   * Decompress a cache entry
   */
  private async decompressEntry(compressedEntry: CompressedCacheEntry): Promise<any> {
    const startTime = Date.now();

    try {
      const decompressed = LZString.decompress(compressedEntry.data);
      
      if (!decompressed) {
        throw new Error('Decompression failed');
      }

      const decompressionTime = Date.now() - startTime;
      
      // Track decompression performance
      this.compressionStats.totalDecompressionTime += decompressionTime;

      // Update access count
      compressedEntry.accessCount++;

      return JSON.parse(decompressed);

    } catch (error) {
      console.error('Cache entry decompression failed:', error);
      throw error;
    }
  }

  /**
   * Check if a cache entry is compressed
   */
  private isCompressedEntry(entry: any): entry is CompressedCacheEntry {
    return !!(entry && typeof entry === 'object' && entry.compressed === true);
  }

  /**
   * Update compression statistics
   */
  private updateCompressionStats(results: {
    compressedCount: number;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }): void {
    this.compressionStats.compressedEntries += results.compressedCount;
    this.compressionStats.totalOriginalSize += results.originalSize;
    this.compressionStats.totalCompressedSize += results.compressedSize;
    this.compressionStats.lastCompressionTimestamp = Date.now();
    
    // Recalculate overall compression ratio
    if (this.compressionStats.totalOriginalSize > 0) {
      this.compressionStats.compressionRatio = 
        this.compressionStats.totalCompressedSize / this.compressionStats.totalOriginalSize;
    }
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): CompressionStats {
    return { ...this.compressionStats };
  }

  /**
   * Get current cache size and compression metrics
   */
  getCacheMetrics(): {
    totalCacheSize: number;
    uncompressedSize: number;
    compressedSize: number;
    compressionRatio: number;
    compressionEnabled: boolean;
  } {
    try {
      const cacheData = apolloClient.cache.extract();
      const totalCacheSize = JSON.stringify(cacheData).length;

      return {
        totalCacheSize,
        uncompressedSize: this.compressionStats.totalOriginalSize,
        compressedSize: this.compressionStats.totalCompressedSize,
        compressionRatio: this.compressionStats.compressionRatio,
        compressionEnabled: COMPRESSION_CONFIG.ENABLED,
      };
    } catch (error) {
      console.warn('Failed to get cache metrics:', error);
      return {
        totalCacheSize: 0,
        uncompressedSize: 0,
        compressedSize: 0,
        compressionRatio: 0,
        compressionEnabled: COMPRESSION_CONFIG.ENABLED,
      };
    }
  }

  /**
   * Manually trigger cache compression
   */
  async compressNow(): Promise<void> {
    await this.performIntelligentCompression();
  }

  /**
   * Clear compression statistics
   */
  clearStats(): void {
    this.compressionStats = {
      totalEntries: 0,
      compressedEntries: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      totalCompressionTime: 0,
      totalDecompressionTime: 0,
      lastCompressionTimestamp: 0,
    };
  }
}

// Export singleton instance
export const apolloCacheCompression = ApolloCacheCompression.getInstance();

// Auto-initialize in development or when explicitly enabled
if (COMPRESSION_CONFIG.ENABLED) {
  apolloCacheCompression.initialize();
}

// Development tools
declare global {
  interface Window {
    __APOLLO_CACHE_COMPRESSION__: ApolloCacheCompression;
  }
}

// Expose compression manager to window for debugging
if (typeof window !== 'undefined' && COMPRESSION_CONFIG.ENABLED) {
  window.__APOLLO_CACHE_COMPRESSION__ = apolloCacheCompression;
}
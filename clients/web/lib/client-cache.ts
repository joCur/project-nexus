/**
 * Client-side cache utility for persisting data across browser sessions
 * Provides type-safe storage with expiration and validation
 */

// Configuration constants for cache TTL
const CACHE_CONFIG = {
  // Default TTL values in milliseconds
  DEFAULT_ONBOARDING_TTL: 5 * 60 * 1000, // 5 minutes
  DEFAULT_USER_PROFILE_TTL: 15 * 60 * 1000, // 15 minutes  
  DEFAULT_SESSION_TTL: 60 * 1000, // 1 minute
  
  // Get configurable TTL from environment or use defaults
  get ONBOARDING_TTL() {
    const envTtl = process.env.NEXT_PUBLIC_CACHE_ONBOARDING_TTL;
    return envTtl ? parseInt(envTtl, 10) * 1000 : this.DEFAULT_ONBOARDING_TTL;
  },
  
  get USER_PROFILE_TTL() {
    const envTtl = process.env.NEXT_PUBLIC_CACHE_USER_PROFILE_TTL;
    return envTtl ? parseInt(envTtl, 10) * 1000 : this.DEFAULT_USER_PROFILE_TTL;
  },
  
  get SESSION_TTL() {
    const envTtl = process.env.NEXT_PUBLIC_CACHE_SESSION_TTL;
    return envTtl ? parseInt(envTtl, 10) * 1000 : this.DEFAULT_SESSION_TTL;
  },
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt?: number;
  version: string;
}

interface CacheOptions {
  /**
   * Time-to-live in milliseconds
   * If not provided, data never expires
   */
  ttl?: number;
  /**
   * Cache version for invalidation
   * Increment when data structure changes
   */
  version?: string;
  /**
   * Storage type - sessionStorage clears on tab close, localStorage persists
   */
  storage?: 'localStorage' | 'sessionStorage';
}

/**
 * Storage quota status and management
 */
interface StorageQuota {
  available: boolean;
  usedBytes: number;
  quotaBytes?: number;
  usagePercentage?: number;
}

/**
 * Storage quota error types
 */
class StorageQuotaError extends Error {
  constructor(message: string, public quotaInfo: StorageQuota) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/**
 * Generic client-side cache with type safety, expiration, and quota management
 */
class ClientCache {
  private storage: Storage | null = null;
  private isClient = typeof window !== 'undefined';
  private quotaCheckCache: Map<string, { timestamp: number; available: boolean }> = new Map();
  private readonly QUOTA_CHECK_TTL = 30 * 1000; // 30 seconds

  constructor(private defaultStorage: 'localStorage' | 'sessionStorage' = 'localStorage') {
    if (this.isClient) {
      this.storage = this.defaultStorage === 'localStorage' ? window.localStorage : window.sessionStorage;
    }
  }

  /**
   * Set an item in cache with optional expiration and quota checking
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): boolean {
    if (!this.storage) return false;

    const storage = options.storage 
      ? (options.storage === 'localStorage' ? window.localStorage : window.sessionStorage)
      : this.storage;

    // Prepare the entry outside the try block so it's available in catch
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: options.version || '1.0',
      expiresAt: options.ttl ? Date.now() + options.ttl : undefined,
    };

    const serializedEntry = JSON.stringify(entry);

    try {
      // Check storage quota before attempting to write
      const quotaInfo = this.checkStorageQuota(storage, serializedEntry.length);
      if (!quotaInfo.available) {
        console.warn(`Storage quota exceeded for key "${key}". Attempting cleanup...`);
        
        // Try to free up space by removing expired entries
        const cleanedUp = this.cleanupExpiredEntries(storage);
        if (cleanedUp > 0) {
          // Retry quota check after cleanup
          const retryQuota = this.checkStorageQuota(storage, serializedEntry.length);
          if (!retryQuota.available) {
            throw new StorageQuotaError('Storage quota exceeded even after cleanup', retryQuota);
          }
        } else {
          throw new StorageQuotaError('Storage quota exceeded and no cleanup possible', quotaInfo);
        }
      }

      storage.setItem(key, serializedEntry);
      return true;
    } catch (error) {
      if (error instanceof StorageQuotaError) {
        console.error(`Storage quota error for key "${key}":`, {
          message: error.message,
          quotaInfo: error.quotaInfo
        });
      } else if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Fallback for browsers that don't support StorageManager API
        console.error(`Storage quota exceeded for key "${key}". Attempting cleanup...`);
        const cleaned = this.cleanupExpiredEntries(storage);
        if (cleaned > 0) {
          // Retry once after cleanup
          try {
            storage.setItem(key, serializedEntry);
            return true;
          } catch (retryError) {
            console.error(`Storage quota exceeded for key "${key}" even after cleanup`);
          }
        }
      } else {
        console.warn(`Failed to cache data for key "${key}":`, error);
      }
      return false;
    }
  }

  /**
   * Get an item from cache, with automatic expiration check
   */
  get<T>(key: string, options: CacheOptions = {}): T | null {
    if (!this.storage) return null;

    try {
      const storage = options.storage 
        ? (options.storage === 'localStorage' ? window.localStorage : window.sessionStorage)
        : this.storage;

      const item = storage.getItem(key);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);

      // Check version compatibility
      if (options.version && entry.version !== options.version) {
        this.remove(key, { storage: options.storage });
        return null;
      }

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.remove(key, { storage: options.storage });
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn(`Failed to retrieve cached data for key "${key}":`, error);
      this.remove(key, { storage: options.storage });
      return null;
    }
  }

  /**
   * Remove an item from cache
   */
  remove(key: string, options: { storage?: 'localStorage' | 'sessionStorage' } = {}): boolean {
    if (!this.storage) return false;

    try {
      const storage = options.storage 
        ? (options.storage === 'localStorage' ? window.localStorage : window.sessionStorage)
        : this.storage;

      storage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove cached data for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Check if an item exists in cache and is still valid
   */
  has(key: string, options: CacheOptions = {}): boolean {
    return this.get(key, options) !== null;
  }

  /**
   * Clear all cache data (use with caution)
   */
  clear(options: { storage?: 'localStorage' | 'sessionStorage' } = {}): boolean {
    if (!this.storage) return false;

    try {
      const storage = options.storage 
        ? (options.storage === 'localStorage' ? window.localStorage : window.sessionStorage)
        : this.storage;

      storage.clear();
      return true;
    } catch (error) {
      console.warn('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Check storage quota availability
   */
  private checkStorageQuota(storage: Storage, additionalBytes: number = 0): StorageQuota {
    const storageType = storage === window.localStorage ? 'localStorage' : 'sessionStorage';
    const cacheKey = `quota-${storageType}`;
    
    // Check cache first to avoid expensive quota checks
    const cached = this.quotaCheckCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.QUOTA_CHECK_TTL) {
      return {
        available: cached.available,
        usedBytes: 0, // We don't cache exact bytes
      };
    }

    try {
      // Try modern StorageManager API first
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        // Note: This is async but we need sync behavior, so we use cached results
        // The async version would be better but requires API changes
      }
      
      // Calculate current usage (rough estimate)
      let usedBytes = 0;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          const value = storage.getItem(key);
          if (value) {
            usedBytes += key.length + value.length;
          }
        }
      }
      
      // Estimate quota (browsers typically allow 5-10MB for localStorage)
      const estimatedQuota = storageType === 'localStorage' ? 5 * 1024 * 1024 : 1024 * 1024; // 5MB for localStorage, 1MB for sessionStorage
      const availableBytes = estimatedQuota - usedBytes;
      const isAvailable = availableBytes > additionalBytes;
      
      const quotaInfo: StorageQuota = {
        available: isAvailable,
        usedBytes,
        quotaBytes: estimatedQuota,
        usagePercentage: (usedBytes / estimatedQuota) * 100,
      };
      
      // Cache the result
      this.quotaCheckCache.set(cacheKey, {
        timestamp: Date.now(),
        available: isAvailable,
      });
      
      return quotaInfo;
    } catch (error) {
      console.warn('Failed to check storage quota:', error);
      return {
        available: true, // Assume available on error
        usedBytes: 0,
      };
    }
  }

  /**
   * Clean up expired cache entries to free up space
   */
  private cleanupExpiredEntries(storage: Storage): number {
    let cleanedCount = 0;
    const keysToRemove: string[] = [];
    
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('nexus:')) { // Only clean our cache entries
          try {
            const item = storage.getItem(key);
            if (item) {
              const entry: CacheEntry<unknown> = JSON.parse(item);
              if (entry.expiresAt && Date.now() > entry.expiresAt) {
                keysToRemove.push(key);
              }
            }
          } catch (parseError) {
            // Remove malformed entries
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => {
        storage.removeItem(key);
        cleanedCount++;
      });
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired cache entries`);
        // Clear quota check cache after cleanup
        this.quotaCheckCache.clear();
      }
      
    } catch (error) {
      console.warn('Failed to cleanup expired entries:', error);
    }
    
    return cleanedCount;
  }

  /**
   * Get storage quota information
   */
  async getQuotaInfo(storageType?: 'localStorage' | 'sessionStorage'): Promise<StorageQuota> {
    const storage = storageType 
      ? (storageType === 'localStorage' ? window.localStorage : window.sessionStorage)
      : this.storage;
      
    if (!storage) {
      return { available: false, usedBytes: 0 };
    }

    // Try modern API first
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const usedBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || 0;
        
        return {
          available: quotaBytes > usedBytes,
          usedBytes,
          quotaBytes,
          usagePercentage: quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0,
        };
      } catch (error) {
        console.warn('StorageManager.estimate() failed:', error);
      }
    }

    // Fallback to manual calculation
    return this.checkStorageQuota(storage);
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): { isSupported: boolean; itemCount: number; storageType: string } {
    if (!this.storage) {
      return { isSupported: false, itemCount: 0, storageType: 'none' };
    }

    return {
      isSupported: true,
      itemCount: this.storage.length,
      storageType: this.defaultStorage,
    };
  }
}

// Create singleton instances for different storage types
export const localCache = new ClientCache('localStorage');
export const sessionCache = new ClientCache('sessionStorage');

// Default export uses localStorage for persistence across sessions
export default localCache;

// Specialized cache keys for onboarding system
export const CACHE_KEYS = {
  ONBOARDING_STATUS: 'nexus:onboarding:status',
  USER_PROFILE: 'nexus:user:profile',
  AUTH_SESSION: 'nexus:auth:session',
} as const;

// Cache versions for breaking changes
export const CACHE_VERSIONS = {
  ONBOARDING_V1: '1.0',
  USER_PROFILE_V1: '1.0',
  AUTH_SESSION_V1: '1.0',
} as const;

// Common cache options with configurable TTL
export const CACHE_OPTIONS = {
  ONBOARDING_STATUS: {
    ttl: CACHE_CONFIG.ONBOARDING_TTL,
    version: CACHE_VERSIONS.ONBOARDING_V1,
    storage: 'localStorage' as const,
  },
  USER_PROFILE: {
    ttl: CACHE_CONFIG.USER_PROFILE_TTL,
    version: CACHE_VERSIONS.USER_PROFILE_V1,
    storage: 'localStorage' as const,
  },
  SESSION_INFO: {
    ttl: CACHE_CONFIG.SESSION_TTL,
    version: CACHE_VERSIONS.AUTH_SESSION_V1,
    storage: 'sessionStorage' as const,
  },
} as const;

// Export cache configuration and quota utilities for external use
export { CACHE_CONFIG, StorageQuotaError };
export type { StorageQuota };
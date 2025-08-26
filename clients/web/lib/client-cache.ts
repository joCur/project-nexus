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
 * Generic client-side cache with type safety and expiration
 */
class ClientCache {
  private storage: Storage | null = null;
  private isClient = typeof window !== 'undefined';

  constructor(private defaultStorage: 'localStorage' | 'sessionStorage' = 'localStorage') {
    if (this.isClient) {
      this.storage = this.defaultStorage === 'localStorage' ? window.localStorage : window.sessionStorage;
    }
  }

  /**
   * Set an item in cache with optional expiration
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): boolean {
    if (!this.storage) return false;

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: options.version || '1.0',
        expiresAt: options.ttl ? Date.now() + options.ttl : undefined,
      };

      const storage = options.storage 
        ? (options.storage === 'localStorage' ? window.localStorage : window.sessionStorage)
        : this.storage;

      storage.setItem(key, JSON.stringify(entry));
      return true;
    } catch (error) {
      console.warn(`Failed to cache data for key "${key}":`, error);
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

// Export cache configuration for external use
export { CACHE_CONFIG };
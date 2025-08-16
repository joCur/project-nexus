import Redis from 'ioredis';
import { redisConfig } from '@/config/environment';
import { createContextLogger, performanceLogger } from '@/utils/logger';

/**
 * Redis caching service for sessions, permissions, and performance optimization
 * Implements caching strategies from technical specifications
 */

const logger = createContextLogger({ service: 'CacheService' });

export class CacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis(redisConfig.url, {
      password: redisConfig.password,
      db: redisConfig.db,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupEventListeners();
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      this.isConnected = true;
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const startTime = Date.now();

    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(key, Math.floor(ttl / 1000), serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }

      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'set', duration, true, {
        key,
        ttl,
        valueSize: serializedValue.length,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'set', duration, false, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Failed to set cache value', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Don't throw error for cache failures - fail gracefully
    }
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<string | null> {
    const startTime = Date.now();

    try {
      const value = await this.redis.get(key);
      
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'get', duration, true, {
        key,
        hit: value !== null,
      });

      return value;

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'get', duration, false, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Failed to get cache value', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return null; // Fail gracefully
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.redis.del(key);
      
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'del', duration, true, { key });

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'del', duration, false, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Failed to delete cache value', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check cache key existence', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, Math.floor(ttl / 1000));
    } catch (error) {
      logger.error('Failed to set key expiration', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const ttl = await this.redis.ttl(key);
      return ttl * 1000; // Convert to milliseconds
    } catch (error) {
      logger.error('Failed to get key TTL', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return -1;
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      logger.error('Failed to increment cache value', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(keyValuePairs: Record<string, any>): Promise<void> {
    const startTime = Date.now();

    try {
      const pairs: string[] = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        pairs.push(key, JSON.stringify(value));
      }
      
      await this.redis.mset(...pairs);
      
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'mset', duration, true, {
        keyCount: Object.keys(keyValuePairs).length,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'mset', duration, false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Failed to set multiple cache values', {
        keys: Object.keys(keyValuePairs),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    const startTime = Date.now();

    try {
      const values = await this.redis.mget(...keys);
      
      const duration = Date.now() - startTime;
      const hits = values.filter(v => v !== null).length;
      
      performanceLogger.externalService('Redis', 'mget', duration, true, {
        keyCount: keys.length,
        hits,
        hitRate: hits / keys.length,
      });

      return values;

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Redis', 'mget', duration, false, {
        keyCount: keys.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Failed to get multiple cache values', {
        keys,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return keys.map(() => null);
    }
  }

  /**
   * Delete multiple keys at once
   */
  async mdel(keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Failed to delete multiple cache values', {
        keys,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keyCount: number;
    memoryUsage: string;
    hitRate?: number;
    connections: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const clients = await this.redis.info('clients');
      
      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
      
      // Parse key count
      const keyspaceMatch = keyspace.match(/keys=(\d+)/);
      const keyCount = keyspaceMatch ? parseInt(keyspaceMatch[1], 10) : 0;
      
      // Parse connections
      const connectionsMatch = clients.match(/connected_clients:(\d+)/);
      const connections = connectionsMatch ? parseInt(connectionsMatch[1], 10) : 0;

      return {
        keyCount,
        memoryUsage,
        connections,
      };

    } catch (error) {
      logger.error('Failed to get cache stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        keyCount: 0,
        memoryUsage: 'Unknown',
        connections: 0,
      };
    }
  }

  /**
   * Health check for Redis connectivity
   */
  async healthCheck(): Promise<{ status: 'OK' | 'ERROR'; responseTime: number; error?: string }> {
    const startTime = Date.now();

    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;
      return { status: 'OK', responseTime };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'ERROR',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnectedToRedis(): boolean {
    return this.isConnected && this.redis.status === 'ready';
  }

  /**
   * Setup Redis event listeners
   */
  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connecting...');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis connection ready');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis connection error', {
        error: error.message,
      });
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', (delay) => {
      logger.info('Redis reconnecting', { delay });
    });

    this.redis.on('end', () => {
      this.isConnected = false;
      logger.info('Redis connection ended');
    });
  }
}
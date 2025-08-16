import Redis from 'ioredis';
import { CacheService } from '@/services/cache';
import { ERROR_SCENARIOS } from '../../utils/test-helpers';

// Mock ioredis
jest.mock('ioredis');
jest.mock('@/utils/logger');

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Create mock Redis instance
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      setex: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      incr: jest.fn().mockResolvedValue(1),
      mset: jest.fn().mockResolvedValue('OK'),
      mget: jest.fn().mockResolvedValue([]),
      flushdb: jest.fn().mockResolvedValue('OK'),
      info: jest.fn().mockResolvedValue(''),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      status: 'ready',
    } as any;

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    cacheService = new CacheService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      // Arrange
      mockRedis.connect.mockResolvedValue(undefined);

      // Act
      await cacheService.connect();

      // Assert
      expect(mockRedis.connect).toHaveBeenCalled();
      expect(cacheService.isConnectedToRedis()).toBe(true);
    });

    it('should handle connection errors', async () => {
      // Arrange
      mockRedis.connect.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.connect()).rejects.toThrow();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      // Arrange
      const key = 'test:key';
      const value = { data: 'test value' };

      // Act
      await cacheService.set(key, value);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(key, JSON.stringify(value));
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should set value with TTL', async () => {
      // Arrange
      const key = 'test:key';
      const value = { data: 'test value' };
      const ttl = 60000; // 60 seconds in milliseconds

      // Act
      await cacheService.set(key, value, ttl);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(key, 60, JSON.stringify(value));
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const key = 'test:key';
      const value = { data: 'test value' };
      mockRedis.set.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.set(key, value)).resolves.not.toThrow();
    });

    it('should handle complex object serialization', async () => {
      // Arrange
      const key = 'test:complex';
      const complexValue = {
        user: {
          id: 'user-123',
          permissions: ['read', 'write'],
          metadata: {
            lastLogin: new Date(),
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
      };

      // Act
      await cacheService.set(key, complexValue);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(complexValue)
      );
    });

    it('should handle null and undefined values', async () => {
      // Arrange
      const key = 'test:null';

      // Act
      await cacheService.set(key, null);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(key, 'null');
    });
  });

  describe('get', () => {
    it('should get existing value', async () => {
      // Arrange
      const key = 'test:key';
      const storedValue = JSON.stringify({ data: 'test value' });
      mockRedis.get.mockResolvedValue(storedValue);

      // Act
      const result = await cacheService.get(key);

      // Assert
      expect(result).toBe(storedValue);
      expect(mockRedis.get).toHaveBeenCalledWith(key);
    });

    it('should return null for non-existent key', async () => {
      // Arrange
      const key = 'test:nonexistent';
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await cacheService.get(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const key = 'test:error';
      mockRedis.get.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await cacheService.get(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle concurrent get operations', async () => {
      // Arrange
      const keys = ['key1', 'key2', 'key3', 'key4', 'key5'];
      mockRedis.get.mockImplementation((key) => 
        Promise.resolve(`value-${key}`)
      );

      const promises = keys.map(key => cacheService.get(key));

      // Act
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      keys.forEach((key, index) => {
        expect(results[index]).toBe(`value-${key}`);
      });
      expect(mockRedis.get).toHaveBeenCalledTimes(5);
    });
  });

  describe('del', () => {
    it('should delete existing key', async () => {
      // Arrange
      const key = 'test:key';
      mockRedis.del.mockResolvedValue(1);

      // Act
      await cacheService.del(key);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    it('should handle deletion of non-existent key', async () => {
      // Arrange
      const key = 'test:nonexistent';
      mockRedis.del.mockResolvedValue(0);

      // Act
      await cacheService.del(key);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const key = 'test:error';
      mockRedis.del.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.del(key)).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      // Arrange
      const key = 'test:existing';
      mockRedis.exists.mockResolvedValue(1);

      // Act
      const result = await cacheService.exists(key);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(key);
    });

    it('should return false for non-existent key', async () => {
      // Arrange
      const key = 'test:nonexistent';
      mockRedis.exists.mockResolvedValue(0);

      // Act
      const result = await cacheService.exists(key);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const key = 'test:error';
      mockRedis.exists.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await cacheService.exists(key);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('expire', () => {
    it('should set expiration for existing key', async () => {
      // Arrange
      const key = 'test:key';
      const ttl = 60000; // 60 seconds in milliseconds
      mockRedis.expire.mockResolvedValue(1);

      // Act
      await cacheService.expire(key, ttl);

      // Assert
      expect(mockRedis.expire).toHaveBeenCalledWith(key, 60);
    });

    it('should handle non-existent key', async () => {
      // Arrange
      const key = 'test:nonexistent';
      const ttl = 60000;
      mockRedis.expire.mockResolvedValue(0);

      // Act
      await cacheService.expire(key, ttl);

      // Assert
      expect(mockRedis.expire).toHaveBeenCalledWith(key, 60);
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const key = 'test:error';
      const ttl = 60000;
      mockRedis.expire.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.expire(key, ttl)).resolves.not.toThrow();
    });
  });

  describe('ttl', () => {
    it('should return TTL for key with expiration', async () => {
      // Arrange
      const key = 'test:key';
      mockRedis.ttl.mockResolvedValue(60); // 60 seconds

      // Act
      const result = await cacheService.ttl(key);

      // Assert
      expect(result).toBe(60000); // Converted to milliseconds
      expect(mockRedis.ttl).toHaveBeenCalledWith(key);
    });

    it('should return -1 for key without expiration', async () => {
      // Arrange
      const key = 'test:persistent';
      mockRedis.ttl.mockResolvedValue(-1);

      // Act
      const result = await cacheService.ttl(key);

      // Assert
      expect(result).toBe(-1000); // Converted to milliseconds
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const key = 'test:error';
      mockRedis.ttl.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await cacheService.ttl(key);

      // Assert
      expect(result).toBe(-1);
    });
  });

  describe('incr', () => {
    it('should increment numeric value', async () => {
      // Arrange
      const key = 'test:counter';
      mockRedis.incr.mockResolvedValue(5);

      // Act
      const result = await cacheService.incr(key);

      // Assert
      expect(result).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith(key);
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const key = 'test:error';
      mockRedis.incr.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await cacheService.incr(key);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('mset', () => {
    it('should set multiple key-value pairs', async () => {
      // Arrange
      const keyValuePairs = {
        'key1': { data: 'value1' },
        'key2': { data: 'value2' },
        'key3': { data: 'value3' },
      };

      // Act
      await cacheService.mset(keyValuePairs);

      // Assert
      expect(mockRedis.mset).toHaveBeenCalledWith(
        'key1', JSON.stringify({ data: 'value1' }),
        'key2', JSON.stringify({ data: 'value2' }),
        'key3', JSON.stringify({ data: 'value3' })
      );
    });

    it('should handle empty object', async () => {
      // Arrange
      const keyValuePairs = {};

      // Act
      await cacheService.mset(keyValuePairs);

      // Assert
      expect(mockRedis.mset).toHaveBeenCalledWith();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const keyValuePairs = { 'key1': 'value1' };
      mockRedis.mset.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.mset(keyValuePairs)).resolves.not.toThrow();
    });
  });

  describe('mget', () => {
    it('should get multiple values', async () => {
      // Arrange
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', null];
      mockRedis.mget.mockResolvedValue(values);

      // Act
      const result = await cacheService.mget(keys);

      // Assert
      expect(result).toEqual(values);
      expect(mockRedis.mget).toHaveBeenCalledWith(...keys);
    });

    it('should handle empty key array', async () => {
      // Arrange
      const keys: string[] = [];
      mockRedis.mget.mockResolvedValue([]);

      // Act
      const result = await cacheService.mget(keys);

      // Assert
      expect(result).toEqual([]);
      expect(mockRedis.mget).toHaveBeenCalledWith();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const keys = ['key1', 'key2'];
      mockRedis.mget.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await cacheService.mget(keys);

      // Assert
      expect(result).toEqual([null, null]);
    });
  });

  describe('mdel', () => {
    it('should delete multiple keys', async () => {
      // Arrange
      const keys = ['key1', 'key2', 'key3'];
      mockRedis.del.mockResolvedValue(3);

      // Act
      await cacheService.mdel(keys);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle empty key array', async () => {
      // Arrange
      const keys: string[] = [];

      // Act
      await cacheService.mdel(keys);

      // Assert
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const keys = ['key1', 'key2'];
      mockRedis.del.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.mdel(keys)).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      // Arrange
      mockRedis.flushdb.mockResolvedValue('OK');

      // Act
      await cacheService.clear();

      // Assert
      expect(mockRedis.flushdb).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      mockRedis.flushdb.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.clear()).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Arrange
      const memoryInfo = 'used_memory_human:1.5M\nused_memory:1572864';
      const keyspaceInfo = 'db0:keys=100,expires=50,avg_ttl=3600';
      const clientsInfo = 'connected_clients:10\nblocked_clients:0';

      mockRedis.info
        .mockResolvedValueOnce(memoryInfo)
        .mockResolvedValueOnce(keyspaceInfo)
        .mockResolvedValueOnce(clientsInfo);

      // Act
      const stats = await cacheService.getStats();

      // Assert
      expect(stats).toEqual({
        keyCount: 100,
        memoryUsage: '1.5M',
        connections: 10,
      });
      expect(mockRedis.info).toHaveBeenCalledWith('memory');
      expect(mockRedis.info).toHaveBeenCalledWith('keyspace');
      expect(mockRedis.info).toHaveBeenCalledWith('clients');
    });

    it('should handle missing information gracefully', async () => {
      // Arrange
      mockRedis.info.mockResolvedValue('');

      // Act
      const stats = await cacheService.getStats();

      // Assert
      expect(stats).toEqual({
        keyCount: 0,
        memoryUsage: 'Unknown',
        connections: 0,
      });
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      mockRedis.info.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const stats = await cacheService.getStats();

      // Assert
      expect(stats).toEqual({
        keyCount: 0,
        memoryUsage: 'Unknown',
        connections: 0,
      });
    });
  });

  describe('healthCheck', () => {
    it('should return OK status for healthy Redis', async () => {
      // Arrange
      mockRedis.ping.mockResolvedValue('PONG');

      // Act
      const result = await cacheService.healthCheck();

      // Assert
      expect(result.status).toBe('OK');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should return ERROR status for unhealthy Redis', async () => {
      // Arrange
      mockRedis.ping.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await cacheService.healthCheck();

      // Assert
      expect(result.status).toBe('ERROR');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    });

    it('should measure response time accurately', async () => {
      // Arrange
      mockRedis.ping.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve('PONG'), 50);
        });
      });

      // Act
      const result = await cacheService.healthCheck();

      // Assert
      expect(result.responseTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('close', () => {
    it('should close Redis connection successfully', async () => {
      // Arrange
      mockRedis.quit.mockResolvedValue('OK');

      // Act
      await cacheService.close();

      // Assert
      expect(mockRedis.quit).toHaveBeenCalled();
      expect(cacheService.isConnectedToRedis()).toBe(false);
    });

    it('should handle connection close errors', async () => {
      // Arrange
      mockRedis.quit.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(cacheService.close()).resolves.not.toThrow();
    });
  });

  describe('isConnectedToRedis', () => {
    it('should return true when connected and ready', () => {
      // Arrange
      mockRedis.status = 'ready';
      (cacheService as any).isConnected = true;

      // Act
      const result = cacheService.isConnectedToRedis();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when not connected', () => {
      // Arrange
      mockRedis.status = 'end' as any;
      (cacheService as any).isConnected = false;

      // Act
      const result = cacheService.isConnectedToRedis();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when connected but not ready', () => {
      // Arrange
      mockRedis.status = 'connecting';
      (cacheService as any).isConnected = true;

      // Act
      const result = cacheService.isConnectedToRedis();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Event listeners', () => {
    it('should setup Redis event listeners', () => {
      // Arrange & Act
      new CacheService();

      // Assert
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('end', expect.any(Function));
    });

    it('should update connection status on ready event', () => {
      // Arrange
      const service = new CacheService();
      const readyHandler = mockRedis.on.mock.calls.find(call => call[0] === 'ready')?.[1];

      // Act
      readyHandler?.();

      // Assert
      expect((service as any).isConnected).toBe(true);
    });

    it('should update connection status on error event', () => {
      // Arrange
      const service = new CacheService();
      const errorHandler = mockRedis.on.mock.calls.find(call => call[0] === 'error')?.[1];

      // Act
      errorHandler?.(new Error('Test error'));

      // Assert
      expect((service as any).isConnected).toBe(false);
    });
  });

  describe('Performance and load testing', () => {
    it('should handle high-frequency operations', async () => {
      // Arrange
      const operations = 1000;
      const startTime = Date.now();

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test-value');

      const promises = [];
      for (let i = 0; i < operations; i++) {
        promises.push(cacheService.set(`key:${i}`, `value:${i}`));
        promises.push(cacheService.get(`key:${i}`));
      }

      // Act
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockRedis.set).toHaveBeenCalledTimes(operations);
      expect(mockRedis.get).toHaveBeenCalledTimes(operations);
    });

    it('should handle concurrent operations without race conditions', async () => {
      // Arrange
      const key = 'test:concurrent';
      const concurrency = 50;

      mockRedis.incr.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(Math.floor(Math.random() * 100)), 1);
        });
      });

      const promises = Array(concurrency).fill(null).map(() => 
        cacheService.incr(key)
      );

      // Act
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(concurrency);
      expect(mockRedis.incr).toHaveBeenCalledTimes(concurrency);
    });
  });

  describe('Memory and resource management', () => {
    it('should handle large values efficiently', async () => {
      // Arrange
      const key = 'test:large';
      const largeValue = {
        data: 'x'.repeat(100000), // 100KB string
        array: Array(1000).fill({ nested: 'data' }),
        timestamp: Date.now(),
      };

      // Act
      await cacheService.set(key, largeValue);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(largeValue)
      );
    });

    it('should handle serialization of complex nested objects', async () => {
      // Arrange
      const key = 'test:complex';
      const complexValue = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, 3],
              map: { a: 1, b: 2 },
              date: new Date(),
              regexp: /test/gi,
            },
          },
        },
      };

      // Act
      await cacheService.set(key, complexValue);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(complexValue)
      );
    });
  });
});
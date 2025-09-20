/**
 * Apollo Cache Compression System Tests
 * 
 * Comprehensive tests for the Apollo Client cache compression system
 * including compression algorithms, performance metrics, and integration.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

import LZString from 'lz-string';
import { ApolloCacheCompression } from '../apollo-cache-compression';

// Mock dependencies
jest.mock('../apollo-client', () => ({
  apolloClient: {
    cache: {
      extract: jest.fn(),
    },
  },
}));

jest.mock('../permission-notification-system', () => ({
  emitPermissionEvent: jest.fn(),
}));

describe('Apollo Cache Compression', () => {
  let compression: ApolloCacheCompression;

  beforeEach(() => {
    compression = ApolloCacheCompression.getInstance();
    compression.clearStats();
    jest.clearAllMocks();
  });

  afterEach(() => {
    compression.shutdown();
  });

  describe('Compression System Initialization', () => {
    it('should initialize compression system', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      compression.initialize();
      
      // Should log initialization message in development
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should shutdown compression system cleanly', () => {
      compression.initialize();
      
      expect(() => compression.shutdown()).not.toThrow();
    });
  });

  describe('Cache Metrics and Statistics', () => {
    it('should return initial compression statistics', () => {
      const stats = compression.getCompressionStats();
      
      expect(stats).toEqual({
        totalEntries: 0,
        compressedEntries: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        compressionRatio: 0,
        totalCompressionTime: 0,
        totalDecompressionTime: 0,
        lastCompressionTimestamp: 0,
      });
    });

    it('should return cache metrics', () => {
      const { apolloClient } = require('../apollo-client');
      apolloClient.cache.extract.mockReturnValue({
        'ROOT_QUERY.getUserWorkspacePermissions': { permissions: ['read', 'write'] },
        'ROOT_QUERY.checkUserPermission': { hasPermission: true },
      });

      const metrics = compression.getCacheMetrics();
      
      expect(metrics).toHaveProperty('totalCacheSize');
      expect(metrics).toHaveProperty('compressionEnabled');
      expect(typeof metrics.totalCacheSize).toBe('number');
      expect(typeof metrics.compressionEnabled).toBe('boolean');
    });

    it('should handle cache extraction errors gracefully', () => {
      const { apolloClient } = require('../apollo-client');
      apolloClient.cache.extract.mockImplementation(() => {
        throw new Error('Cache extraction failed');
      });

      const metrics = compression.getCacheMetrics();
      
      expect(metrics.totalCacheSize).toBe(0);
      expect(metrics.compressionEnabled).toBe(false);
    });

    it('should clear statistics', () => {
      compression.clearStats();
      
      const stats = compression.getCompressionStats();
      expect(stats.compressedEntries).toBe(0);
      expect(stats.totalOriginalSize).toBe(0);
    });
  });

  describe('Compression Logic', () => {
    it('should identify compressible cache entries', () => {
      const mockCacheData = {
        'ROOT_QUERY.getUserWorkspacePermissions({"userId":"user1","workspaceId":"ws1"})': {
          permissions: Array(100).fill('some-permission-name'), // Large entry
        },
        'ROOT_QUERY.checkUserPermission({"userId":"user1","permission":"read"})': {
          hasPermission: true, // Small entry
        },
        'ROOT_QUERY.someOtherQuery': {
          data: 'not compressible pattern',
        },
        'Canvas:123': {
          id: '123',
          content: Array(200).fill('canvas-data'), // Large compressible entry
        },
      };

      // Test the private method through reflection (for testing purposes)
      const identifyMethod = (compression as any).identifyCompressibleEntries;
      const compressibleEntries = identifyMethod.call(compression, mockCacheData);

      expect(compressibleEntries.length).toBeGreaterThan(0);
      
      // Should include large permission entries
      const hasPermissionEntry = compressibleEntries.some(([key]: [string, any]) => 
        key.includes('getUserWorkspacePermissions')
      );
      expect(hasPermissionEntry).toBe(true);

      // Should include large canvas entries
      const hasCanvasEntry = compressibleEntries.some(([key]: [string, any]) => 
        key.includes('Canvas')
      );
      expect(hasCanvasEntry).toBe(true);

      // Should exclude small entries
      const hasSmallEntry = compressibleEntries.some(([key]: [string, any]) => 
        key.includes('checkUserPermission')
      );
      expect(hasSmallEntry).toBe(false);
    });

    it('should compress large data effectively', async () => {
      const largeData = {
        permissions: Array(1000).fill('workspace:read'),
        metadata: {
          timestamp: Date.now(),
          version: '1.0.0',
        },
      };

      const compressMethod = (compression as any).compressEntry;
      const result = await compressMethod.call(
        compression, 
        'test-key', 
        largeData
      );

      expect(result.success).toBe(true);
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.compressionRatio).toBeLessThan(1);
    });

    it('should not compress data that does not benefit from compression', async () => {
      // Since LZ-String is very effective, let's test the actual compression threshold behavior
      // Create data and mock the compression to return poor compression ratio
      const testData = { someData: 'test' };

      const compressMethod = (compression as any).compressEntry;
      
      // Mock LZString.compress to return a result that indicates poor compression
      const originalCompress = require('lz-string').compress;
      require('lz-string').compress = jest.fn().mockReturnValue(JSON.stringify(testData)); // Return uncompressed size
      
      const result = await compressMethod.call(
        compression, 
        'test-key', 
        testData
      );

      // Restore original function
      require('lz-string').compress = originalCompress;
      
      // Should fail compression due to poor compression ratio (1.0 means no compression benefit)
      expect(result.success).toBe(false);
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0.6); // Should exceed the 60% threshold
    });

    it('should handle compression errors gracefully', async () => {
      const invalidData = {
        circularRef: null as any,
      };
      invalidData.circularRef = invalidData; // Create circular reference

      const compressMethod = (compression as any).compressEntry;
      const result = await compressMethod.call(
        compression, 
        'test-key', 
        invalidData
      );

      expect(result.success).toBe(false);
      expect(result.compressionRatio).toBe(1);
    });
  });

  describe('Decompression Logic', () => {
    it('should decompress data correctly', async () => {
      const originalData = {
        permissions: ['read', 'write', 'admin'],
        metadata: { version: '1.0.0' },
      };

      const compressed = LZString.compress(JSON.stringify(originalData));
      const compressedEntry = {
        compressed: true as const,
        data: compressed!,
        originalSize: JSON.stringify(originalData).length,
        compressedSize: compressed!.length,
        compressionRatio: compressed!.length / JSON.stringify(originalData).length,
        timestamp: Date.now(),
        accessCount: 0,
      };

      const decompressMethod = (compression as any).decompressEntry;
      const decompressed = await decompressMethod.call(compression, compressedEntry);

      expect(decompressed).toEqual(originalData);
      expect(compressedEntry.accessCount).toBe(1);
    });

    it('should handle decompression errors', async () => {
      const invalidCompressedEntry = {
        compressed: true as const,
        data: 'invalid-compressed-data',
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        timestamp: Date.now(),
        accessCount: 0,
      };

      const decompressMethod = (compression as any).decompressEntry;
      
      await expect(
        decompressMethod.call(compression, invalidCompressedEntry)
      ).rejects.toThrow();
    });
  });

  describe('Compression Detection', () => {
    it('should correctly identify compressed entries', () => {
      const compressedEntry = {
        compressed: true,
        data: 'compressed-data',
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        timestamp: Date.now(),
        accessCount: 0,
      };

      const normalEntry = {
        permissions: ['read', 'write'],
      };

      const isCompressedMethod = (compression as any).isCompressedEntry;
      
      expect(isCompressedMethod.call(compression, compressedEntry)).toBe(true);
      expect(isCompressedMethod.call(compression, normalEntry)).toBe(false);
      expect(isCompressedMethod.call(compression, null)).toBe(false);
      expect(isCompressedMethod.call(compression, undefined)).toBe(false);
    });
  });

  describe('Performance Thresholds', () => {
    it('should respect compression time limits', async () => {
      // Create data that would take a long time to compress
      const veryLargeData = {
        data: Array(10000).fill('x').join(''),
      };

      const startTime = Date.now();
      const compressMethod = (compression as any).compressEntry;
      await compressMethod.call(
        compression, 
        'test-key', 
        veryLargeData
      );
      const duration = Date.now() - startTime;

      // Even if compression fails due to time limits, it should complete quickly
      expect(duration).toBeLessThan(1000); // Should complete within 1 second for tests
    });

    it('should reject compression with poor ratios', async () => {
      const poorlyCompressibleData = {
        // Data that doesn't compress well
        randomData: Array(1000).fill(0).map(() => Math.random().toString(36)).join(''),
      };

      const compressMethod = (compression as any).compressEntry;
      const result = await compressMethod.call(
        compression, 
        'test-key', 
        poorlyCompressibleData
      );

      // Should not compress data that doesn't meet compression ratio targets
      if (result.compressionRatio > 0.6) {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Manual Compression Trigger', () => {
    it('should allow manual compression trigger', async () => {
      const { apolloClient } = require('../apollo-client');
      apolloClient.cache.extract.mockReturnValue({
        'ROOT_QUERY.getUserWorkspacePermissions': { 
          permissions: Array(100).fill('permission-name'),
        },
      });

      await expect(compression.compressNow()).resolves.not.toThrow();
    });

    it('should handle manual compression with empty cache', async () => {
      const { apolloClient } = require('../apollo-client');
      apolloClient.cache.extract.mockReturnValue({});

      await expect(compression.compressNow()).resolves.not.toThrow();
    });
  });

  describe('Integration with Cache Monitor', () => {
    it('should provide metrics that integrate with cache monitor', () => {
      const stats = compression.getCompressionStats();
      const metrics = compression.getCacheMetrics();

      // Verify the structure matches what cache monitor expects
      expect(stats).toHaveProperty('compressedEntries');
      expect(stats).toHaveProperty('compressionRatio');
      expect(metrics).toHaveProperty('compressionEnabled');
      expect(metrics).toHaveProperty('uncompressedSize');
      expect(metrics).toHaveProperty('compressedSize');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null and undefined cache data', () => {
      const { apolloClient } = require('../apollo-client');
      apolloClient.cache.extract.mockReturnValue(null);

      expect(() => compression.getCacheMetrics()).not.toThrow();
    });

    it('should handle cache extraction exceptions', () => {
      const { apolloClient } = require('../apollo-client');
      apolloClient.cache.extract.mockImplementation(() => {
        throw new Error('Cache failure');
      });

      const metrics = compression.getCacheMetrics();
      expect(metrics.totalCacheSize).toBe(0);
    });

    it('should handle malformed cache entries', async () => {
      const malformedData = {
        someKey: Symbol('cannot be serialized'),
      };

      const compressMethod = (compression as any).compressEntry;
      const result = await compressMethod.call(
        compression,
        'test-key',
        malformedData
      );

      expect(result.success).toBe(false);
    });
  });
});
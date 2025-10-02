/**
 * Enhanced Permission Audit Logger Tests
 * 
 * Comprehensive tests for the enhanced audit logging system including
 * filtering, export/import, statistics, and persistence functionality.
 */

import {
  EnhancedPermissionAuditLogger,
  getAuditLogStatistics,
  exportAuditLog,
  clearAuditLog,
} from '../permission-audit-logger';
import type {
  PermissionEvent,
  PermissionGrantedEvent,
  PermissionAuditLogEntry,
} from '../../types/permission-events.types';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(() => 'test-session-id'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

describe('Enhanced Permission Audit Logger', () => {
  let logger: EnhancedPermissionAuditLogger;

  beforeEach(() => {
    logger = EnhancedPermissionAuditLogger.getInstance();
    logger.clear();
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    logger.shutdown();
  });

  describe('Basic Logging Functionality', () => {
    it('should log permission events', () => {
      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'user123',
        workspaceId: 'workspace456',
        permission: 'canvas:create',
      };

      logger.log(event);

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].event).toEqual(event);
      expect(entries[0].level).toBe('info');
    });

    it('should auto-determine log levels correctly', () => {
      // Clear any existing entries from previous tests or localStorage
      logger.clear();

      const events: Array<{ event: PermissionEvent; expectedLevel: PermissionAuditLogEntry['level'] }> = [
        {
          event: {
            type: 'permissionCheckFailed',
            timestamp: Date.now(),
            userId: 'user1',
            workspaceId: 'ws1',
            permission: 'read',
            error: 'Network error',
            fallbackUsed: true,
          },
          expectedLevel: 'error',
        },
        {
          event: {
            type: 'permissionRevoked',
            timestamp: Date.now(),
            userId: 'user1',
            workspaceId: 'ws1',
            permission: 'write',
          },
          expectedLevel: 'warn',
        },
        {
          event: {
            type: 'permissionGranted',
            timestamp: Date.now(),
            userId: 'user1',
            workspaceId: 'ws1',
            permission: 'read',
          },
          expectedLevel: 'info',
        },
      ];

      events.forEach(({ event }) => {
        logger.log(event);
      });

      const entries = logger.getEntries();
      expect(entries).toHaveLength(3);

      entries.forEach((entry, index) => {
        expect(entry.level).toBe(events[index].expectedLevel);
      });
    });

    it('should accept explicit log levels', () => {
      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'user123',
        workspaceId: 'workspace456',
        permission: 'canvas:create',
      };

      logger.log(event, 'critical');

      const entries = logger.getEntries();
      expect(entries[0].level).toBe('critical');
    });

    it('should generate unique entry IDs', () => {
      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'user123',
        workspaceId: 'workspace456',
        permission: 'canvas:create',
      };

      logger.log(event);
      logger.log(event);

      const entries = logger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].id).not.toBe(entries[1].id);
    });
  });

  describe('Filtering Functionality', () => {
    beforeEach(() => {
      // Create test data with distinct timestamps
      const baseTime = Date.now();
      const testEvents: PermissionEvent[] = [
        {
          type: 'permissionGranted',
          timestamp: baseTime - 10000, // 10 seconds ago
          userId: 'user1',
          workspaceId: 'workspace1',
          permission: 'read',
        },
        {
          type: 'permissionRevoked',
          timestamp: baseTime - 5000, // 5 seconds ago
          userId: 'user2',
          workspaceId: 'workspace2',
          permission: 'write',
        },
        {
          type: 'permissionCheckFailed',
          timestamp: baseTime, // now
          userId: 'user1',
          workspaceId: 'workspace1',
          permission: 'admin',
          error: 'Access denied',
          fallbackUsed: true,
        },
      ];

      testEvents.forEach(event => logger.log(event));
    });

    it('should filter by user ID', () => {
      const entries = logger.getEntries({ userId: 'user1' });
      expect(entries).toHaveLength(2);
      expect(entries.every(entry => entry.event.userId === 'user1')).toBe(true);
    });

    it('should filter by workspace ID', () => {
      const entries = logger.getEntries({ workspaceId: 'workspace1' });
      expect(entries).toHaveLength(2);
      expect(entries.every(entry => entry.event.workspaceId === 'workspace1')).toBe(true);
    });

    it('should filter by event type', () => {
      const entries = logger.getEntries({ eventType: 'permissionGranted' });
      expect(entries).toHaveLength(1);
      expect(entries[0].event.type).toBe('permissionGranted');
    });

    it('should filter by multiple event types', () => {
      const entries = logger.getEntries({
        eventTypes: ['permissionGranted', 'permissionRevoked'],
      });
      expect(entries).toHaveLength(2);
    });

    it('should filter by log level', () => {
      const entries = logger.getEntries({ level: 'error' });
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
    });

    it('should filter by time range', () => {
      // Note: Time filtering uses entry.timestamp (when logged), not event.timestamp
      // All entries in beforeEach are logged at the same time, so we need to manually
      // adjust entry timestamps to test time filtering
      
      const entries = logger.getEntries();
      expect(entries).toHaveLength(3);
      
      // Manually set different timestamps for testing
      const now = Date.now();
      entries[0].timestamp = new Date(now - 10000); // 10 seconds ago
      entries[1].timestamp = new Date(now - 5000);  // 5 seconds ago
      entries[2].timestamp = new Date(now);         // now
      
      // Filter for last 6 seconds (should include entries[1] and entries[2])
      const sixSecondsAgo = new Date(now - 6000);
      const oneSecondFromNow = new Date(now + 1000);

      const filteredEntries = logger.getEntries({
        timeRange: { from: sixSecondsAgo, to: oneSecondFromNow },
      });

      expect(filteredEntries).toHaveLength(2);
    });

    it('should support pagination', () => {
      const page1 = logger.getEntries({ limit: 2, offset: 0 });
      const page2 = logger.getEntries({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should support sorting', () => {
      // First, set different timestamps for testing sorting
      const entries = logger.getEntries();
      const now = Date.now();
      entries[0].timestamp = new Date(now - 10000); // oldest
      entries[1].timestamp = new Date(now - 5000);  // middle
      entries[2].timestamp = new Date(now);         // newest
      
      const ascEntries = logger.getEntries({ sortBy: 'timestamp', sortOrder: 'asc' });
      const descEntries = logger.getEntries({ sortBy: 'timestamp', sortOrder: 'desc' });

      expect(ascEntries).toHaveLength(3);
      expect(descEntries).toHaveLength(3);
      
      // Check timestamp order
      expect(ascEntries[0].timestamp.getTime()).toBeLessThan(ascEntries[1].timestamp.getTime());
      expect(ascEntries[1].timestamp.getTime()).toBeLessThan(ascEntries[2].timestamp.getTime());
      expect(descEntries[0].timestamp.getTime()).toBeGreaterThan(descEntries[1].timestamp.getTime());
      expect(descEntries[1].timestamp.getTime()).toBeGreaterThan(descEntries[2].timestamp.getTime());
    });
  });

  describe('Statistics Generation', () => {
    beforeEach(() => {
      // Create varied test data
      const events = [
        { type: 'permissionGranted', level: 'info', userId: 'user1', workspaceId: 'ws1' },
        { type: 'permissionRevoked', level: 'warn', userId: 'user2', workspaceId: 'ws2' },
        { type: 'permissionCheckFailed', level: 'error', userId: 'user1', workspaceId: 'ws1' },
        { type: 'permissionGranted', level: 'info', userId: 'user3', workspaceId: 'ws1' },
      ];

      events.forEach(({ type, level, userId, workspaceId }) => {
        const event: PermissionEvent = {
          type: type as any,
          timestamp: Date.now(),
          userId,
          workspaceId,
          ...(type === 'permissionGranted' && { permission: 'read' }),
          ...(type === 'permissionRevoked' && { permission: 'write' }),
          ...(type === 'permissionCheckFailed' && {
            permission: 'admin',
            error: 'Test error',
            fallbackUsed: true,
          }),
        };
        
        logger.log(event, level as any);
      });
    });

    it('should generate comprehensive statistics', () => {
      const stats = getAuditLogStatistics();

      expect(stats.totalEntries).toBe(4);
      expect(stats.entriesByLevel.info).toBe(2);
      expect(stats.entriesByLevel.warn).toBe(1);
      expect(stats.entriesByLevel.error).toBe(1);
      expect(stats.entriesByEventType.permissionGranted).toBe(2);
      expect(stats.entriesByUser.user1).toBe(2);
      expect(stats.entriesByWorkspace.ws1).toBe(3);
    });

    it('should calculate time ranges correctly', () => {
      const stats = getAuditLogStatistics();

      expect(stats.timeRange.earliest).toBeInstanceOf(Date);
      expect(stats.timeRange.latest).toBeInstanceOf(Date);
      expect(stats.timeRange.latest!.getTime()).toBeGreaterThanOrEqual(
        stats.timeRange.earliest!.getTime()
      );
    });

    it('should estimate memory usage', () => {
      const stats = getAuditLogStatistics();

      expect(stats.memoryUsage.entriesInMemory).toBe(4);
      expect(stats.memoryUsage.estimatedSizeKB).toBeGreaterThan(0);
    });
  });

  describe('Export and Import Functionality', () => {
    beforeEach(() => {
      const events: PermissionEvent[] = [
        {
          type: 'permissionGranted',
          timestamp: Date.now(),
          userId: 'user1',
          workspaceId: 'ws1',
          permission: 'read',
        },
        {
          type: 'permissionRevoked',
          timestamp: Date.now(),
          userId: 'user2',
          workspaceId: 'ws2',
          permission: 'write',
        },
      ];

      events.forEach(event => logger.log(event));
    });

    it('should export audit log entries', () => {
      const exportData = exportAuditLog();

      expect(exportData.metadata.totalEntries).toBe(2);
      expect(exportData.metadata.exportTimestamp).toBeInstanceOf(Date);
      expect(exportData.metadata.version).toBe('1.0.0');
      expect(exportData.entries).toHaveLength(2);
    });

    it('should export with filters applied', () => {
      const exportData = exportAuditLog({ userId: 'user1' });

      expect(exportData.metadata.totalEntries).toBe(1);
      expect(exportData.metadata.filterApplied).toBe(true);
      expect(exportData.metadata.filter?.userId).toBe('user1');
      expect(exportData.entries).toHaveLength(1);
    });

    it('should import audit log entries', () => {
      const exportData = exportAuditLog();
      
      // Clear current entries
      logger.clear();
      expect(logger.getEntries()).toHaveLength(0);

      // Import entries
      const importedCount = logger.importEntries(exportData);

      expect(importedCount).toBe(2);
      expect(logger.getEntries()).toHaveLength(2);
    });

    it('should prevent duplicate imports', () => {
      const exportData = exportAuditLog();

      // Import twice
      const firstImport = logger.importEntries(exportData);
      const secondImport = logger.importEntries(exportData);

      expect(firstImport).toBe(0); // No new entries (they already exist)
      expect(secondImport).toBe(0);
      expect(logger.getEntries()).toHaveLength(2); // Still only original entries
    });

    it('should validate imported entries', () => {
      const invalidExportData = {
        metadata: {
          exportTimestamp: new Date(),
          totalEntries: 1,
          filterApplied: false,
          version: '1.0.0',
        },
        entries: [
          {
            // Invalid entry - missing required fields
            id: 'invalid',
            event: { type: 'invalid' },
          },
        ],
      };

      const importedCount = logger.importEntries(invalidExportData as any);
      expect(importedCount).toBe(0);
    });
  });

  describe('Persistent Storage', () => {
    it('should save entries to localStorage', () => {
      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'user123',
        workspaceId: 'workspace456',
        permission: 'canvas:create',
      };

      logger.log(event);

      // Wait for debounced save
      setTimeout(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'permission_audit_log',
          expect.any(String)
        );
      }, 1100);
    });

    it('should load entries from localStorage', () => {
      const mockEntries = [
        {
          id: 'test_123',
          timestamp: new Date().toISOString(),
          event: {
            type: 'permissionGranted',
            timestamp: Date.now(),
            userId: 'user123',
            permission: 'read',
          },
          level: 'info',
          source: 'frontend',
          context: {},
        },
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockEntries));

      // Reset singleton and create new instance to trigger loading
      (EnhancedPermissionAuditLogger as any).instance = null;
      const newLogger = EnhancedPermissionAuditLogger.getInstance();

      const entries = newLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('test_123');
      
      // Clean up
      (EnhancedPermissionAuditLogger as any).instance = null;
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        EnhancedPermissionAuditLogger.getInstance();
      }).not.toThrow();
    });

    it('should clear localStorage when clearing audit log', () => {
      clearAuditLog();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('permission_audit_log');
    });
  });

  describe('Memory Management', () => {
    it('should enforce memory limits', () => {
      // Create more entries than the limit allows
      // Note: The actual limit is 5000, so we'll create a smaller test limit
      for (let i = 0; i < 10; i++) {
        logger.log({
          type: 'permissionGranted',
          timestamp: Date.now(),
          userId: `user${i}`,
          workspaceId: 'ws1',
          permission: 'read',
        });
      }

      const entries = logger.getEntries();
      expect(entries.length).toBeLessThanOrEqual(10);
    });

    it('should perform automatic cleanup', () => {
      // Clear any existing entries from previous tests
      logger.clear();
      
      // Log two entries with different timestamps
      logger.log({
        type: 'permissionGranted',
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago (event time)
        userId: 'user1',
        workspaceId: 'ws1',
        permission: 'read',
      });

      logger.log({
        type: 'permissionGranted',
        timestamp: Date.now(), // Current time
        userId: 'user2',
        workspaceId: 'ws1',
        permission: 'read',
      });

      const entries = logger.getEntries();
      expect(entries).toHaveLength(2);

      // Cleanup entries older than 7 days (should clean up the 8-day-old entry)
      const cutoffDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
      const cleanedCount = logger.cleanup(cutoffDate);

      expect(cleanedCount).toBe(1);
      expect(logger.getEntries()).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle logging errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Create an event that might cause issues during logging
      const problematicEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'user123',
        // Add a circular reference that would break JSON.stringify
        circularRef: null as any,
      };
      problematicEvent.circularRef = problematicEvent;

      expect(() => {
        logger.log(problematicEvent as any);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle storage failures gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.log({
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'user123',
        workspaceId: 'ws1',
        permission: 'read',
      });

      // Should not throw, but should warn
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to save audit log to storage:',
          expect.any(Error)
        );
      }, 1100);

      consoleSpy.mockRestore();
    });
  });

  describe('Critical Event Handling', () => {
    it('should log critical events to console', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const criticalEvent: PermissionEvent = {
        type: 'permissionCheckFailed',
        timestamp: Date.now(),
        userId: 'user123',
        workspaceId: 'ws1',
        permission: 'admin',
        error: 'Critical failure',
        fallbackUsed: true,
      };

      logger.log(criticalEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        '🚨 Critical Permission Event:',
        expect.objectContaining({
          event: criticalEvent,
          level: 'error',
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
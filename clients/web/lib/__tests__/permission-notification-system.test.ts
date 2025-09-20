/**
 * Permission Notification System Tests
 * 
 * Comprehensive tests for the permission event notification system
 * including event emission, subscription, filtering, and audit logging.
 */

import {
  permissionNotificationSystem,
  permissionAuditLogger,
  emitPermissionEvent,
  subscribeToPermissionEvents,
  subscribeToAllPermissionEvents,
} from '../permission-notification-system';
import type {
  PermissionEvent,
  PermissionGrantedEvent,
  PermissionRevokedEvent,
} from '../../types/permission-events.types';

describe('Permission Notification System', () => {
  beforeEach(() => {
    // Clear all listeners and audit logs before each test
    permissionNotificationSystem.clear();
    permissionAuditLogger.cleanup(new Date(0));
    
    // Reset preferences to defaults
    permissionNotificationSystem.updatePreferences({
      enableToastNotifications: false, // Disable for testing
      enableConsoleLogging: false, // Disable for testing
      enableAuditLogging: true,
      criticalEventsOnly: false,
      workspaceFilters: [],
      mutedEventTypes: [],
    });
  });

  afterEach(() => {
    permissionNotificationSystem.clear();
    jest.clearAllMocks();
  });

  describe('Event Subscription and Emission', () => {
    it('should subscribe to and receive specific permission events', () => {
      const handler = jest.fn();
      const unsubscribe = subscribeToPermissionEvents('permissionGranted', handler);

      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
        grantedBy: 'admin-user',
      };

      emitPermissionEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup
      unsubscribe();
    });

    it('should subscribe to all permission events', () => {
      const handler = jest.fn();
      const unsubscribe = subscribeToAllPermissionEvents(handler);

      const grantEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      const revokeEvent: PermissionRevokedEvent = {
        type: 'permissionRevoked',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:delete',
      };

      emitPermissionEvent(grantEvent);
      emitPermissionEvent(revokeEvent);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(grantEvent);
      expect(handler).toHaveBeenCalledWith(revokeEvent);

      unsubscribe();
    });

    it('should handle multiple subscribers for the same event type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      const unsubscribe1 = subscribeToPermissionEvents('permissionGranted', handler1);
      const unsubscribe2 = subscribeToPermissionEvents('permissionGranted', handler2);

      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);

      unsubscribe1();
      unsubscribe2();
    });

    it('should respect priority ordering of event handlers', () => {
      const executionOrder: string[] = [];
      
      const lowHandler = jest.fn(() => executionOrder.push('low'));
      const normalHandler = jest.fn(() => executionOrder.push('normal'));
      const highHandler = jest.fn(() => executionOrder.push('high'));

      // Subscribe in reverse priority order to test sorting
      subscribeToPermissionEvents('permissionGranted', lowHandler, { priority: 'low' });
      subscribeToPermissionEvents('permissionGranted', normalHandler, { priority: 'normal' });
      subscribeToPermissionEvents('permissionGranted', highHandler, { priority: 'high' });

      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(event);

      expect(executionOrder).toEqual(['high', 'normal', 'low']);
    });

    it('should handle once option for event listeners', () => {
      const handler = jest.fn();
      subscribeToPermissionEvents('permissionGranted', handler, { once: true });

      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      // Emit event twice
      emitPermissionEvent(event);
      emitPermissionEvent(event);

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by workspace', () => {
      const handler = jest.fn();
      subscribeToPermissionEvents('permissionGranted', handler, {
        workspaceFilter: 'target-workspace',
      });

      const matchingEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'target-workspace',
        permission: 'canvas:create',
      };

      const nonMatchingEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'other-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(matchingEvent);
      emitPermissionEvent(nonMatchingEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(matchingEvent);
    });

    it('should filter events by user', () => {
      const handler = jest.fn();
      subscribeToPermissionEvents('permissionGranted', handler, {
        userFilter: 'target-user',
      });

      const matchingEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'target-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      const nonMatchingEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'other-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(matchingEvent);
      emitPermissionEvent(nonMatchingEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(matchingEvent);
    });

    it('should respect muted event types', () => {
      const handler = jest.fn();
      subscribeToAllPermissionEvents(handler);

      // Mute permission granted events
      permissionNotificationSystem.updatePreferences({
        mutedEventTypes: ['permissionGranted'],
      });

      const mutedEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      const allowedEvent: PermissionRevokedEvent = {
        type: 'permissionRevoked',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:delete',
      };

      emitPermissionEvent(mutedEvent);
      emitPermissionEvent(allowedEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(allowedEvent);
    });

    it('should filter to critical events only when enabled', () => {
      const handler = jest.fn();
      subscribeToAllPermissionEvents(handler);

      permissionNotificationSystem.updatePreferences({
        criticalEventsOnly: true,
      });

      const criticalEvent: PermissionRevokedEvent = {
        type: 'permissionRevoked',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:delete',
      };

      const nonCriticalEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(criticalEvent);
      emitPermissionEvent(nonCriticalEvent);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(criticalEvent);
    });
  });

  describe('Audit Logging', () => {
    it('should log all permission events to audit system', () => {
      // Clear any existing entries from previous tests
      permissionAuditLogger.clear();
      
      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(event);

      const auditEntries = permissionAuditLogger.getEntries();
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].event).toEqual(event);
      expect(auditEntries[0].level).toBe('info');
    });

    it('should determine appropriate log levels for different event types', () => {
      // Clear any existing entries from previous tests
      permissionAuditLogger.clear();
      
      const errorEvent: PermissionEvent = {
        type: 'permissionCheckFailed',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
        error: 'Network error',
        fallbackUsed: true,
      };

      const warnEvent: PermissionRevokedEvent = {
        type: 'permissionRevoked',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:delete',
      };

      emitPermissionEvent(errorEvent);
      emitPermissionEvent(warnEvent);

      const auditEntries = permissionAuditLogger.getEntries();
      expect(auditEntries).toHaveLength(2);
      
      const errorEntry = auditEntries.find(e => e.event.type === 'permissionCheckFailed');
      const warnEntry = auditEntries.find(e => e.event.type === 'permissionRevoked');
      
      expect(errorEntry?.level).toBe('error');
      expect(warnEntry?.level).toBe('warn');
    });

    it('should filter audit entries by criteria', () => {
      // Clear any existing entries from previous tests
      permissionAuditLogger.clear();
      
      const events: PermissionEvent[] = [
        {
          type: 'permissionGranted',
          timestamp: Date.now(),
          userId: 'user1',
          workspaceId: 'workspace1',
          permission: 'canvas:create',
        },
        {
          type: 'permissionRevoked',
          timestamp: Date.now(),
          userId: 'user2',
          workspaceId: 'workspace2',
          permission: 'canvas:delete',
        },
        {
          type: 'permissionCheckFailed',
          timestamp: Date.now(),
          userId: 'user1',
          workspaceId: 'workspace1',
          permission: 'canvas:create',
          error: 'Test error',
          fallbackUsed: true,
        },
      ];

      events.forEach(emitPermissionEvent);

      // Filter by user
      const user1Entries = permissionAuditLogger.getEntries({ userId: 'user1' });
      expect(user1Entries).toHaveLength(2);

      // Filter by workspace
      const workspace1Entries = permissionAuditLogger.getEntries({ workspaceId: 'workspace1' });
      expect(workspace1Entries).toHaveLength(2);

      // Filter by event type
      const grantedEntries = permissionAuditLogger.getEntries({ eventType: 'permissionGranted' });
      expect(grantedEntries).toHaveLength(1);

      // Filter by level
      const errorEntries = permissionAuditLogger.getEntries({ level: 'error' });
      expect(errorEntries).toHaveLength(1);
    });

    it('should cleanup old audit entries', () => {
      // Clear any existing entries from previous tests
      permissionAuditLogger.clear();
      
      // Create some test entries
      const oldEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now() - 1000000, // Very old
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      const recentEvent: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(oldEvent);
      emitPermissionEvent(recentEvent);

      expect(permissionAuditLogger.getEntries()).toHaveLength(2);

      // Cleanup entries older than 1 minute ago
      const cutoffDate = new Date(Date.now() - 60000);
      const cleanedCount = permissionAuditLogger.cleanup(cutoffDate);

      expect(cleanedCount).toBe(1);
      expect(permissionAuditLogger.getEntries()).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event listeners gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const faultyHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      
      const goodHandler = jest.fn();

      subscribeToPermissionEvents('permissionGranted', faultyHandler);
      subscribeToPermissionEvents('permissionGranted', goodHandler);

      const event: PermissionGrantedEvent = {
        type: 'permissionGranted',
        timestamp: Date.now(),
        userId: 'test-user',
        workspaceId: 'test-workspace',
        permission: 'canvas:create',
      };

      emitPermissionEvent(event);

      // Both handlers should be called, error should be handled gracefully
      expect(faultyHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
      // Error should be handled silently to not interrupt other listeners

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors in event processing gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create an invalid event (missing required fields)
      const invalidEvent = {
        type: 'permissionGranted',
        // Missing required fields
      } as any;

      // Should not throw
      expect(() => emitPermissionEvent(invalidEvent)).not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Preference Management', () => {
    it('should get and update notification preferences', () => {
      const initialPrefs = permissionNotificationSystem.getPreferences();
      expect(initialPrefs.enableAuditLogging).toBe(true);

      permissionNotificationSystem.updatePreferences({
        enableAuditLogging: false,
        criticalEventsOnly: true,
      });

      const updatedPrefs = permissionNotificationSystem.getPreferences();
      expect(updatedPrefs.enableAuditLogging).toBe(false);
      expect(updatedPrefs.criticalEventsOnly).toBe(true);
      
      // Other preferences should remain unchanged
      expect(updatedPrefs.enableToastNotifications).toBe(initialPrefs.enableToastNotifications);
    });
  });
});
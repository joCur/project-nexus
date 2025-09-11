/**
 * Permission Notification System
 * 
 * Provides real-time notifications for permission changes, cache updates,
 * and security events. Integrates with the existing event system.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import {
  PermissionEvent,
  PermissionEventType,
  PermissionEventHandler,
  PermissionEventListenerOptions,
  PermissionNotificationSystem,
  PermissionNotificationPreferences,
  PermissionAuditLogger,
  PermissionAuditLogEntry,
} from '@/types/permission-events.types';
import { enhancedPermissionAuditLogger } from './permission-audit-logger';
import { permissionLogger } from './structured-logger';

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES: PermissionNotificationPreferences = {
  enableToastNotifications: true,
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enableAuditLogging: true,
  criticalEventsOnly: false,
  workspaceFilters: [],
  mutedEventTypes: [],
};

/**
 * Event listener registration
 */
interface EventListenerRegistration {
  handler: PermissionEventHandler;
  options: PermissionEventListenerOptions;
  id: string;
}

/**
 * Permission notification system implementation
 */
export class PermissionNotificationSystemImpl implements PermissionNotificationSystem {
  private static instance: PermissionNotificationSystemImpl;
  
  private listeners = new Map<PermissionEventType, EventListenerRegistration[]>();
  private globalListeners: EventListenerRegistration[] = [];
  private preferences: PermissionNotificationPreferences = { ...DEFAULT_PREFERENCES };
  private listenerIdCounter = 0;

  /**
   * Singleton instance getter
   */
  static getInstance(): PermissionNotificationSystemImpl {
    if (!PermissionNotificationSystemImpl.instance) {
      PermissionNotificationSystemImpl.instance = new PermissionNotificationSystemImpl();
    }
    return PermissionNotificationSystemImpl.instance;
  }

  /**
   * Subscribe to specific permission event type
   */
  subscribe<T extends PermissionEvent>(
    eventType: T['type'],
    handler: PermissionEventHandler<T>,
    options: PermissionEventListenerOptions = {}
  ): () => void {
    const id = `listener_${++this.listenerIdCounter}`;
    const registration: EventListenerRegistration = {
      handler: handler as PermissionEventHandler,
      options,
      id,
    };

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const eventListeners = this.listeners.get(eventType)!;
    
    // Insert based on priority
    const priority = options.priority || 'normal';
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    
    let insertIndex = eventListeners.length;
    for (let i = 0; i < eventListeners.length; i++) {
      const existingPriority = eventListeners[i].options.priority || 'normal';
      if (priorityOrder[priority] < priorityOrder[existingPriority]) {
        insertIndex = i;
        break;
      }
    }
    
    eventListeners.splice(insertIndex, 0, registration);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        const index = listeners.findIndex(l => l.id === id);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Subscribe to all permission events
   */
  subscribeAll(
    handler: PermissionEventHandler,
    options: PermissionEventListenerOptions = {}
  ): () => void {
    const id = `global_listener_${++this.listenerIdCounter}`;
    const registration: EventListenerRegistration = {
      handler,
      options,
      id,
    };

    this.globalListeners.push(registration);

    // Return unsubscribe function
    return () => {
      const index = this.globalListeners.findIndex(l => l.id === id);
      if (index >= 0) {
        this.globalListeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit a permission event
   */
  emit(event: PermissionEvent): void {
    try {
      // Check if event should be processed based on preferences
      if (!this.shouldProcessEvent(event)) {
        return;
      }

      // Log to console if enabled
      if (this.preferences.enableConsoleLogging) {
        this.logToConsole(event);
      }

      // Log to structured logger
      this.logToStructuredLogger(event);

      // Log to audit system if enabled
      if (this.preferences.enableAuditLogging) {
        enhancedPermissionAuditLogger.log(event);
      }

      // Notify specific event listeners
      const eventListeners = this.listeners.get(event.type) || [];
      this.notifyListeners(eventListeners, event);

      // Notify global listeners
      this.notifyListeners(this.globalListeners, event);

      // Show toast notification if enabled
      if (this.preferences.enableToastNotifications) {
        this.showToastNotification(event);
      }

    } catch (error) {
      console.error('Error processing permission event:', error);
    }
  }

  /**
   * Remove specific event listener
   */
  unsubscribe(eventType: PermissionEventType, handler: PermissionEventHandler): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.findIndex(l => l.handler === handler);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Clear all event listeners
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners = [];
  }

  /**
   * Get current notification preferences
   */
  getPreferences(): PermissionNotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Update notification preferences
   */
  updatePreferences(preferences: Partial<PermissionNotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  /**
   * Check if event should be processed based on preferences
   */
  private shouldProcessEvent(event: PermissionEvent): boolean {
    // Check if event type is muted
    if (this.preferences.mutedEventTypes.includes(event.type)) {
      return false;
    }

    // Check if critical events only
    if (this.preferences.criticalEventsOnly) {
      const criticalEvents: PermissionEventType[] = [
        'permissionRevoked',
        'workspaceAccessRevoked',
        'permissionCheckFailed',
        'permissionQueryError',
      ];
      if (!criticalEvents.includes(event.type)) {
        return false;
      }
    }

    // Check workspace filters
    if (this.preferences.workspaceFilters.length > 0 && event.workspaceId) {
      if (!this.preferences.workspaceFilters.includes(event.workspaceId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Notify event listeners
   */
  private notifyListeners(listeners: EventListenerRegistration[], event: PermissionEvent): void {
    for (const registration of listeners) {
      try {
        // Check listener filters
        if (!this.matchesListenerFilters(registration.options, event)) {
          continue;
        }

        // Call handler
        registration.handler(event);

        // Remove if once option is set
        if (registration.options.once) {
          this.removeListener(registration);
        }
      } catch (error) {
        console.error('Error in permission event listener:', error);
      }
    }
  }

  /**
   * Check if event matches listener filters
   */
  private matchesListenerFilters(options: PermissionEventListenerOptions, event: PermissionEvent): boolean {
    if (options.workspaceFilter && event.workspaceId !== options.workspaceFilter) {
      return false;
    }

    if (options.userFilter && event.userId !== options.userFilter) {
      return false;
    }

    return true;
  }

  /**
   * Remove listener registration
   */
  private removeListener(registration: EventListenerRegistration): void {
    // Remove from specific event listeners
    for (const [eventType, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex(l => l.id === registration.id);
      if (index >= 0) {
        listeners.splice(index, 1);
        return;
      }
    }

    // Remove from global listeners
    const globalIndex = this.globalListeners.findIndex(l => l.id === registration.id);
    if (globalIndex >= 0) {
      this.globalListeners.splice(globalIndex, 1);
    }
  }

  /**
   * Log event to console with appropriate styling
   */
  private logToConsole(event: PermissionEvent): void {
    const timestamp = new Date(event.timestamp).toISOString();
    const prefix = `🔐 [${timestamp}] Permission Event:`;
    
    switch (event.type) {
      case 'permissionGranted':
        console.log(`${prefix} ✅ Permission granted`, event);
        break;
      case 'permissionRevoked':
        console.warn(`${prefix} ❌ Permission revoked`, event);
        break;
      case 'roleChanged':
        console.log(`${prefix} 👤 Role changed`, event);
        break;
      case 'workspaceAccessGranted':
        console.log(`${prefix} 🏢 Workspace access granted`, event);
        break;
      case 'workspaceAccessRevoked':
        console.warn(`${prefix} 🚫 Workspace access revoked`, event);
        break;
      case 'permissionCheckFailed':
        console.error(`${prefix} ⚠️ Permission check failed`, event);
        break;
      case 'permissionQueryError':
        console.error(`${prefix} 🔴 Permission query error`, event);
        break;
      case 'permissionCacheInvalidated':
        console.log(`${prefix} 🗑️ Cache invalidated`, event);
        break;
      case 'permissionCacheWarmed':
        console.log(`${prefix} 🔥 Cache warmed`, event);
        break;
      default:
        console.log(`${prefix} ${event.type}`, event);
    }
  }

  /**
   * Show toast notification for important events
   */
  private showToastNotification(event: PermissionEvent): void {
    // Only show notifications for user-facing events
    const notificationEvents: PermissionEventType[] = [
      'permissionGranted',
      'permissionRevoked',
      'roleChanged',
      'workspaceAccessGranted',
      'workspaceAccessRevoked',
      'permissionCheckFailed',
    ];

    if (!notificationEvents.includes(event.type)) {
      return;
    }

    // Note: This would integrate with your toast notification system
    // For now, we'll use a simple console log as placeholder
    const message = this.getNotificationMessage(event);
    if (message) {
      console.log(`🔔 Permission Notification: ${message}`);
      // TODO: Integrate with actual toast notification system
      // toast.show({ message, type: this.getNotificationType(event) });
    }
  }

  /**
   * Log event to structured logger
   */
  private logToStructuredLogger(event: PermissionEvent): void {
    const context = {
      userId: event.userId,
      workspaceId: event.workspaceId,
      eventType: event.type,
      timestamp: event.timestamp,
      metadata: event.metadata,
    };

    const tags = ['permission-event', event.type];

    switch (event.type) {
      case 'permissionCheckFailed':
      case 'permissionQueryError':
        permissionLogger.error(
          `Permission system error: ${event.type}`,
          new Error((event as any).error || 'Unknown error'),
          context,
          tags
        );
        break;
      case 'permissionRevoked':
      case 'workspaceAccessRevoked':
        permissionLogger.warn(
          `Permission revoked: ${event.type}`,
          context,
          tags
        );
        break;
      case 'permissionCacheInvalidated':
        permissionLogger.debug(
          `Cache invalidated: ${(event as any).reason}`,
          context,
          [...tags, 'cache']
        );
        break;
      case 'permissionCacheWarmed':
        permissionLogger.info(
          `Cache warmed for ${(event as any).workspaceIds?.length || 0} workspaces`,
          {
            ...context,
            performance: {
              duration: (event as any).duration,
            },
          },
          [...tags, 'cache', 'performance']
        );
        break;
      default:
        permissionLogger.info(
          `Permission event: ${event.type}`,
          context,
          tags
        );
    }
  }

  /**
   * Get user-friendly notification message
   */
  private getNotificationMessage(event: PermissionEvent): string | null {
    switch (event.type) {
      case 'permissionGranted':
        return `You now have ${(event as any).permission} permission in this workspace`;
      case 'permissionRevoked':
        return `Your ${(event as any).permission} permission has been revoked`;
      case 'roleChanged':
        return `Your role has been updated to ${(event as any).newRole}`;
      case 'workspaceAccessGranted':
        return 'You have been granted access to this workspace';
      case 'workspaceAccessRevoked':
        return 'Your access to this workspace has been revoked';
      case 'permissionCheckFailed':
        return 'Unable to verify permissions. Please refresh the page.';
      default:
        return null;
    }
  }
}

/**
 * Permission audit logger implementation
 */
class PermissionAuditLoggerImpl implements PermissionAuditLogger {
  private static instance: PermissionAuditLoggerImpl;
  private entries: PermissionAuditLogEntry[] = [];
  private maxEntries = 1000; // Limit memory usage

  /**
   * Singleton instance getter
   */
  static getInstance(): PermissionAuditLoggerImpl {
    if (!PermissionAuditLoggerImpl.instance) {
      PermissionAuditLoggerImpl.instance = new PermissionAuditLoggerImpl();
    }
    return PermissionAuditLoggerImpl.instance;
  }

  /**
   * Log a permission event
   */
  log(event: PermissionEvent, level: PermissionAuditLogEntry['level'] = 'info'): void {
    try {
      const entry: PermissionAuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        event,
        level: this.determineLogLevel(event, level),
        source: 'frontend',
        context: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          sessionId: this.getSessionId(),
        },
      };

      this.entries.push(entry);

      // Maintain memory limits
      if (this.entries.length > this.maxEntries) {
        this.entries.splice(0, this.entries.length - this.maxEntries);
      }

      // In production, this would send to backend audit service
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Audit Log:', entry);
      }
    } catch (error) {
      console.error('Failed to log permission audit entry:', error);
    }
  }

  /**
   * Get audit log entries with optional filtering
   */
  getEntries(filter?: {
    userId?: string;
    workspaceId?: string;
    eventType?: PermissionEventType;
    timeRange?: { from: Date; to: Date };
    level?: PermissionAuditLogEntry['level'];
  }): PermissionAuditLogEntry[] {
    let filtered = [...this.entries];

    if (filter) {
      filtered = filtered.filter(entry => {
        if (filter.userId && entry.event.userId !== filter.userId) return false;
        if (filter.workspaceId && entry.event.workspaceId !== filter.workspaceId) return false;
        if (filter.eventType && entry.event.type !== filter.eventType) return false;
        if (filter.level && entry.level !== filter.level) return false;
        if (filter.timeRange) {
          const entryTime = entry.timestamp.getTime();
          if (entryTime < filter.timeRange.from.getTime() || entryTime > filter.timeRange.to.getTime()) {
            return false;
          }
        }
        return true;
      });
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clean up old audit log entries
   */
  cleanup(olderThan: Date): number {
    const beforeCount = this.entries.length;
    this.entries = this.entries.filter(entry => entry.timestamp >= olderThan);
    return beforeCount - this.entries.length;
  }

  /**
   * Determine appropriate log level for event
   */
  private determineLogLevel(event: PermissionEvent, providedLevel: PermissionAuditLogEntry['level']): PermissionAuditLogEntry['level'] {
    // If level is explicitly provided, use it
    if (providedLevel !== 'info') {
      return providedLevel;
    }

    // Auto-determine level based on event type
    switch (event.type) {
      case 'permissionCheckFailed':
      case 'permissionQueryError':
        return 'error';
      case 'permissionRevoked':
      case 'workspaceAccessRevoked':
        return 'warn';
      case 'roleChanged':
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Get current session ID
   */
  private getSessionId(): string {
    // In a real app, this would be managed by auth system
    return 'session_' + Math.random().toString(36).substr(2, 9);
  }
}

// Export singleton instances
export const permissionNotificationSystem = PermissionNotificationSystemImpl.getInstance();
export const permissionAuditLogger = enhancedPermissionAuditLogger;

/**
 * Convenience function to emit permission events
 */
export function emitPermissionEvent(event: PermissionEvent): void {
  permissionNotificationSystem.emit(event);
}

/**
 * Convenience function to subscribe to permission events
 */
export function subscribeToPermissionEvents<T extends PermissionEvent>(
  eventType: T['type'],
  handler: PermissionEventHandler<T>,
  options?: PermissionEventListenerOptions
): () => void {
  return permissionNotificationSystem.subscribe(eventType, handler, options);
}

/**
 * Convenience function to subscribe to all permission events
 */
export function subscribeToAllPermissionEvents(
  handler: PermissionEventHandler,
  options?: PermissionEventListenerOptions
): () => void {
  return permissionNotificationSystem.subscribeAll(handler, options);
}
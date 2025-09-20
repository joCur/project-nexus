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
 * Debounce configuration for permission events
 */
const DEBOUNCE_CONFIG = {
  // Events that should be debounced
  debouncedEventTypes: [
    'permissionGranted',
    'permissionRevoked',
    'roleChanged',
    'permissionCacheInvalidated',
  ] as PermissionEventType[],
  // Debounce delay in milliseconds
  debounceDelay: 500,
  // Maximum number of grouped events in a single emission
  maxGroupedEvents: 10,
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

  // Debouncing state
  private debouncedEvents = new Map<string, PermissionEvent[]>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

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
   * Emit a permission event with optional debouncing
   */
  emit(event: PermissionEvent): void {
    try {
      // Check if event should be processed based on preferences
      if (!this.shouldProcessEvent(event)) {
        return;
      }

      // Check if event should be debounced
      if (this.shouldDebounceEvent(event)) {
        this.handleDebouncedEvent(event);
        return;
      }

      // Process event immediately if not debounced
      this.processEvent(event);

    } catch (error) {
      console.error('Error processing permission event:', error);
    }
  }

  /**
   * Check if an event should be debounced
   */
  private shouldDebounceEvent(event: PermissionEvent): boolean {
    return DEBOUNCE_CONFIG.debouncedEventTypes.includes(event.type);
  }

  /**
   * Handle debounced event
   */
  private handleDebouncedEvent(event: PermissionEvent): void {
    const key = this.getDebounceKey(event);

    // Add event to debounced collection
    if (!this.debouncedEvents.has(key)) {
      this.debouncedEvents.set(key, []);
    }
    const events = this.debouncedEvents.get(key)!;

    // Limit the number of grouped events
    if (events.length < DEBOUNCE_CONFIG.maxGroupedEvents) {
      events.push(event);
    }

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      const eventsToProcess = this.debouncedEvents.get(key) || [];
      this.debouncedEvents.delete(key);
      this.debounceTimers.delete(key);

      // Process all debounced events
      if (eventsToProcess.length === 1) {
        // Single event, process normally
        this.processEvent(eventsToProcess[0]);
      } else if (eventsToProcess.length > 1) {
        // Multiple events, process as batch
        this.processBatchedEvents(eventsToProcess);
      }
    }, DEBOUNCE_CONFIG.debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Get debounce key for an event
   */
  private getDebounceKey(event: PermissionEvent): string {
    // Create a unique key based on event type and context
    const parts = [event.type];

    if (event.userId) {
      parts.push(event.userId);
    }

    if (event.workspaceId) {
      parts.push(event.workspaceId);
    }

    // For specific permission events, include the permission name
    if ('permission' in event && typeof (event as any).permission === 'string') {
      parts.push((event as any).permission);
    }

    return parts.join(':');
  }

  /**
   * Process a single event
   */
  private processEvent(event: PermissionEvent): void {
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
  }

  /**
   * Process multiple batched events
   */
  private processBatchedEvents(events: PermissionEvent[]): void {
    if (events.length === 0) return;

    // Create a summary event for batched events
    const firstEvent = events[0];
    const summaryEvent: PermissionEvent = {
      ...firstEvent,
      type: firstEvent.type,
      timestamp: Date.now(),
      metadata: {
        ...firstEvent.metadata,
        batched: true,
        batchSize: events.length,
        eventTypes: events.map(e => e.type),
      },
    };

    // Log batch summary
    if (this.preferences.enableConsoleLogging) {
      console.log(`🔐 [Batched] ${events.length} ${firstEvent.type} events:`, events);
    }

    // Log to structured logger
    this.logToStructuredLogger(summaryEvent);

    // Log each event to audit system
    if (this.preferences.enableAuditLogging) {
      events.forEach(event => {
        enhancedPermissionAuditLogger.log(event);
      });
    }

    // Notify listeners with summary event
    const eventListeners = this.listeners.get(firstEvent.type) || [];
    this.notifyListeners(eventListeners, summaryEvent);
    this.notifyListeners(this.globalListeners, summaryEvent);

    // Show single toast for batched events
    if (this.preferences.enableToastNotifications) {
      this.showBatchedToastNotification(events);
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

    // Clear any pending debounced events
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.debouncedEvents.clear();
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
      const criticalEvents = [
        'permissionRevoked',
        'workspaceAccessRevoked',
        'permissionCheckFailed',
        'permissionQueryError',
      ] as const;
      if (!criticalEvents.includes(event.type as any)) {
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
    for (const listeners of this.listeners.values()) {
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
   * Show toast notification for batched events
   */
  private showBatchedToastNotification(events: PermissionEvent[]): void {
    if (events.length === 0) return;

    const firstEvent = events[0];
    let message = '';

    switch (firstEvent.type) {
      case 'permissionGranted':
        message = `${events.length} permissions have been granted`;
        break;
      case 'permissionRevoked':
        message = `${events.length} permissions have been revoked`;
        break;
      case 'roleChanged':
        message = `Multiple role changes have been applied`;
        break;
      case 'permissionCacheInvalidated':
        message = `Permission cache has been refreshed`;
        break;
      default:
        message = `${events.length} permission changes occurred`;
    }

    console.log(`🔔 Permission Notification (Batched): ${message}`);
    // TODO: Integrate with actual toast notification system
    // toast.show({ message, type: 'info' });
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
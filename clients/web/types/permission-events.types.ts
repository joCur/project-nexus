/**
 * Permission System Event Types
 * 
 * Defines event types for permission changes, cache updates, and 
 * security-related notifications in the permission system.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import type { EntityId } from './common.types';

// ============================================================================
// PERMISSION EVENT TYPES
// ============================================================================

/**
 * Permission change event types
 */
export type PermissionEventType =
  | 'permissionGranted'
  | 'permissionRevoked'
  | 'permissionUpdated'
  | 'roleChanged'
  | 'workspaceAccessGranted'
  | 'workspaceAccessRevoked'
  | 'permissionCacheInvalidated'
  | 'permissionCacheWarmed'
  | 'permissionCheckFailed'
  | 'permissionQueryError';

/**
 * Base permission event interface
 */
export interface BasePermissionEvent {
  type: PermissionEventType;
  timestamp: number;
  userId: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Permission granted event
 */
export interface PermissionGrantedEvent extends BasePermissionEvent {
  type: 'permissionGranted';
  permission: string;
  workspaceId: string;
  grantedBy?: string;
  expiresAt?: Date;
}

/**
 * Permission revoked event
 */
export interface PermissionRevokedEvent extends BasePermissionEvent {
  type: 'permissionRevoked';
  permission: string;
  workspaceId: string;
  revokedBy?: string;
  reason?: string;
}

/**
 * Permission updated event
 */
export interface PermissionUpdatedEvent extends BasePermissionEvent {
  type: 'permissionUpdated';
  permission: string;
  workspaceId: string;
  previousValue: boolean;
  newValue: boolean;
  updatedBy?: string;
}

/**
 * Role changed event
 */
export interface RoleChangedEvent extends BasePermissionEvent {
  type: 'roleChanged';
  workspaceId: string;
  previousRole?: string;
  newRole: string;
  changedBy?: string;
}

/**
 * Workspace access granted event
 */
export interface WorkspaceAccessGrantedEvent extends BasePermissionEvent {
  type: 'workspaceAccessGranted';
  workspaceId: string;
  grantedBy?: string;
  initialPermissions: string[];
}

/**
 * Workspace access revoked event
 */
export interface WorkspaceAccessRevokedEvent extends BasePermissionEvent {
  type: 'workspaceAccessRevoked';
  workspaceId: string;
  revokedBy?: string;
  reason?: string;
}

/**
 * Permission cache invalidated event
 */
export interface PermissionCacheInvalidatedEvent extends BasePermissionEvent {
  type: 'permissionCacheInvalidated';
  workspaceId?: string;
  cacheKeys: string[];
  reason: 'manual' | 'ttl-expired' | 'role-change' | 'permission-change' | 'compression';
}

/**
 * Permission cache warmed event
 */
export interface PermissionCacheWarmedEvent extends BasePermissionEvent {
  type: 'permissionCacheWarmed';
  workspaceIds: string[];
  cacheEntries: number;
  duration: number;
}

/**
 * Permission check failed event
 */
export interface PermissionCheckFailedEvent extends BasePermissionEvent {
  type: 'permissionCheckFailed';
  permission: string;
  workspaceId: string;
  error: string;
  fallbackUsed: boolean;
}

/**
 * Permission query error event
 */
export interface PermissionQueryErrorEvent extends BasePermissionEvent {
  type: 'permissionQueryError';
  queryType: 'workspace' | 'context' | 'single';
  workspaceId?: string;
  error: string;
  retryCount: number;
}

/**
 * Union type for all permission events
 */
export type PermissionEvent =
  | PermissionGrantedEvent
  | PermissionRevokedEvent
  | PermissionUpdatedEvent
  | RoleChangedEvent
  | WorkspaceAccessGrantedEvent
  | WorkspaceAccessRevokedEvent
  | PermissionCacheInvalidatedEvent
  | PermissionCacheWarmedEvent
  | PermissionCheckFailedEvent
  | PermissionQueryErrorEvent;

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Permission event handler function type
 */
export type PermissionEventHandler<T extends PermissionEvent = PermissionEvent> = (event: T) => void;

/**
 * Permission event listener options
 */
export interface PermissionEventListenerOptions {
  once?: boolean;
  priority?: 'low' | 'normal' | 'high';
  workspaceFilter?: string;
  userFilter?: string;
}

/**
 * Permission notification preferences
 */
export interface PermissionNotificationPreferences {
  enableToastNotifications: boolean;
  enableConsoleLogging: boolean;
  enableAuditLogging: boolean;
  criticalEventsOnly: boolean;
  workspaceFilters: string[];
  mutedEventTypes: PermissionEventType[];
}

// ============================================================================
// NOTIFICATION SYSTEM INTERFACE
// ============================================================================

/**
 * Permission notification system interface
 */
export interface PermissionNotificationSystem {
  /**
   * Subscribe to permission events
   */
  subscribe<T extends PermissionEvent>(
    eventType: T['type'],
    handler: PermissionEventHandler<T>,
    options?: PermissionEventListenerOptions
  ): () => void;

  /**
   * Subscribe to all permission events
   */
  subscribeAll(
    handler: PermissionEventHandler,
    options?: PermissionEventListenerOptions
  ): () => void;

  /**
   * Emit a permission event
   */
  emit(event: PermissionEvent): void;

  /**
   * Remove event listener
   */
  unsubscribe(eventType: PermissionEventType, handler: PermissionEventHandler): void;

  /**
   * Clear all event listeners
   */
  clear(): void;

  /**
   * Get current notification preferences
   */
  getPreferences(): PermissionNotificationPreferences;

  /**
   * Update notification preferences
   */
  updatePreferences(preferences: Partial<PermissionNotificationPreferences>): void;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

/**
 * Permission audit log entry
 */
export interface PermissionAuditLogEntry {
  id: string;
  timestamp: Date;
  event: PermissionEvent;
  level: 'info' | 'warn' | 'error' | 'critical';
  source: 'frontend' | 'backend' | 'cache' | 'auth';
  context: {
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    requestId?: string;
  };
}

/**
 * Audit logger interface
 */
export interface PermissionAuditLogger {
  /**
   * Log a permission event
   */
  log(event: PermissionEvent, level?: PermissionAuditLogEntry['level']): void;

  /**
   * Get audit log entries
   */
  getEntries(filter?: {
    userId?: string;
    workspaceId?: string;
    eventType?: PermissionEventType;
    timeRange?: { from: Date; to: Date };
    level?: PermissionAuditLogEntry['level'];
  }): PermissionAuditLogEntry[];

  /**
   * Clear audit log entries older than specified date
   */
  cleanup(olderThan: Date): number;
}
/**
 * Enhanced Permission Audit Logger
 * 
 * Provides comprehensive audit logging for permission-related activities
 * with structured logging, filtering capabilities, and export functionality.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import {
  PermissionEvent,
  PermissionEventType,
  PermissionAuditLogEntry,
  PermissionAuditLogger,
} from '@/types/permission-events.types';

/**
 * Audit log configuration
 */
const AUDIT_CONFIG = {
  // Maximum number of audit entries to keep in memory
  MAX_ENTRIES: 5000,
  
  // Auto-cleanup entries older than 7 days
  AUTO_CLEANUP_DAYS: 7,
  
  // Enable persistent storage (localStorage)
  ENABLE_PERSISTENT_STORAGE: true,
  
  // Storage key for localStorage
  STORAGE_KEY: 'permission_audit_log',
  
  // Batch size for localStorage operations
  STORAGE_BATCH_SIZE: 100,
  
  // Critical events that should always be logged
  CRITICAL_EVENTS: [
    'permissionRevoked',
    'workspaceAccessRevoked',
    'permissionCheckFailed',
    'permissionQueryError',
  ] as PermissionEventType[],
  
  // Events that include sensitive data requiring careful handling
  SENSITIVE_EVENTS: [
    'permissionGranted',
    'permissionRevoked',
    'roleChanged',
  ] as PermissionEventType[],
  
  // Enable in production
  ENABLED: true,
};

/**
 * Audit log filter options
 */
export interface AuditLogFilter {
  userId?: string;
  workspaceId?: string;
  eventType?: PermissionEventType;
  eventTypes?: PermissionEventType[];
  level?: PermissionAuditLogEntry['level'];
  levels?: PermissionAuditLogEntry['level'][];
  timeRange?: {
    from: Date;
    to: Date;
  };
  source?: PermissionAuditLogEntry['source'];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'level' | 'eventType';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Audit log export format
 */
export interface AuditLogExport {
  metadata: {
    exportTimestamp: Date;
    totalEntries: number;
    filterApplied: boolean;
    filter?: AuditLogFilter;
    version: string;
  };
  entries: PermissionAuditLogEntry[];
}

/**
 * Audit log statistics
 */
export interface AuditLogStatistics {
  totalEntries: number;
  entriesByLevel: Record<PermissionAuditLogEntry['level'], number>;
  entriesByEventType: Record<string, number>;
  entriesBySource: Record<PermissionAuditLogEntry['source'], number>;
  entriesByUser: Record<string, number>;
  entriesByWorkspace: Record<string, number>;
  timeRange: {
    earliest: Date | null;
    latest: Date | null;
  };
  memoryUsage: {
    entriesInMemory: number;
    estimatedSizeKB: number;
  };
  storage: {
    persistentStorageEnabled: boolean;
    entriesInStorage: number;
  };
}

/**
 * Enhanced permission audit logger implementation
 */
export class EnhancedPermissionAuditLogger implements PermissionAuditLogger {
  private static instance: EnhancedPermissionAuditLogger;
  private entries: PermissionAuditLogEntry[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Singleton instance getter
   */
  static getInstance(): EnhancedPermissionAuditLogger {
    if (!EnhancedPermissionAuditLogger.instance) {
      EnhancedPermissionAuditLogger.instance = new EnhancedPermissionAuditLogger();
      EnhancedPermissionAuditLogger.instance.initialize();
    }
    return EnhancedPermissionAuditLogger.instance;
  }

  /**
   * Initialize the audit logger
   */
  private initialize(): void {
    if (!AUDIT_CONFIG.ENABLED) {
      return;
    }

    // Load existing entries from storage
    this.loadFromStorage();

    // Set up auto-cleanup
    this.cleanupInterval = setInterval(() => {
      this.performAutoCleanup();
    }, 60 * 60 * 1000); // Run cleanup every hour

    console.log('Enhanced Permission Audit Logger initialized', {
      entriesLoaded: this.entries.length,
      persistentStorage: AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE,
    });
  }

  /**
   * Shutdown the audit logger
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Save entries to storage before shutdown
    this.saveToStorage();
  }

  /**
   * Log a permission event
   */
  log(event: PermissionEvent, level?: PermissionAuditLogEntry['level']): void {
    try {
      const entry: PermissionAuditLogEntry = {
        id: this.generateEntryId(),
        timestamp: new Date(event.timestamp),
        event,
        level: this.determineLogLevel(event, level),
        source: 'frontend',
        context: this.buildAuditContext(),
      };

      // Add entry to memory
      this.entries.push(entry);

      // Maintain memory limits
      this.enforceMemoryLimits();

      // Save to persistent storage if enabled
      if (AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE) {
        this.saveToStorageAsync();
      }

      // Log critical events to console
      if (this.isCriticalEvent(event.type)) {
        this.logCriticalEvent(entry);
      }

    } catch (error) {
      console.error('Failed to log permission audit entry:', error);
    }
  }

  /**
   * Get audit log entries with filtering
   */
  getEntries(filter?: AuditLogFilter): PermissionAuditLogEntry[] {
    let filtered = [...this.entries];

    if (filter) {
      filtered = this.applyFilter(filtered, filter);
    }

    // Sort results
    const sortBy = filter?.sortBy || 'timestamp';
    const sortOrder = filter?.sortOrder || 'desc';
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'level':
          const levelOrder = { info: 1, warn: 2, error: 3, critical: 4 };
          comparison = levelOrder[a.level] - levelOrder[b.level];
          break;
        case 'eventType':
          comparison = a.event.type.localeCompare(b.event.type);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    if (filter?.offset || filter?.limit) {
      const offset = filter.offset || 0;
      const limit = filter.limit || filtered.length;
      filtered = filtered.slice(offset, offset + limit);
    }

    return filtered;
  }

  /**
   * Clean up old audit log entries
   */
  cleanup(olderThan: Date): number {
    const beforeCount = this.entries.length;
    this.entries = this.entries.filter(entry => entry.timestamp >= olderThan);
    const cleanedCount = beforeCount - this.entries.length;

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old audit log entries`);
      
      // Update storage
      if (AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE) {
        this.saveToStorage();
      }
    }

    return cleanedCount;
  }

  /**
   * Get audit log statistics
   */
  getStatistics(): AuditLogStatistics {
    const stats: AuditLogStatistics = {
      totalEntries: this.entries.length,
      entriesByLevel: { info: 0, warn: 0, error: 0, critical: 0 },
      entriesByEventType: {},
      entriesBySource: { frontend: 0, backend: 0, cache: 0, auth: 0 },
      entriesByUser: {},
      entriesByWorkspace: {},
      timeRange: {
        earliest: null,
        latest: null,
      },
      memoryUsage: {
        entriesInMemory: this.entries.length,
        estimatedSizeKB: this.estimateMemoryUsage(),
      },
      storage: {
        persistentStorageEnabled: AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE,
        entriesInStorage: this.getStorageEntryCount(),
      },
    };

    // Calculate statistics
    this.entries.forEach(entry => {
      // Level statistics
      stats.entriesByLevel[entry.level]++;

      // Event type statistics
      const eventType = entry.event.type;
      stats.entriesByEventType[eventType] = (stats.entriesByEventType[eventType] || 0) + 1;

      // Source statistics
      stats.entriesBySource[entry.source]++;

      // User statistics
      const userId = entry.event.userId;
      stats.entriesByUser[userId] = (stats.entriesByUser[userId] || 0) + 1;

      // Workspace statistics
      if (entry.event.workspaceId) {
        const workspaceId = entry.event.workspaceId;
        stats.entriesByWorkspace[workspaceId] = (stats.entriesByWorkspace[workspaceId] || 0) + 1;
      }

      // Time range
      if (!stats.timeRange.earliest || entry.timestamp < stats.timeRange.earliest) {
        stats.timeRange.earliest = entry.timestamp;
      }
      if (!stats.timeRange.latest || entry.timestamp > stats.timeRange.latest) {
        stats.timeRange.latest = entry.timestamp;
      }
    });

    return stats;
  }

  /**
   * Export audit log entries
   */
  exportEntries(filter?: AuditLogFilter): AuditLogExport {
    const entries = this.getEntries(filter);

    return {
      metadata: {
        exportTimestamp: new Date(),
        totalEntries: entries.length,
        filterApplied: !!filter,
        filter,
        version: '1.0.0',
      },
      entries,
    };
  }

  /**
   * Import audit log entries
   */
  importEntries(exportData: AuditLogExport): number {
    let importedCount = 0;

    try {
      exportData.entries.forEach(entry => {
        // Validate entry structure
        if (this.isValidAuditEntry(entry)) {
          // Check for duplicates
          const existingEntry = this.entries.find(e => e.id === entry.id);
          if (!existingEntry) {
            this.entries.push(entry);
            importedCount++;
          }
        }
      });

      // Sort entries by timestamp
      this.entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Enforce memory limits
      this.enforceMemoryLimits();

      // Update storage
      if (AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE) {
        this.saveToStorage();
      }

      console.log(`Imported ${importedCount} audit log entries`);

    } catch (error) {
      console.error('Failed to import audit log entries:', error);
    }

    return importedCount;
  }

  /**
   * Clear all audit log entries
   */
  clear(): void {
    this.entries = [];
    
    if (AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE) {
      this.clearStorage();
    }
    
    console.log('Audit log cleared');
  }

  /**
   * Apply filter to audit entries
   */
  private applyFilter(entries: PermissionAuditLogEntry[], filter: AuditLogFilter): PermissionAuditLogEntry[] {
    return entries.filter(entry => {
      // User filter
      if (filter.userId && entry.event.userId !== filter.userId) {
        return false;
      }

      // Workspace filter
      if (filter.workspaceId && entry.event.workspaceId !== filter.workspaceId) {
        return false;
      }

      // Event type filter
      if (filter.eventType && entry.event.type !== filter.eventType) {
        return false;
      }

      // Event types filter (multiple)
      if (filter.eventTypes && !filter.eventTypes.includes(entry.event.type)) {
        return false;
      }

      // Level filter
      if (filter.level && entry.level !== filter.level) {
        return false;
      }

      // Levels filter (multiple)
      if (filter.levels && !filter.levels.includes(entry.level)) {
        return false;
      }

      // Source filter
      if (filter.source && entry.source !== filter.source) {
        return false;
      }

      // Time range filter
      if (filter.timeRange) {
        const entryTime = entry.timestamp.getTime();
        const fromTime = filter.timeRange.from.getTime();
        const toTime = filter.timeRange.to.getTime();
        
        if (entryTime < fromTime || entryTime > toTime) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Determine appropriate log level for event
   */
  private determineLogLevel(event: PermissionEvent, providedLevel?: PermissionAuditLogEntry['level']): PermissionAuditLogEntry['level'] {
    if (providedLevel) {
      return providedLevel;
    }

    // Auto-determine level based on event type
    switch (event.type) {
      case 'permissionCheckFailed':
      case 'permissionQueryError':
        return 'error';
      case 'permissionRevoked':
      case 'workspaceAccessRevoked':
      case 'roleChanged':
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Build audit context information
   */
  private buildAuditContext(): PermissionAuditLogEntry['context'] {
    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      sessionId: this.getSessionId(),
      requestId: this.generateRequestId(),
    };
  }

  /**
   * Generate unique entry ID
   */
  private generateEntryId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate request ID for correlation
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get session ID (simplified for demo)
   */
  private getSessionId(): string {
    // In production, this would be managed by auth system
    return sessionStorage.getItem('session_id') || 'anonymous';
  }

  /**
   * Check if event is critical
   */
  private isCriticalEvent(eventType: PermissionEventType): boolean {
    return AUDIT_CONFIG.CRITICAL_EVENTS.includes(eventType);
  }

  /**
   * Log critical events to console
   */
  private logCriticalEvent(entry: PermissionAuditLogEntry): void {
    console.warn('🚨 Critical Permission Event:', {
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      event: entry.event,
      level: entry.level,
    });
  }

  /**
   * Validate audit entry structure
   */
  private isValidAuditEntry(entry: any): entry is PermissionAuditLogEntry {
    return (
      entry &&
      typeof entry.id === 'string' &&
      entry.timestamp instanceof Date &&
      entry.event &&
      typeof entry.event.type === 'string' &&
      typeof entry.event.userId === 'string' &&
      ['info', 'warn', 'error', 'critical'].includes(entry.level) &&
      ['frontend', 'backend', 'cache', 'auth'].includes(entry.source)
    );
  }

  /**
   * Enforce memory limits
   */
  private enforceMemoryLimits(): void {
    if (this.entries.length > AUDIT_CONFIG.MAX_ENTRIES) {
      const excessEntries = this.entries.length - AUDIT_CONFIG.MAX_ENTRIES;
      this.entries.splice(0, excessEntries);
    }
  }

  /**
   * Perform automatic cleanup
   */
  private performAutoCleanup(): void {
    const cutoffDate = new Date(Date.now() - AUDIT_CONFIG.AUTO_CLEANUP_DAYS * 24 * 60 * 60 * 1000);
    this.cleanup(cutoffDate);
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    try {
      const serialized = JSON.stringify(this.entries);
      return Math.round(serialized.length / 1024); // KB
    } catch {
      return 0;
    }
  }

  /**
   * Load entries from localStorage
   */
  private loadFromStorage(): void {
    if (!AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(AUDIT_CONFIG.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Convert timestamp strings back to Date objects
          this.entries = parsed.map(entry => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to load audit log from storage:', error);
    }
  }

  /**
   * Save entries to localStorage
   */
  private saveToStorage(): void {
    if (!AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE || typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(AUDIT_CONFIG.STORAGE_KEY, JSON.stringify(this.entries));
    } catch (error) {
      console.warn('Failed to save audit log to storage:', error);
    }
  }

  /**
   * Save to storage asynchronously (debounced)
   */
  private saveToStorageAsync = this.debounce(() => {
    this.saveToStorage();
  }, 1000);

  /**
   * Clear localStorage
   */
  private clearStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUDIT_CONFIG.STORAGE_KEY);
    }
  }

  /**
   * Get number of entries in storage
   */
  private getStorageEntryCount(): number {
    if (!AUDIT_CONFIG.ENABLE_PERSISTENT_STORAGE || typeof localStorage === 'undefined') {
      return 0;
    }

    try {
      const stored = localStorage.getItem(AUDIT_CONFIG.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch {
      // Ignore errors
    }

    return 0;
  }

  /**
   * Debounce utility function
   */
  private debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let timeoutId: NodeJS.Timeout;
    
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  }
}

// Export singleton instance
export const enhancedPermissionAuditLogger = EnhancedPermissionAuditLogger.getInstance();

// Export convenience functions
export function getAuditLogStatistics(): AuditLogStatistics {
  return enhancedPermissionAuditLogger.getStatistics();
}

export function exportAuditLog(filter?: AuditLogFilter): AuditLogExport {
  return enhancedPermissionAuditLogger.exportEntries(filter);
}

export function clearAuditLog(): void {
  enhancedPermissionAuditLogger.clear();
}
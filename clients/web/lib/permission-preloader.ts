/**
 * Permission Preloading Optimization System
 * 
 * Intelligent system for preloading permissions based on user behavior patterns,
 * navigation predictions, and workspace context to minimize perceived latency.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import { apolloClient } from './apollo-client';
import {
  GET_USER_WORKSPACE_PERMISSIONS,
  GET_USER_PERMISSIONS_FOR_CONTEXT,
  CHECK_USER_PERMISSION,
  GetUserWorkspacePermissionsVariables,
  GetUserWorkspacePermissionsData,
  GetUserPermissionsForContextVariables,
  GetUserPermissionsForContextData,
  CheckUserPermissionVariables,
  CheckUserPermissionData,
} from './graphql/userOperations';

/**
 * Preloading configuration
 */
const PRELOAD_CONFIG = {
  // Enable intelligent preloading
  ENABLED: true,
  
  // Preload permissions when user navigates or hovers over workspace links
  PRELOAD_ON_NAVIGATION_INTENT: true,
  
  // Preload common permissions for active workspace
  PRELOAD_COMMON_PERMISSIONS: true,
  
  // Preload related workspace permissions
  PRELOAD_RELATED_WORKSPACES: true,
  
  // Performance limits
  MAX_CONCURRENT_PRELOADS: 3,
  PRELOAD_TIMEOUT_MS: 2000,
  
  // User behavior analysis
  TRACK_USER_PATTERNS: true,
  PATTERN_HISTORY_SIZE: 100,
  
  // Common permissions to preload for active workspaces
  COMMON_PERMISSIONS: [
    'workspace:read',
    'canvas:read',
    'canvas:create',
    'canvas:update',
    'connection:create',
    'card:create',
    'card:update',
  ],
  
  // Navigation prediction thresholds
  HOVER_DELAY_MS: 500, // Preload after hovering for 500ms
  PREDICTION_CONFIDENCE_THRESHOLD: 0.7,
};

/**
 * User navigation pattern data
 */
interface NavigationPattern {
  fromWorkspace: string;
  toWorkspace: string;
  timestamp: number;
  duration: number;
  frequency: number;
}

/**
 * Preload request tracking
 */
interface PreloadRequest {
  id: string;
  type: 'workspace' | 'context' | 'permission';
  userId: string;
  workspaceId?: string;
  permission?: string;
  startTime: number;
  promise: Promise<any>;
  priority: 'low' | 'medium' | 'high';
  source: 'navigation' | 'hover' | 'pattern' | 'manual';
}

/**
 * Preload statistics
 */
interface PreloadStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  averagePreloadTime: number;
  requestsBySource: Record<string, number>;
  requestsByPriority: Record<string, number>;
  patternPredictionAccuracy: number;
}

/**
 * Permission preloader implementation
 */
export class PermissionPreloader {
  private static instance: PermissionPreloader;
  
  private activeRequests = new Map<string, PreloadRequest>();
  private navigationPatterns: NavigationPattern[] = [];
  private preloadStatistics: PreloadStatistics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    averagePreloadTime: 0,
    requestsBySource: {},
    requestsByPriority: {},
    patternPredictionAccuracy: 0,
  };
  
  private hoverTimers = new Map<string, NodeJS.Timeout>();
  private currentWorkspaceId?: string;
  private currentUserId?: string;

  /**
   * Singleton instance getter
   */
  static getInstance(): PermissionPreloader {
    if (!PermissionPreloader.instance) {
      PermissionPreloader.instance = new PermissionPreloader();
    }
    return PermissionPreloader.instance;
  }

  /**
   * Initialize the preloader
   */
  initialize(userId: string, currentWorkspaceId?: string): void {
    if (!PRELOAD_CONFIG.ENABLED) {
      return;
    }

    this.currentUserId = userId;
    this.currentWorkspaceId = currentWorkspaceId;

    console.log('Permission Preloader initialized', {
      userId,
      currentWorkspaceId,
      trackPatterns: PRELOAD_CONFIG.TRACK_USER_PATTERNS,
    });

    // Load navigation patterns from storage
    this.loadNavigationPatterns();

    // Set up navigation event listeners
    this.setupNavigationListeners();

    // Preload context permissions immediately
    this.preloadContextPermissions(userId, 'navigation');

    // Preload common permissions for current workspace
    if (currentWorkspaceId) {
      this.preloadCommonWorkspacePermissions(userId, currentWorkspaceId, 'navigation');
    }
  }

  /**
   * Update current workspace context
   */
  updateWorkspaceContext(userId: string, workspaceId: string): void {
    const previousWorkspace = this.currentWorkspaceId;
    this.currentUserId = userId;
    this.currentWorkspaceId = workspaceId;

    // Record navigation pattern
    if (previousWorkspace && previousWorkspace !== workspaceId) {
      this.recordNavigationPattern(previousWorkspace, workspaceId);
    }

    // Preload permissions for new workspace
    this.preloadCommonWorkspacePermissions(userId, workspaceId, 'navigation');
    
    // Predict and preload related workspaces
    this.preloadPredictedWorkspaces(userId, workspaceId);
  }

  /**
   * Handle navigation intent (hover, focus, etc.)
   */
  handleNavigationIntent(targetWorkspaceId: string, eventType: 'hover' | 'focus'): void {
    if (!this.currentUserId || !PRELOAD_CONFIG.PRELOAD_ON_NAVIGATION_INTENT) {
      return;
    }

    const timerId = `${eventType}_${targetWorkspaceId}`;

    // Clear existing timer
    if (this.hoverTimers.has(timerId)) {
      clearTimeout(this.hoverTimers.get(timerId)!);
    }

    // Set new timer for delayed preload
    const timer = setTimeout(() => {
      this.preloadWorkspacePermissions(
        this.currentUserId!,
        targetWorkspaceId,
        'hover',
        'medium'
      );
      this.hoverTimers.delete(timerId);
    }, PRELOAD_CONFIG.HOVER_DELAY_MS);

    this.hoverTimers.set(timerId, timer);
  }

  /**
   * Cancel navigation intent (mouse leave, blur, etc.)
   */
  cancelNavigationIntent(targetWorkspaceId: string, eventType: 'hover' | 'focus'): void {
    const timerId = `${eventType}_${targetWorkspaceId}`;
    
    if (this.hoverTimers.has(timerId)) {
      clearTimeout(this.hoverTimers.get(timerId)!);
      this.hoverTimers.delete(timerId);
    }
  }

  /**
   * Manually trigger preload for specific permission
   */
  async preloadPermission(
    userId: string,
    workspaceId: string,
    permission: string,
    priority: PreloadRequest['priority'] = 'medium'
  ): Promise<boolean> {
    // Validate required parameters
    if (!userId || !workspaceId || !permission) {
      return false;
    }

    const requestId = this.generateRequestId('permission', userId, workspaceId, permission);
    
    // Check if already in progress
    if (this.activeRequests.has(requestId)) {
      return false;
    }

    // Check if at max concurrent requests
    if (this.activeRequests.size >= PRELOAD_CONFIG.MAX_CONCURRENT_PRELOADS) {
      console.log('Preload queue full, skipping permission preload');
      return false;
    }

    const request: PreloadRequest = {
      id: requestId,
      type: 'permission',
      userId,
      workspaceId,
      permission,
      startTime: Date.now(),
      priority,
      source: 'manual',
      promise: this.executePermissionPreload(userId, workspaceId, permission),
    };

    this.activeRequests.set(requestId, request);
    this.updateStatistics('totalRequests');
    this.updateStatistics('requestsBySource', request.source);
    this.updateStatistics('requestsByPriority', request.priority);

    try {
      await request.promise;
      this.updateStatistics('successfulRequests');
      return true;
    } catch (error) {
      this.updateStatistics('failedRequests');
      console.warn(`Permission preload failed for ${permission} in ${workspaceId}:`, error);
      return false;
    } finally {
      this.activeRequests.delete(requestId);
      this.updatePreloadTime(request.startTime);
    }
  }

  /**
   * Preload workspace permissions
   */
  private async preloadWorkspacePermissions(
    userId: string,
    workspaceId: string,
    source: PreloadRequest['source'],
    priority: PreloadRequest['priority'] = 'medium'
  ): Promise<void> {
    const requestId = this.generateRequestId('workspace', userId, workspaceId);
    
    if (this.activeRequests.has(requestId) || 
        this.activeRequests.size >= PRELOAD_CONFIG.MAX_CONCURRENT_PRELOADS) {
      return;
    }

    const request: PreloadRequest = {
      id: requestId,
      type: 'workspace',
      userId,
      workspaceId,
      startTime: Date.now(),
      priority,
      source,
      promise: this.executeWorkspacePreload(userId, workspaceId),
    };

    this.activeRequests.set(requestId, request);
    this.updateStatistics('totalRequests');

    try {
      await request.promise;
      this.updateStatistics('successfulRequests');
    } catch (error) {
      this.updateStatistics('failedRequests');
    } finally {
      this.activeRequests.delete(requestId);
      this.updatePreloadTime(request.startTime);
    }
  }

  /**
   * Preload context permissions (all workspaces)
   */
  private async preloadContextPermissions(
    userId: string,
    source: PreloadRequest['source']
  ): Promise<void> {
    const requestId = this.generateRequestId('context', userId);
    
    if (this.activeRequests.has(requestId)) {
      return;
    }

    const request: PreloadRequest = {
      id: requestId,
      type: 'context',
      userId,
      startTime: Date.now(),
      priority: 'high',
      source,
      promise: this.executeContextPreload(),
    };

    this.activeRequests.set(requestId, request);
    this.updateStatistics('totalRequests');

    try {
      await request.promise;
      this.updateStatistics('successfulRequests');
    } catch (error) {
      this.updateStatistics('failedRequests');
    } finally {
      this.activeRequests.delete(requestId);
      this.updatePreloadTime(request.startTime);
    }
  }

  /**
   * Preload common permissions for workspace
   */
  private async preloadCommonWorkspacePermissions(
    userId: string,
    workspaceId: string,
    source: PreloadRequest['source']
  ): Promise<void> {
    if (!PRELOAD_CONFIG.PRELOAD_COMMON_PERMISSIONS) {
      return;
    }

    // Preload workspace permissions first
    await this.preloadWorkspacePermissions(userId, workspaceId, source, 'high');

    // Then preload common specific permissions
    const preloadPromises = PRELOAD_CONFIG.COMMON_PERMISSIONS.map(permission =>
      this.preloadPermission(userId, workspaceId, permission, 'low')
    );

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Predict and preload related workspaces based on patterns
   */
  private async preloadPredictedWorkspaces(userId: string, currentWorkspaceId: string): Promise<void> {
    if (!PRELOAD_CONFIG.PRELOAD_RELATED_WORKSPACES || !PRELOAD_CONFIG.TRACK_USER_PATTERNS) {
      return;
    }

    const predictions = this.predictNextWorkspaces(currentWorkspaceId);
    
    for (const prediction of predictions) {
      if (prediction.confidence >= PRELOAD_CONFIG.PREDICTION_CONFIDENCE_THRESHOLD) {
        await this.preloadWorkspacePermissions(
          userId,
          prediction.workspaceId,
          'pattern',
          'low'
        );
      }
    }
  }

  /**
   * Execute workspace permission preload
   */
  private async executeWorkspacePreload(userId: string, workspaceId: string): Promise<void> {
    try {
      await apolloClient.query<GetUserWorkspacePermissionsData, GetUserWorkspacePermissionsVariables>({
        query: GET_USER_WORKSPACE_PERMISSIONS,
        variables: { userId, workspaceId },
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      });

      console.log(`Preloaded workspace permissions: ${workspaceId}`);
    } catch (error) {
      console.warn(`Workspace preload failed for ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Execute context permission preload
   */
  private async executeContextPreload(): Promise<void> {
    try {
      await apolloClient.query<GetUserPermissionsForContextData, GetUserPermissionsForContextVariables>({
        query: GET_USER_PERMISSIONS_FOR_CONTEXT,
        variables: {},
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      });

      console.log('Preloaded context permissions');
    } catch (error) {
      console.warn('Context preload failed:', error);
      throw error;
    }
  }

  /**
   * Execute specific permission preload
   */
  private async executePermissionPreload(
    userId: string,
    workspaceId: string,
    permission: string
  ): Promise<void> {
    try {
      await apolloClient.query<CheckUserPermissionData, CheckUserPermissionVariables>({
        query: CHECK_USER_PERMISSION,
        variables: { userId, workspaceId, permission },
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      });

      console.log(`Preloaded permission: ${permission} in ${workspaceId}`);
    } catch (error) {
      console.warn(`Permission preload failed for ${permission}:`, error);
      throw error;
    }
  }

  /**
   * Record navigation pattern for learning
   */
  private recordNavigationPattern(fromWorkspace: string, toWorkspace: string): void {
    if (!PRELOAD_CONFIG.TRACK_USER_PATTERNS) {
      return;
    }

    const now = Date.now();
    const existingPattern = this.navigationPatterns.find(
      p => p.fromWorkspace === fromWorkspace && p.toWorkspace === toWorkspace
    );

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.timestamp = now;
    } else {
      this.navigationPatterns.push({
        fromWorkspace,
        toWorkspace,
        timestamp: now,
        duration: 0, // Will be calculated over time
        frequency: 1,
      });
    }

    // Maintain pattern history size
    if (this.navigationPatterns.length > PRELOAD_CONFIG.PATTERN_HISTORY_SIZE) {
      this.navigationPatterns.sort((a, b) => b.timestamp - a.timestamp);
      this.navigationPatterns = this.navigationPatterns.slice(0, PRELOAD_CONFIG.PATTERN_HISTORY_SIZE);
    }

    // Save patterns to storage
    this.saveNavigationPatterns();
  }

  /**
   * Predict next workspaces based on patterns
   */
  private predictNextWorkspaces(currentWorkspace: string): Array<{
    workspaceId: string;
    confidence: number;
  }> {
    const relevantPatterns = this.navigationPatterns.filter(
      p => p.fromWorkspace === currentWorkspace
    );

    if (relevantPatterns.length === 0) {
      return [];
    }

    // Calculate confidence based on frequency and recency
    const predictions = relevantPatterns.map(pattern => {
      const recencyScore = Math.max(0, 1 - (Date.now() - pattern.timestamp) / (7 * 24 * 60 * 60 * 1000)); // 7 days
      const frequencyScore = Math.min(1, pattern.frequency / 10); // Max frequency score at 10
      const confidence = (recencyScore * 0.3) + (frequencyScore * 0.7);

      return {
        workspaceId: pattern.toWorkspace,
        confidence,
      };
    });

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Setup navigation event listeners
   */
  private setupNavigationListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Listen for workspace link hovers
    document.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      const workspaceLink = target.closest('[data-workspace-id]');
      
      if (workspaceLink) {
        const workspaceId = workspaceLink.getAttribute('data-workspace-id');
        if (workspaceId) {
          this.handleNavigationIntent(workspaceId, 'hover');
        }
      }
    });

    // Listen for mouse leave
    document.addEventListener('mouseout', (event) => {
      const target = event.target as HTMLElement;
      const workspaceLink = target.closest('[data-workspace-id]');
      
      if (workspaceLink) {
        const workspaceId = workspaceLink.getAttribute('data-workspace-id');
        if (workspaceId) {
          this.cancelNavigationIntent(workspaceId, 'hover');
        }
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(type: string, userId: string, workspaceId?: string, permission?: string): string {
    const parts = [type, userId, workspaceId, permission].filter(Boolean);
    return parts.join('_');
  }

  /**
   * Update preload statistics
   */
  private updateStatistics(metric: string, subMetric?: string, increment: number = 1): void {
    if (subMetric) {
      const current = (this.preloadStatistics as any)[metric][subMetric] || 0;
      (this.preloadStatistics as any)[metric][subMetric] = current + increment;
    } else {
      (this.preloadStatistics as any)[metric] += increment;
    }
  }

  /**
   * Update average preload time
   */
  private updatePreloadTime(startTime: number): void {
    const duration = Date.now() - startTime;
    const totalRequests = this.preloadStatistics.totalRequests;
    const currentAverage = this.preloadStatistics.averagePreloadTime;
    
    this.preloadStatistics.averagePreloadTime = 
      (currentAverage * (totalRequests - 1) + duration) / totalRequests;
  }

  /**
   * Load navigation patterns from storage
   */
  private loadNavigationPatterns(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem('permission_navigation_patterns');
      if (stored) {
        this.navigationPatterns = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load navigation patterns:', error);
    }
  }

  /**
   * Save navigation patterns to storage
   */
  private saveNavigationPatterns(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem('permission_navigation_patterns', JSON.stringify(this.navigationPatterns));
    } catch (error) {
      console.warn('Failed to save navigation patterns:', error);
    }
  }

  /**
   * Get preload statistics
   */
  getStatistics(): PreloadStatistics {
    return { ...this.preloadStatistics };
  }

  /**
   * Clear preload statistics (for testing)
   */
  clearStatistics(): void {
    this.preloadStatistics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averagePreloadTime: 0,
      requestsBySource: { manual: 0, automatic: 0, prediction: 0 },
      requestsByPriority: { low: 0, medium: 0, high: 0 },
      patternPredictionAccuracy: 0,
    };
  }

  /**
   * Get active preload requests
   */
  getActiveRequests(): PreloadRequest[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Clear all active requests
   */
  clearActiveRequests(): void {
    this.activeRequests.clear();
  }

  /**
   * Get navigation patterns
   */
  getNavigationPatterns(): NavigationPattern[] {
    return [...this.navigationPatterns];
  }

  /**
   * Clear navigation patterns
   */
  clearNavigationPatterns(): void {
    this.navigationPatterns = [];
    this.saveNavigationPatterns();
  }
}

// Export singleton instance
export const permissionPreloader = PermissionPreloader.getInstance();

// Export convenience functions
export function initializePreloader(userId: string, workspaceId?: string): void {
  permissionPreloader.initialize(userId, workspaceId);
}

export function updatePreloaderWorkspace(userId: string, workspaceId: string): void {
  permissionPreloader.updateWorkspaceContext(userId, workspaceId);
}

export function preloadPermission(
  userId: string,
  workspaceId: string,
  permission: string,
  priority?: 'low' | 'medium' | 'high'
): Promise<boolean> {
  return permissionPreloader.preloadPermission(userId, workspaceId, permission, priority);
}

export function getPreloadStatistics(): PreloadStatistics {
  return permissionPreloader.getStatistics();
}
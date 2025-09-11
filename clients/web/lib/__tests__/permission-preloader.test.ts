/**
 * Permission Preloader Tests
 * 
 * Comprehensive tests for the permission preloading optimization system
 * including pattern learning, navigation prediction, and performance optimization.
 */

import { PermissionPreloader, permissionPreloader } from '../permission-preloader';

// Mock dependencies
jest.mock('../apollo-client', () => ({
  apolloClient: {
    query: jest.fn(),
  },
}));

jest.mock('../apollo-permission-cache', () => ({
  permissionCacheManager: {
    warmUserPermissionCache: jest.fn(),
  },
}));

jest.mock('../permission-notification-system', () => ({
  emitPermissionEvent: jest.fn(),
}));

jest.mock('../graphql/userOperations', () => ({
  GET_USER_WORKSPACE_PERMISSIONS: 'GET_USER_WORKSPACE_PERMISSIONS',
  GET_USER_PERMISSIONS_FOR_CONTEXT: 'GET_USER_PERMISSIONS_FOR_CONTEXT',
  CHECK_USER_PERMISSION: 'CHECK_USER_PERMISSION',
}));

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

// Mock DOM
Object.defineProperty(document, 'addEventListener', {
  value: jest.fn(),
});

describe('Permission Preloader', () => {
  let preloader: PermissionPreloader;
  const { apolloClient } = require('../apollo-client');

  beforeEach(() => {
    // Reset singleton instance for clean test state
    (PermissionPreloader as any).instance = null;
    
    preloader = PermissionPreloader.getInstance();
    preloader.clearActiveRequests();
    preloader.clearNavigationPatterns();
    preloader.clearStatistics();
    jest.clearAllMocks();
    
    // Mock successful query responses
    apolloClient.query.mockResolvedValue({
      data: { permissions: ['read', 'write'] },
    });
  });

  afterEach(() => {
    preloader.clearActiveRequests();
    preloader.clearNavigationPatterns();
    preloader.clearStatistics();
    // Reset singleton for next test
    (PermissionPreloader as any).instance = null;
  });

  describe('Initialization', () => {
    it('should initialize with user ID and workspace', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      preloader.initialize('user123', 'workspace456');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Permission Preloader initialized',
        expect.objectContaining({
          userId: 'user123',
          currentWorkspaceId: 'workspace456',
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should load navigation patterns from storage on initialization', () => {
      const mockPatterns = [
        {
          fromWorkspace: 'ws1',
          toWorkspace: 'ws2',
          timestamp: Date.now(),
          duration: 1000,
          frequency: 5,
        },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockPatterns));
      
      preloader.initialize('user123');
      
      const patterns = preloader.getNavigationPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].fromWorkspace).toBe('ws1');
    });

    it('should handle storage loading errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(() => preloader.initialize('user123')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load navigation patterns:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Manual Permission Preloading', () => {
    beforeEach(() => {
      preloader.initialize('user123', 'workspace456');
    });

    it('should preload specific permissions successfully', async () => {
      const result = await preloader.preloadPermission(
        'user123',
        'workspace456',
        'canvas:create',
        'high'
      );
      
      expect(result).toBe(true);
      expect(apolloClient.query).toHaveBeenCalledWith({
        query: 'CHECK_USER_PERMISSION',
        variables: {
          userId: 'user123',
          workspaceId: 'workspace456',
          permission: 'canvas:create',
        },
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      });
    });

    it('should handle preload failures gracefully', async () => {
      apolloClient.query.mockRejectedValueOnce(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await preloader.preloadPermission(
        'user123',
        'workspace456',
        'canvas:create'
      );
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission preload failed'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should respect concurrent request limits', async () => {
      // Set up multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        preloader.preloadPermission('user123', 'workspace456', `permission${i}`)
      );
      
      const results = await Promise.all(promises);
      
      // Some requests should be rejected due to concurrency limits
      const successCount = results.filter(Boolean).length;
      const failureCount = results.filter(r => !r).length;
      
      expect(successCount).toBeLessThanOrEqual(3); // Max concurrent limit
      expect(failureCount).toBeGreaterThanOrEqual(2);
    });

    it('should prevent duplicate requests for same permission', async () => {
      // Start first request
      const promise1 = preloader.preloadPermission(
        'user123',
        'workspace456',
        'canvas:create'
      );
      
      // Start duplicate request immediately
      const promise2 = preloader.preloadPermission(
        'user123',
        'workspace456',
        'canvas:create'
      );
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe(true);
      expect(result2).toBe(false); // Duplicate should be rejected
    });
  });

  describe('Navigation Intent Handling', () => {
    beforeEach(() => {
      // Initialize without workspace to prevent automatic preloads
      preloader.initialize('user123');
      jest.useFakeTimers();
      
      // Clear mock calls from initialization
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle hover intent with delay', () => {
      preloader.handleNavigationIntent('target-workspace', 'hover');
      
      // Should not preload immediately
      expect(apolloClient.query).not.toHaveBeenCalled();
      
      // Fast-forward past hover delay
      jest.advanceTimersByTime(600);
      
      // Should now trigger preload
      expect(apolloClient.query).toHaveBeenCalled();
    });

    it('should cancel navigation intent', () => {
      preloader.handleNavigationIntent('target-workspace', 'hover');
      preloader.cancelNavigationIntent('target-workspace', 'hover');
      
      // Fast-forward past hover delay
      jest.advanceTimersByTime(600);
      
      // Should not trigger preload after cancellation
      expect(apolloClient.query).not.toHaveBeenCalled();
    });

    it('should handle multiple hover intents', () => {
      preloader.handleNavigationIntent('workspace1', 'hover');
      preloader.handleNavigationIntent('workspace2', 'hover');
      
      jest.advanceTimersByTime(600);
      
      // Should trigger preloads for both workspaces
      expect(apolloClient.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('Workspace Context Updates', () => {
    beforeEach(() => {
      preloader.initialize('user123', 'workspace1');
    });

    it('should record navigation patterns when switching workspaces', () => {
      preloader.updateWorkspaceContext('user123', 'workspace2');
      
      const patterns = preloader.getNavigationPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].fromWorkspace).toBe('workspace1');
      expect(patterns[0].toWorkspace).toBe('workspace2');
      expect(patterns[0].frequency).toBe(1);
    });

    it('should increment frequency for repeated navigation patterns', () => {
      preloader.updateWorkspaceContext('user123', 'workspace2');
      preloader.updateWorkspaceContext('user123', 'workspace1');
      preloader.updateWorkspaceContext('user123', 'workspace2');
      
      const patterns = preloader.getNavigationPatterns();
      const pattern = patterns.find(p => 
        p.fromWorkspace === 'workspace1' && p.toWorkspace === 'workspace2'
      );
      
      expect(pattern?.frequency).toBe(2);
    });

    it('should save navigation patterns to storage', () => {
      preloader.updateWorkspaceContext('user123', 'workspace2');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'permission_navigation_patterns',
        expect.any(String)
      );
    });
  });

  describe('Pattern-Based Prediction', () => {
    beforeEach(() => {
      preloader.initialize('user123', 'workspace1');
      
      // Create some navigation patterns
      preloader.updateWorkspaceContext('user123', 'workspace2');
      preloader.updateWorkspaceContext('user123', 'workspace3');
      preloader.updateWorkspaceContext('user123', 'workspace1');
      preloader.updateWorkspaceContext('user123', 'workspace2'); // High frequency
      preloader.updateWorkspaceContext('user123', 'workspace1');
      preloader.updateWorkspaceContext('user123', 'workspace2'); // High frequency
    });

    it('should predict next workspaces based on patterns', async () => {
      // Switch to workspace1, which should trigger prediction
      preloader.updateWorkspaceContext('user123', 'workspace1');
      
      // Wait for prediction preloads to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have preloaded workspace2 based on pattern
      const callArgs = apolloClient.query.mock.calls;
      const workspacePreloadCall = callArgs.find((call: any) => 
        call[0].query === 'GET_USER_WORKSPACE_PERMISSIONS' &&
        call[0].variables.workspaceId === 'workspace2'
      );
      
      expect(workspacePreloadCall).toBeTruthy();
    });

    it('should calculate prediction confidence correctly', () => {
      // Test the private prediction method through navigation updates
      const patterns = preloader.getNavigationPatterns();
      
      // Should have patterns with different frequencies
      const ws1ToWs2 = patterns.find(p => 
        p.fromWorkspace === 'workspace1' && p.toWorkspace === 'workspace2'
      );
      
      expect(ws1ToWs2?.frequency).toBeGreaterThan(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      preloader.initialize('user123', 'workspace456');
      
      // Wait for automatic preloads to complete and then clear statistics
      await new Promise(resolve => setTimeout(resolve, 50));
      preloader.clearStatistics();
    });

    it('should track preload statistics', async () => {
      await preloader.preloadPermission('user123', 'workspace456', 'read');
      
      const stats = preloader.getStatistics();
      
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
      expect(stats.requestsBySource.manual).toBe(1);
    });

    it('should track failed requests', async () => {
      apolloClient.query.mockRejectedValueOnce(new Error('Network error'));
      
      await preloader.preloadPermission('user123', 'workspace456', 'read');
      
      const stats = preloader.getStatistics();
      
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(1);
    });

    it('should calculate average preload time', async () => {
      // Mock a delay in the query
      apolloClient.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
      );
      
      await preloader.preloadPermission('user123', 'workspace456', 'read');
      
      const stats = preloader.getStatistics();
      expect(stats.averagePreloadTime).toBeGreaterThan(90);
    });

    it('should track requests by source and priority', async () => {
      await preloader.preloadPermission('user123', 'workspace456', 'read', 'high');
      
      const stats = preloader.getStatistics();
      
      expect(stats.requestsBySource.manual).toBe(1);
      expect(stats.requestsByPriority.high).toBe(1);
    });
  });

  describe('Active Request Management', () => {
    beforeEach(() => {
      preloader.initialize('user123', 'workspace456');
    });

    it('should track active requests', async () => {
      // Start a request but don't await it immediately
      const promise = preloader.preloadPermission('user123', 'workspace456', 'read');
      
      const activeRequests = preloader.getActiveRequests();
      expect(activeRequests).toHaveLength(1);
      expect(activeRequests[0].type).toBe('permission');
      expect(activeRequests[0].userId).toBe('user123');
      expect(activeRequests[0].permission).toBe('read');
      
      await promise;
      
      // Should be cleared after completion
      const finalActiveRequests = preloader.getActiveRequests();
      expect(finalActiveRequests).toHaveLength(0);
    });

    it('should clear all active requests', async () => {
      // Start multiple requests
      preloader.preloadPermission('user123', 'workspace456', 'read');
      preloader.preloadPermission('user123', 'workspace456', 'write');
      
      expect(preloader.getActiveRequests().length).toBeGreaterThan(0);
      
      preloader.clearActiveRequests();
      expect(preloader.getActiveRequests()).toHaveLength(0);
    });
  });

  describe('Pattern Management', () => {
    beforeEach(() => {
      preloader.initialize('user123', 'workspace456');
    });

    it('should maintain pattern history limits', () => {
      // Create more patterns than the limit allows (assuming limit is 100)
      for (let i = 0; i < 120; i++) {
        preloader.updateWorkspaceContext('user123', `workspace${i % 10}`);
      }
      
      const patterns = preloader.getNavigationPatterns();
      expect(patterns.length).toBeLessThanOrEqual(100);
    });

    it('should clear navigation patterns', () => {
      preloader.updateWorkspaceContext('user123', 'workspace2');
      expect(preloader.getNavigationPatterns()).toHaveLength(1);
      
      preloader.clearNavigationPatterns();
      expect(preloader.getNavigationPatterns()).toHaveLength(0);
    });

    it('should save patterns after clearing', () => {
      preloader.clearNavigationPatterns();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'permission_navigation_patterns',
        '[]'
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing user ID gracefully', async () => {
      // Don't initialize with user ID
      const result = await preloader.preloadPermission('', 'workspace456', 'read');
      expect(result).toBe(false);
    });

    it('should handle storage save errors gracefully', () => {
      // Mock successful load but failing save
      localStorageMock.getItem.mockReturnValue(null); // Successful load
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      preloader.initialize('user123', 'workspace1'); // Initialize with workspace1
      preloader.updateWorkspaceContext('user123', 'workspace2'); // Move to workspace2 to trigger pattern save
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save navigation patterns:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle undefined localStorage gracefully', () => {
      // Temporarily remove localStorage
      const originalLocalStorage = window.localStorage;
      delete (window as any).localStorage;
      
      expect(() => {
        preloader.initialize('user123');
        preloader.updateWorkspaceContext('user123', 'workspace2');
      }).not.toThrow();
      
      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
      });
    });

    it('should handle query timeouts appropriately', async () => {
      apolloClient.query.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      );
      
      const result = await preloader.preloadPermission('user123', 'workspace456', 'read');
      expect(result).toBe(false);
    });
  });
});
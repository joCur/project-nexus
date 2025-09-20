/**
 * Structured Logger Tests
 * 
 * Comprehensive tests for the production-ready structured logging system
 * including log levels, formatting, batching, and context management.
 */

import {
  StructuredLogger,
  ChildLogger,
  LogLevel,
  permissionLogger,
  cacheLogger,
} from '../structured-logger';

// Mock fetch for remote logging
global.fetch = jest.fn();

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

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    memory: {
      usedJSHeapSize: 1024 * 1024, // 1MB
    },
  },
});

describe('Structured Logger', () => {
  let testLogger: StructuredLogger;

  beforeEach(() => {
    // Reset singleton instance for testing
    (StructuredLogger as any).instance = null;
    
    testLogger = StructuredLogger.getInstance({
      level: LogLevel.TRACE,
      enableConsoleOutput: false,
      enableRemoteLogging: false,
      enableLocalStorage: false,
      batchSize: 5,
      batchTimeout: 1000,
    });
    
    jest.clearAllMocks();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    testLogger.shutdown();
    (StructuredLogger as any).instance = null;
    jest.restoreAllMocks();
  });

  describe('Basic Logging Functionality', () => {
    beforeEach(() => {
      testLogger.updateConfig({ enableConsoleOutput: true });
    });

    it('should log at different levels', () => {
      testLogger.trace('Trace message');
      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warning message');
      testLogger.error('Error message');
      testLogger.fatal('Fatal message');

      expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('TRACE: Trace message'));
      expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('DEBUG: Debug message'));
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('INFO: Info message'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WARN: Warning message'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ERROR: Error message'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('FATAL: Fatal message'));
    });

    it('should respect log level configuration', () => {
      testLogger.updateConfig({ level: LogLevel.WARN });

      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warning message');
      testLogger.error('Error message');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WARN: Warning message'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ERROR: Error message'));
    });

    it('should include context in log output', () => {
      const context = {
        userId: 'user123',
        workspaceId: 'workspace456',
        feature: 'permissions',
      };

      testLogger.info('Test message', context);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test message')
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('"userId": "user123"')
      );
    });

    it('should include error information in logs', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      testLogger.error('Error occurred', error);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: Test error')
      );
    });

    it('should include tags in log output', () => {
      testLogger.info('Tagged message', {}, ['tag1', 'tag2']);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Tags: tag1, tag2')
      );
    });
  });

  describe('Performance Logging', () => {
    beforeEach(() => {
      testLogger.updateConfig({ 
        enableConsoleOutput: true,
        enablePerformanceMetrics: true,
      });
    });

    it('should log performance metrics', () => {
      testLogger.performance('Operation completed', 150, {
        feature: 'cache',
      });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Operation completed')
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('"duration": 150')
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('performance')
      );
    });

    it('should include memory usage in performance logs', () => {
      testLogger.performance('Memory test', 100);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('"memoryUsage"')
      );
    });
  });

  describe('Context Management', () => {
    it('should set and use base context', () => {
      const baseContext = {
        userId: 'user123',
        sessionId: 'session456',
      };

      testLogger.setBaseContext(baseContext);
      testLogger.updateConfig({ enableConsoleOutput: true });
      testLogger.info('Test message');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('"userId": "user123"')
      );
    });

    it('should merge context correctly', () => {
      testLogger.setBaseContext({ userId: 'user123' });
      testLogger.updateConfig({ enableConsoleOutput: true });
      
      testLogger.info('Test message', { workspaceId: 'workspace456' });

      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('"userId": "user123"');
      expect(logCall).toContain('"workspaceId": "workspace456"');
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional context', () => {
      const childLogger = testLogger.createChild({
        feature: 'permissions',
        component: 'PermissionHook',
      });

      expect(childLogger).toBeInstanceOf(ChildLogger);
    });

    it('should inherit parent context in child logger', () => {
      testLogger.setBaseContext({ userId: 'user123' });
      testLogger.updateConfig({ enableConsoleOutput: true });
      
      const childLogger = testLogger.createChild({
        feature: 'permissions',
      });

      childLogger.info('Child message', { action: 'check' });

      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('"userId": "user123"');
      expect(logCall).toContain('"feature": "permissions"');
      expect(logCall).toContain('"action": "check"');
    });

    it('should support nested child loggers', () => {
      testLogger.updateConfig({ enableConsoleOutput: true });
      
      const parentChild = testLogger.createChild({ feature: 'cache' });
      const nestedChild = parentChild.createChild({ component: 'compression' });

      nestedChild.info('Nested message');

      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('"feature": "cache"');
      expect(logCall).toContain('"component": "compression"');
    });
  });

  describe('Remote Logging', () => {
    beforeEach(() => {
      testLogger.updateConfig({
        enableRemoteLogging: true,
        remoteEndpoint: 'https://api.example.com/logs',
        batchSize: 2,
      });
      
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    it('should batch and send logs to remote endpoint', async () => {
      testLogger.info('Message 1');
      testLogger.info('Message 2');

      // Wait for batch to be sent
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/logs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Message 1'),
        })
      );
    });

    it('should handle remote logging failures gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      testLogger.updateConfig({ enableConsoleOutput: true });

      testLogger.info('Message 1');
      testLogger.info('Message 2');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send logs to remote endpoint:',
        expect.any(Error)
      );
    });

    it('should flush logs manually', async () => {
      testLogger.info('Manual flush test');
      
      await testLogger.flush();

      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('Local Storage', () => {
    beforeEach(() => {
      testLogger.updateConfig({ enableLocalStorage: true });
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should store logs in localStorage', () => {
      testLogger.info('Storage test');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'structured_logs',
        expect.stringContaining('Storage test')
      );
    });

    it('should maintain storage size limits', () => {
      testLogger.updateConfig({ maxLocalStorageEntries: 2 });
      
      // Mock existing logs
      const existingLogs = [
        JSON.stringify({ message: 'Old log 1' }),
        JSON.stringify({ message: 'Old log 2' }),
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingLogs));

      testLogger.info('New log');

      const setItemCall = localStorageMock.setItem.mock.calls[0];
      const storedLogs = JSON.parse(setItemCall[1]);
      
      expect(storedLogs).toHaveLength(2);
      expect(storedLogs[1]).toContain('New log');
    });

    it('should retrieve stored logs', () => {
      const mockLogs = [
        JSON.stringify({ message: 'Stored log 1', level: 2 }),
        JSON.stringify({ message: 'Stored log 2', level: 3 }),
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockLogs));

      const storedLogs = testLogger.getStoredLogs();

      expect(storedLogs).toHaveLength(2);
      expect(storedLogs[0].message).toBe('Stored log 1');
    });

    it('should clear stored logs', () => {
      testLogger.clearStoredLogs();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('structured_logs');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      expect(() => {
        testLogger.info('Storage error test');
      }).not.toThrow();
    });
  });

  describe('Sensitive Data Handling', () => {
    beforeEach(() => {
      testLogger.updateConfig({
        enableConsoleOutput: true,
        sensitiveFields: ['password', 'token', 'secret'],
      });
    });

    it('should sanitize sensitive fields from context', () => {
      testLogger.info('Sensitive data test', {
        userId: 'user123',
        password: 'secret123',
        token: 'jwt-token',
        regularField: 'safe-data',
      });

      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('"userId": "user123"');
      expect(logCall).toContain('"regularField": "safe-data"');
      expect(logCall).not.toContain('secret123');
      expect(logCall).not.toContain('jwt-token');
    });

    it('should sanitize sensitive fields from nested metadata', () => {
      testLogger.info('Nested sensitive test', {
        metadata: {
          publicInfo: 'safe',
          secret: 'hidden',
          nested: {
            password: 'also-hidden',
          },
        },
      });

      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('"publicInfo": "safe"');
      expect(logCall).not.toContain('hidden');
    });
  });

  describe('Pre-configured Loggers', () => {
    it('should have permission logger with correct context', () => {
      testLogger.updateConfig({ enableConsoleOutput: true });
      permissionLogger.info('Permission test');

      // Since permissionLogger is a child logger, we need to check the parent's console output
      // The exact implementation depends on how child loggers work
      expect(console.info).toHaveBeenCalled();
    });

    it('should have cache logger with correct context', () => {
      testLogger.updateConfig({ enableConsoleOutput: true });
      cacheLogger.info('Cache test');

      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle circular references in context', () => {
      const circularContext: any = { userId: 'user123' };
      circularContext.circular = circularContext;

      expect(() => {
        testLogger.info('Circular test', circularContext);
      }).not.toThrow();
    });

    it('should handle undefined and null values', () => {
      expect(() => {
        testLogger.info('Null test', {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
        });
      }).not.toThrow();
    });

    it('should handle missing performance API', () => {
      const originalPerformance = global.performance;
      delete (global as any).performance;

      expect(() => {
        testLogger.performance('Performance test', 100);
      }).not.toThrow();

      global.performance = originalPerformance;
    });

    it('should handle missing localStorage', () => {
      const originalLocalStorage = window.localStorage;
      delete (window as any).localStorage;

      expect(() => {
        testLogger.updateConfig({ enableLocalStorage: true });
        testLogger.info('No storage test');
      }).not.toThrow();

      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
      });
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', () => {
      testLogger.updateConfig({
        level: LogLevel.ERROR,
        enableConsoleOutput: true,
      });

      testLogger.info('Should not appear');
      testLogger.error('Should appear');

      expect(console.info).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('should recreate formatter when config changes', () => {
      testLogger.updateConfig({
        sensitiveFields: ['newSensitiveField'],
        enableConsoleOutput: true,
      });

      testLogger.info('Config update test', {
        newSensitiveField: 'should-be-hidden',
        regularField: 'should-appear',
      });

      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('should-appear');
      expect(logCall).not.toContain('should-be-hidden');
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown cleanly', () => {
      testLogger.updateConfig({ enableRemoteLogging: true });
      
      expect(() => testLogger.shutdown()).not.toThrow();
    });

    it('should flush logs on shutdown', async () => {
      testLogger.updateConfig({
        enableRemoteLogging: true,
        remoteEndpoint: 'https://api.example.com/logs',
      });

      testLogger.info('Shutdown test');
      testLogger.shutdown();

      // Should attempt to flush
      expect(fetch).toHaveBeenCalled();
    });
  });
});
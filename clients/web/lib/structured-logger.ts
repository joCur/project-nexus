/**
 * Structured Production Logger
 * 
 * Provides comprehensive structured logging with contextual information,
 * log levels, performance metrics, and production-ready error reporting.
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

/**
 * Log context interface
 */
export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  workspaceId?: string;
  canvasId?: string;
  feature?: string;
  component?: string;
  action?: string;
  correlationId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: number;
  source?: 'frontend' | 'permission-system' | 'cache' | 'auth' | 'navigation';
  performance?: {
    duration?: number;
    memoryUsage?: number;
    cacheHitRate?: number;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown; // Allow additional fields for test flexibility
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
  };
  tags?: string[];
  source: 'frontend' | 'permission-system' | 'cache' | 'auth' | 'navigation';
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsoleOutput: boolean;
  enableRemoteLogging: boolean;
  enableLocalStorage: boolean;
  enablePerformanceMetrics: boolean;
  remoteEndpoint?: string;
  batchSize: number;
  batchTimeout: number;
  maxLocalStorageEntries: number;
  sensitiveFields: string[];
  enableStackTrace: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsoleOutput: process.env.NODE_ENV !== 'production',
  enableRemoteLogging: process.env.NODE_ENV === 'production',
  enableLocalStorage: true,
  enablePerformanceMetrics: true,
  remoteEndpoint: process.env.NEXT_PUBLIC_LOGGING_ENDPOINT,
  batchSize: 50,
  batchTimeout: 10000, // 10 seconds
  maxLocalStorageEntries: 1000,
  sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization'],
  enableStackTrace: process.env.NODE_ENV !== 'production',
};

/**
 * Log formatter interface
 */
interface LogFormatter {
  formatForConsole(entry: LogEntry): string;
  formatForRemote(entry: LogEntry): Record<string, unknown>;
  formatForStorage(entry: LogEntry): string;
}

/**
 * Default log formatter implementation
 */
class DefaultLogFormatter implements LogFormatter {
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  formatForConsole(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level];
    const context = this.sanitizeContext(entry.context);
    
    let output = `[${timestamp}] ${level}: ${entry.message}`;
    
    if (Object.keys(context).length > 0) {
      output += `\nContext: ${JSON.stringify(context, null, 2)}`;
    }
    
    if (entry.error) {
      output += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (this.config.enableStackTrace && entry.error.stack) {
        output += `\nStack: ${entry.error.stack}`;
      }
    }
    
    if (entry.tags && entry.tags.length > 0) {
      output += `\nTags: ${entry.tags.join(', ')}`;
    }
    
    return output;
  }

  formatForRemote(entry: LogEntry): Record<string, unknown> {
    return {
      timestamp: entry.timestamp,
      level: LogLevel[entry.level],
      message: entry.message,
      context: this.sanitizeContext(entry.context),
      error: entry.error,
      tags: entry.tags,
      source: entry.source,
      environment: process.env.NODE_ENV,
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    };
  }

  formatForStorage(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      context: this.sanitizeContext(entry.context),
      error: entry.error,
      tags: entry.tags,
      source: entry.source,
    });
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };
    
    // Remove sensitive fields
    this.config.sensitiveFields.forEach(field => {
      if (field in sanitized) {
        delete (sanitized as any)[field];
      }
    });
    
    // Sanitize nested metadata recursively
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeObject(sanitized.metadata);
    }
    
    return sanitized;
  }

  /**
   * Recursively sanitize an object by removing sensitive fields
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...obj };
    
    this.config.sensitiveFields.forEach(field => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });
    
    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      }
    });
    
    return sanitized;
  }
}

/**
 * Structured logger implementation
 */
export class StructuredLogger {
  private static instance: StructuredLogger;
  private config: LoggerConfig;
  private formatter: LogFormatter;
  private logBuffer: LogEntry[] = [];
  private batchTimer?: NodeJS.Timeout;
  private baseContext: LogContext = {};

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggerConfig>): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger(config);
    }
    return StructuredLogger.instance;
  }

  /**
   * Private constructor
   */
  private constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.formatter = new DefaultLogFormatter(this.config);
    this.initializeBaseContext();
    this.setupBatchLogging();
  }

  /**
   * Initialize base context with environment information
   */
  private initializeBaseContext(): void {
    this.baseContext = {
      sessionId: this.generateSessionId(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * Set up batch logging for remote endpoints
   */
  private setupBatchLogging(): void {
    if (!this.config.enableRemoteLogging) {
      return;
    }

    this.batchTimer = setInterval(() => {
      this.flushBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.formatter = new DefaultLogFormatter(this.config);
  }

  /**
   * Set base context for all log entries
   */
  setBaseContext(context: Partial<LogContext>): void {
    this.baseContext = { ...this.baseContext, ...context };
  }

  /**
   * Create child logger with additional context
   */
  createChild(context: Partial<LogContext>): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Log at TRACE level
   */
  trace(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.log(LogLevel.TRACE, message, context, tags);
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.log(LogLevel.DEBUG, message, context, tags);
  }

  /**
   * Log at INFO level
   */
  info(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.log(LogLevel.INFO, message, context, tags);
  }

  /**
   * Log at WARN level
   */
  warn(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.log(LogLevel.WARN, message, context, tags);
  }

  /**
   * Log at ERROR level
   */
  error(message: string, error?: Error, context?: Partial<LogContext>, tags?: string[]): void {
    const errorContext = error ? this.serializeError(error) : undefined;
    this.log(LogLevel.ERROR, message, context, tags, errorContext);
  }

  /**
   * Log at FATAL level
   */
  fatal(message: string, error?: Error, context?: Partial<LogContext>, tags?: string[]): void {
    const errorContext = error ? this.serializeError(error) : undefined;
    this.log(LogLevel.FATAL, message, context, tags, errorContext);
  }

  /**
   * Log performance metrics
   */
  performance(message: string, duration: number, context?: Partial<LogContext>): void {
    const perfContext = {
      ...context,
      performance: {
        duration,
        memoryUsage: this.getMemoryUsage(),
        ...context?.performance,
      },
    };
    
    this.log(LogLevel.INFO, message, perfContext, ['performance']);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Partial<LogContext>,
    tags?: string[],
    error?: LogEntry['error']
  ): void {
    // Check if level is enabled
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context: {
        ...this.baseContext,
        ...context,
        timestamp: Date.now(),
      },
      error,
      tags,
      source: 'frontend',
    };

    // Output to console if enabled
    if (this.config.enableConsoleOutput) {
      this.outputToConsole(entry);
    }

    // Add to batch for remote logging
    if (this.config.enableRemoteLogging) {
      this.addToBatch(entry);
    }

    // Store locally if enabled
    if (this.config.enableLocalStorage) {
      this.storeLocally(entry);
    }
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const formatted = this.formatter.formatForConsole(entry);
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  /**
   * Add log entry to batch for remote sending
   */
  private addToBatch(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    if (this.logBuffer.length >= this.config.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * Flush log batch to remote endpoint
   */
  private async flushBatch(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.config.remoteEndpoint) {
      return;
    }

    const batch = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const payload = batch.map(entry => this.formatter.formatForRemote(entry));
      
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: payload }),
      });
    } catch (error) {
      // Failed to send logs - add them back to buffer
      this.logBuffer.unshift(...batch);
      
      if (this.config.enableConsoleOutput) {
        console.warn('Failed to send logs to remote endpoint:', error);
      }
    }
  }

  /**
   * Store log entry locally
   */
  private storeLocally(entry: LogEntry): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const key = 'structured_logs';
      const existing = localStorage.getItem(key);
      const logs = existing ? JSON.parse(existing) : [];
      
      logs.push(this.formatter.formatForStorage(entry));
      
      // Maintain size limit
      if (logs.length > this.config.maxLocalStorageEntries) {
        logs.splice(0, logs.length - this.config.maxLocalStorageEntries);
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (error) {
      // Ignore storage errors
    }
  }

  /**
   * Serialize error object
   */
  private serializeError(error: Error): LogEntry['error'] {
    return {
      name: error.name,
      message: error.message,
      stack: this.config.enableStackTrace ? error.stack : undefined,
      code: (error as any).code,
      statusCode: (error as any).statusCode,
    };
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): number | undefined {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get stored logs from localStorage
   */
  getStoredLogs(): LogEntry[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem('structured_logs');
      if (stored) {
        const logs = JSON.parse(stored);
        return logs.map((log: string) => JSON.parse(log));
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return [];
  }

  /**
   * Clear stored logs
   */
  clearStoredLogs(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('structured_logs');
    }
  }

  /**
   * Flush any pending logs
   */
  async flush(): Promise<void> {
    await this.flushBatch();
  }

  /**
   * Shutdown logger
   */
  shutdown(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    // Flush any remaining logs
    this.flushBatch();
  }
}

/**
 * Child logger with additional context
 */
export class ChildLogger {
  constructor(
    private parent: StructuredLogger,
    private childContext: Partial<LogContext>
  ) {}

  private mergeContext(context?: Partial<LogContext>): Partial<LogContext> {
    return { ...this.childContext, ...context };
  }

  trace(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.parent.trace(message, this.mergeContext(context), tags);
  }

  debug(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.parent.debug(message, this.mergeContext(context), tags);
  }

  info(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.parent.info(message, this.mergeContext(context), tags);
  }

  warn(message: string, context?: Partial<LogContext>, tags?: string[]): void {
    this.parent.warn(message, this.mergeContext(context), tags);
  }

  error(message: string, error?: Error, context?: Partial<LogContext>, tags?: string[]): void {
    this.parent.error(message, error, this.mergeContext(context), tags);
  }

  fatal(message: string, error?: Error, context?: Partial<LogContext>, tags?: string[]): void {
    this.parent.fatal(message, error, this.mergeContext(context), tags);
  }

  performance(message: string, duration: number, context?: Partial<LogContext>): void {
    this.parent.performance(message, duration, this.mergeContext(context));
  }

  createChild(context: Partial<LogContext>): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = StructuredLogger.getInstance();

// Export convenience functions for permission system
export const permissionLogger = logger.createChild({
  feature: 'permissions',
  source: 'permission-system',
});

export const cacheLogger = logger.createChild({
  feature: 'cache',
  source: 'cache',
});

export const authLogger = logger.createChild({
  feature: 'auth',
  source: 'auth',
});

export const navigationLogger = logger.createChild({
  feature: 'navigation',
  source: 'navigation',
});

// LogLevel is already exported at the top of the file
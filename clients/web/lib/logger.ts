/**
 * Frontend logger utility with proper log levels
 * Respects NODE_ENV and provides sanitized logging
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  sanitized?: boolean;
}

/**
 * Sensitive data patterns to sanitize from logs
 */
const SENSITIVE_PATTERNS = [
  /auth0\|[a-zA-Z0-9]+/g, // Auth0 user IDs
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email addresses
  /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, // JWT tokens
  /password.*?[:=]\s*["']?[^"'\s,}]+/gi, // Password fields
  /token.*?[:=]\s*["']?[^"'\s,}]+/gi, // Token fields
  /secret.*?[:=]\s*["']?[^"'\s,}]+/gi, // Secret fields
];

/**
 * Sanitize sensitive data from log messages and objects
 */
function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    let sanitized = data;
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize sensitive keys
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('auth0') ||
          lowerKey.includes('email') ||
          lowerKey.includes('sub')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Logger class with environment-aware log levels
 */
class Logger {
  private isDevelopment: boolean;
  private logLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logLevel = this.isDevelopment ? 'debug' : 'warn';
  }

  /**
   * Get numeric priority for log level
   */
  private getLogLevelPriority(level: LogLevel): number {
    const priorities = { error: 0, warn: 1, info: 2, debug: 3 };
    return priorities[level];
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return this.getLogLevelPriority(level) <= this.getLogLevelPriority(this.logLevel);
  }

  /**
   * Create log entry with sanitization
   */
  private createLogEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
    const sanitizedMessage = sanitizeData(message) as string;
    const sanitizedData = data ? sanitizeData(data) as Record<string, unknown> : undefined;
    
    return {
      level,
      message: sanitizedMessage,
      data: sanitizedData,
      timestamp: new Date().toISOString(),
      sanitized: true,
    };
  }

  /**
   * Log error messages (always shown)
   */
  error(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    
    const entry = this.createLogEntry('error', message, data);
    console.error(`[${entry.timestamp}] ERROR: ${entry.message}`, entry.data || '');
  }

  /**
   * Log warning messages (shown in development and production)
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    
    const entry = this.createLogEntry('warn', message, data);
    console.warn(`[${entry.timestamp}] WARN: ${entry.message}`, entry.data || '');
  }

  /**
   * Log info messages (shown only in development)
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    
    const entry = this.createLogEntry('info', message, data);
    console.info(`[${entry.timestamp}] INFO: ${entry.message}`, entry.data || '');
  }

  /**
   * Log debug messages (shown only in development)
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    
    const entry = this.createLogEntry('debug', message, data);
    console.debug(`[${entry.timestamp}] DEBUG: ${entry.message}`, entry.data || '');
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, data?: Record<string, unknown>): void {
    const level: LogLevel = duration > 1000 ? 'warn' : 'info';
    this[level](`Performance: ${operation} took ${duration}ms`, data);
  }

  /**
   * Set log level programmatically
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Check if running in development mode
   */
  isDev(): boolean {
    return this.isDevelopment;
  }
}

// Create singleton logger instance
const logger = new Logger();

export default logger;
export { Logger, type LogLevel, type LogEntry };

// Convenience exports for common usage
export const { error, warn, info, debug, performance } = logger;
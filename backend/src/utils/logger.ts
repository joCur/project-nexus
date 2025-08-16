import winston from 'winston';
import { logging } from '@/config/environment';

/**
 * Centralized logging service with structured JSON logging
 * Includes security-focused logging for authentication events
 */

// Define log levels with numeric priorities
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Custom log format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Development format for console output
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: logging.level,
  format: logging.format === 'json' ? logFormat : devFormat,
  defaultMeta: {
    service: 'project-nexus-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Error log file (only errors)
    new winston.transports.File({
      filename: logging.files.error,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // Combined log file (all levels)
    new winston.transports.File({
      filename: logging.files.combined,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true,
    }),
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (logging.console || process.env.NODE_ENV === 'development') {
  logger.add(new winston.transports.Console({
    format: devFormat,
  }));
}

/**
 * Security-focused logging methods for authentication events
 */
export const securityLogger = {
  /**
   * Log successful authentication
   */
  authSuccess: (userId: string, auth0UserId: string, metadata?: Record<string, unknown>) => {
    logger.info('Authentication successful', {
      event: 'auth_success',
      userId,
      auth0UserId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Log failed authentication attempts
   */
  authFailure: (reason: string, metadata?: Record<string, unknown>) => {
    logger.warn('Authentication failed', {
      event: 'auth_failure',
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Log authorization failures
   */
  authorizationFailure: (userId: string, resource: string, action: string, metadata?: Record<string, unknown>) => {
    logger.warn('Authorization failed', {
      event: 'authorization_failure',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Log suspicious activities
   */
  suspiciousActivity: (activity: string, metadata?: Record<string, unknown>) => {
    logger.error('Suspicious activity detected', {
      event: 'suspicious_activity',
      activity,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Log user session events
   */
  sessionEvent: (event: 'created' | 'refreshed' | 'expired' | 'destroyed', userId: string, metadata?: Record<string, unknown>) => {
    logger.info('Session event', {
      event: 'session_event',
      sessionEvent: event,
      userId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },
};

/**
 * Performance logging for monitoring
 */
export const performanceLogger = {
  /**
   * Log database query performance
   */
  dbQuery: (query: string, duration: number, metadata?: Record<string, unknown>) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    logger.log(level, 'Database query executed', {
      event: 'db_query',
      query: query.substring(0, 100), // Truncate long queries
      duration,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Log API request performance
   */
  apiRequest: (method: string, path: string, duration: number, statusCode: number, metadata?: Record<string, unknown>) => {
    const level = statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, 'API request processed', {
      event: 'api_request',
      method,
      path,
      duration,
      statusCode,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Log external service calls
   */
  externalService: (service: string, operation: string, duration: number, success: boolean, metadata?: Record<string, unknown>) => {
    const level = success ? 'info' : 'warn';
    logger.log(level, 'External service call', {
      event: 'external_service',
      service,
      operation,
      duration,
      success,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },
};

/**
 * Create a child logger with additional context
 */
export const createContextLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

export default logger;
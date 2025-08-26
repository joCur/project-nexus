import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  isOperationalError, 
  sanitizeError 
} from '@/utils/errors';
import logger, { securityLogger } from '@/utils/logger';
import { env } from '@/config/environment';

/**
 * Error handling middleware for Express and GraphQL
 * Provides structured error responses and security logging
 */

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  details?: any;
  stack?: string;
}

/**
 * Express error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log error with context
  const errorContext = {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };

  if (isOperationalError(error)) {
    // Operational errors are expected and logged as warnings
    logger.warn('Operational error occurred', errorContext);
    
    // Log security-related errors
    if (error.statusCode === 401 || error.statusCode === 403) {
      securityLogger.authFailure(error.message, {
        statusCode: error.statusCode,
        ...errorContext,
      });
    }
  } else {
    // Programming errors are logged as errors
    logger.error('Unexpected error occurred', errorContext);
    
    // Log as suspicious activity for unexpected errors
    securityLogger.suspiciousActivity('Unexpected server error', {
      error: error.message,
      ...errorContext,
    });
  }

  // Sanitize error for client response
  const sanitized = sanitizeError(error, env.NODE_ENV === 'development');
  
  const errorResponse: ErrorResponse = {
    error: sanitized.code,
    message: sanitized.message,
    statusCode: sanitized.statusCode,
    timestamp: sanitized.timestamp,
    requestId,
    ...(env.NODE_ENV === 'development' && { 
      details: sanitized,
      stack: sanitized.stack 
    }),
  };

  res.status(sanitized.statusCode).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    'ROUTE_NOT_FOUND'
  );

  // Log suspicious 404s
  securityLogger.suspiciousActivity('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  next(error);
};

/**
 * GraphQL error formatter
 */
export const formatGraphQLError = (error: any) => {
  // Extract the original error if it exists
  const originalError = error.originalError || error;

  // Generate error ID for tracking
  const errorId = `gql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log GraphQL errors
  const errorContext = {
    errorId,
    operation: error.source?.body,
    variables: error.variableValues,
    path: error.path,
    locations: error.locations,
    originalError: {
      name: originalError.name,
      message: originalError.message,
      stack: originalError.stack,
    },
  };

  if (isOperationalError(originalError)) {
    logger.warn('GraphQL operational error', errorContext);
  } else {
    logger.error('GraphQL unexpected error', errorContext);
  }

  // Return formatted error
  const sanitized = sanitizeError(originalError, env.NODE_ENV === 'development');

  return {
    message: sanitized.message,
    code: sanitized.code,
    timestamp: sanitized.timestamp,
    errorId,
    locations: error.locations,
    path: error.path,
    ...(env.NODE_ENV === 'development' && {
      stack: sanitized.stack,
      originalError: originalError.message,
    }),
  };
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const validationErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error.name === 'ValidationError') {
    const validationError = new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR'
    );

    // Add validation details
    (validationError as any).details = error.details || error.errors;

    return next(validationError);
  }

  next(error);
};

/**
 * Database error handler
 */
export const databaseErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  // Handle specific database errors
  if (error.code) {
    switch (error.code) {
      case '23505': { // Unique constraint violation
        const uniqueError = new AppError(
          'Resource already exists',
          409,
          'DUPLICATE_RESOURCE'
        );
        return next(uniqueError);
      }
        
      case '23503': { // Foreign key constraint violation
        const foreignKeyError = new AppError(
          'Referenced resource not found',
          400,
          'INVALID_REFERENCE'
        );
        return next(foreignKeyError);
      }
        
      case '23502': { // Not null constraint violation
        const notNullError = new AppError(
          'Required field missing',
          400,
          'MISSING_REQUIRED_FIELD'
        );
        return next(notNullError);
      }
        
      default: {
        // Generic database error
        const dbError = new AppError(
          'Database operation failed',
          500,
          'DATABASE_ERROR'
        );
        return next(dbError);
      }
    }
  }

  next(error);
};

/**
 * Rate limit error handler
 */
export const rateLimitErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error.name === 'RateLimitError') {
    // Rate limit errors are already properly formatted
    return next(error);
  }

  next(error);
};

/**
 * JWT error handler
 */
export const jwtErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    const jwtError = new AppError(
      'Invalid or expired token',
      401,
      'INVALID_TOKEN'
    );
    return next(jwtError);
  }

  next(error);
};

/**
 * Process unhandled promise rejections
 */
export const setupProcessErrorHandlers = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });
    
    // In production, we might want to exit the process
    if (env.NODE_ENV === 'production') {
      logger.error('Shutting down due to unhandled promise rejection');
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });
    
    // Always exit on uncaught exceptions
    logger.error('Shutting down due to uncaught exception');
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};

/**
 * Apply all error handlers in correct order
 */
export function applyErrorHandlers(app: any) {
  // Specific error handlers (first)
  app.use(validationErrorHandler);
  app.use(databaseErrorHandler);
  app.use(rateLimitErrorHandler);
  app.use(jwtErrorHandler);
  
  // 404 handler
  app.use(notFoundHandler);
  
  // General error handler (last)
  app.use(errorHandler);
}
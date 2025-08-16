/**
 * Custom error classes for Project Nexus backend
 * Provides structured error handling with proper status codes and messages
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'UNAUTHENTICATED') {
    super(message, 401, code);
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = 'Invalid or expired token') {
    super(message, 'INVALID_TOKEN');
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class EmailNotVerifiedError extends AuthenticationError {
  constructor(message: string = 'Email address must be verified') {
    super(message, 'EMAIL_NOT_VERIFIED');
  }
}

/**
 * Authorization-related errors
 */
export class AuthorizationError extends AppError {
  public readonly requiredPermission?: string;
  public readonly userPermissions?: string[];

  constructor(
    message: string = 'Insufficient permissions',
    code: string = 'FORBIDDEN',
    requiredPermission?: string,
    userPermissions?: string[]
  ) {
    super(message, 403, code);
    this.requiredPermission = requiredPermission;
    this.userPermissions = userPermissions;
  }
}

export class WorkspaceAccessDeniedError extends AuthorizationError {
  constructor(workspaceId: string) {
    super(
      `Access denied to workspace: ${workspaceId}`,
      'WORKSPACE_ACCESS_DENIED'
    );
  }
}

/**
 * Validation-related errors
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

export class InvalidInputError extends ValidationError {
  constructor(field: string, value: unknown, constraint: string) {
    super(`Invalid value for ${field}: ${constraint}`, field, value);
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends AppError {
  public readonly constraint?: string;
  public readonly table?: string;
  public readonly column?: string;

  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    constraint?: string,
    table?: string,
    column?: string
  ) {
    super(message, 500, code);
    this.constraint = constraint;
    this.table = table;
    this.column = column;
  }
}

export class UniqueConstraintError extends DatabaseError {
  constructor(field: string, value: unknown) {
    super(
      `Value '${String(value)}' already exists for field '${field}'`,
      'UNIQUE_CONSTRAINT_VIOLATION',
      'unique',
      undefined,
      field
    );
    (this as any).statusCode = 409; // Conflict
  }
}

export class ForeignKeyConstraintError extends DatabaseError {
  constructor(field: string, value: unknown) {
    super(
      `Referenced record not found for field '${field}' with value '${String(value)}'`,
      'FOREIGN_KEY_CONSTRAINT_VIOLATION',
      'foreign_key',
      undefined,
      field
    );
    (this as any).statusCode = 400; // Bad Request
  }
}

/**
 * Resource-related errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly operation: string;

  constructor(
    service: string,
    operation: string,
    message: string,
    statusCode: number = 502
  ) {
    super(`${service} service error: ${message}`, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
    this.operation = operation;
  }
}

export class Auth0ServiceError extends ExternalServiceError {
  constructor(operation: string, message: string, statusCode: number = 502) {
    super('Auth0', operation, message, statusCode);
  }
}

export class OpenAIServiceError extends ExternalServiceError {
  constructor(operation: string, message: string, statusCode: number = 502) {
    super('OpenAI', operation, message, statusCode);
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly retryAfter: number;

  constructor(limit: number, windowMs: number, retryAfter: number) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms. Try again in ${retryAfter}ms`,
      429,
      'RATE_LIMIT_EXCEEDED'
    );
    this.limit = limit;
    this.windowMs = windowMs;
    this.retryAfter = retryAfter;
  }
}

/**
 * Error factory functions for common scenarios
 */
export const ErrorFactory = {
  /**
   * Create an authentication error based on JWT validation failure
   */
  fromJWTError: (error: Error): AuthenticationError => {
    if (error.name === 'TokenExpiredError') {
      return new TokenExpiredError();
    }
    if (error.name === 'JsonWebTokenError') {
      return new InvalidTokenError('Invalid token format');
    }
    if (error.name === 'NotBeforeError') {
      return new InvalidTokenError('Token not active yet');
    }
    return new AuthenticationError('Token validation failed');
  },

  /**
   * Create a database error based on PostgreSQL error
   */
  fromDatabaseError: (error: any): DatabaseError => {
    if (error.code === '23505') { // Unique constraint violation
      const match = error.detail?.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
      if (match) {
        return new UniqueConstraintError(match[1], match[2]);
      }
      return new UniqueConstraintError('unknown', 'unknown');
    }
    
    if (error.code === '23503') { // Foreign key constraint violation
      const match = error.detail?.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
      if (match) {
        return new ForeignKeyConstraintError(match[1], match[2]);
      }
      return new ForeignKeyConstraintError('unknown', 'unknown');
    }
    
    return new DatabaseError(error.message || 'Database operation failed');
  },

  /**
   * Create a validation error from Zod error
   */
  fromZodError: (error: any): ValidationError => {
    if (error.errors && error.errors.length > 0) {
      const firstError = error.errors[0];
      return new ValidationError(
        `${firstError.path.join('.')}: ${firstError.message}`,
        firstError.path.join('.'),
        firstError.received
      );
    }
    return new ValidationError('Validation failed');
  },
};

/**
 * Type guard to check if error is operational
 */
export const isOperationalError = (error: Error): error is AppError => {
  return error instanceof AppError && error.isOperational;
};

/**
 * Sanitize error for client response (remove sensitive information)
 */
export const sanitizeError = (error: Error, includeStack: boolean = false) => {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: error.timestamp,
      ...(includeStack && { stack: error.stack }),
      ...(error instanceof AuthorizationError && {
        requiredPermission: error.requiredPermission,
      }),
      ...(error instanceof ValidationError && {
        field: error.field,
      }),
      ...(error instanceof RateLimitError && {
        retryAfter: error.retryAfter,
      }),
    };
  }

  // For unknown errors, provide minimal information
  return {
    message: includeStack ? error.message : 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    timestamp: new Date().toISOString(),
    ...(includeStack && { stack: error.stack }),
  };
};
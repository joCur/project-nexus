/**
 * Custom error types for API endpoints
 *
 * This provides a type-safe way to handle different error scenarios
 * without relying on fragile string matching.
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BACKEND_ERROR = 'BACKEND_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export enum ErrorCode {
  // Authentication errors
  NO_SESSION = 'NO_SESSION',
  AUTH_TOKEN_FAILED = 'AUTH_TOKEN_FAILED',
  BACKEND_AUTH_ERROR = 'BACKEND_AUTH_ERROR',

  // Network errors
  BACKEND_UNREACHABLE = 'BACKEND_UNREACHABLE',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',

  // Backend errors
  BACKEND_ERROR = 'BACKEND_ERROR',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Internal errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  AUTH0_TOKEN_ERROR = 'AUTH0_TOKEN_ERROR',
}

export class ApiError extends Error {
  public readonly type: ErrorType;
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly retryAfter?: number;
  public readonly requestId?: string;
  public readonly cause?: Error;

  constructor(
    type: ErrorType,
    code: ErrorCode,
    message: string,
    statusCode: number,
    options?: {
      cause?: Error;
      retryAfter?: number;
      requestId?: string;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.retryAfter = options?.retryAfter;
    this.requestId = options?.requestId;
    this.cause = options?.cause;
  }

  toJSON() {
    const result: any = {
      error: this.message,
      code: this.code,
      ...(this.retryAfter && { retryAfter: this.retryAfter }),
      ...(this.requestId && { requestId: this.requestId }),
    };

    // Only include original error message for specific safe error types
    // and only if it looks like a safe message (GraphQL errors, etc.)
    if (this.cause instanceof Error &&
        this.cause.message !== this.message &&
        this.shouldExposeOriginalMessage()) {
      result.message = this.cause.message;
    }

    return result;
  }

  private shouldExposeOriginalMessage(): boolean {
    if (!this.cause || !(this.cause instanceof Error)) {
      return false;
    }

    // Only expose GraphQL error messages and other safe error messages
    return (
      this.cause.message.includes('GraphQL') ||
      this.cause.message.includes('Invalid response format') ||
      this.code === ErrorCode.BACKEND_AUTH_ERROR
    );
  }
}

export class NetworkError extends ApiError {
  constructor(message: string, options?: { cause?: Error; requestId?: string }) {
    super(
      ErrorType.NETWORK_ERROR,
      ErrorCode.BACKEND_UNREACHABLE,
      message,
      503,
      { ...options, retryAfter: 30 }
    );
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string, options?: { cause?: Error; requestId?: string }) {
    super(
      ErrorType.TIMEOUT_ERROR,
      ErrorCode.REQUEST_TIMEOUT,
      message,
      408,
      { ...options, retryAfter: 10 }
    );
  }
}

export class AuthenticationError extends ApiError {
  constructor(
    code: ErrorCode.NO_SESSION | ErrorCode.AUTH_TOKEN_FAILED | ErrorCode.BACKEND_AUTH_ERROR,
    message: string,
    options?: { cause?: Error; requestId?: string }
  ) {
    super(ErrorType.AUTH_ERROR, code, message, 401, options);
  }
}

export class BackendError extends ApiError {
  constructor(
    code: ErrorCode.BACKEND_ERROR | ErrorCode.USER_NOT_FOUND,
    message: string,
    statusCode: number,
    options?: { cause?: Error; requestId?: string; retryAfter?: number }
  ) {
    super(ErrorType.BACKEND_ERROR, code, message, statusCode, options);
  }
}

export class Auth0TokenError extends ApiError {
  constructor(message: string, options?: { cause?: Error; requestId?: string }) {
    super(
      ErrorType.INTERNAL_ERROR,
      ErrorCode.AUTH0_TOKEN_ERROR,
      message,
      500,
      options
    );
  }
}

/**
 * Utility functions to identify error types
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.type === ErrorType.NETWORK_ERROR;
  }

  if (error instanceof Error) {
    // Check for common network error patterns
    return (
      error.message.includes('fetch failed') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('network error') ||
      (error as any).code === 'ECONNREFUSED' ||
      (error as any).code === 'ENOTFOUND'
    );
  }

  return false;
}

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.type === ErrorType.TIMEOUT_ERROR;
  }

  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.includes('timeout');
  }

  return false;
}

// Remove Auth0-specific error detection - handle at source instead

/**
 * Convert generic errors to typed API errors
 */
export function classifyError(error: unknown, requestId?: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (isTimeoutError(error)) {
    return new TimeoutError(
      'Request timeout - backend service is slow to respond',
      { cause: error instanceof Error ? error : undefined, requestId }
    );
  }

  if (isNetworkError(error)) {
    return new NetworkError(
      'Cannot connect to backend service',
      { cause: error instanceof Error ? error : undefined, requestId }
    );
  }

  // Default to internal error
  return new ApiError(
    ErrorType.INTERNAL_ERROR,
    ErrorCode.INTERNAL_ERROR,
    'Internal server error occurred while fetching onboarding status',
    500,
    {
      cause: error instanceof Error ? error : undefined,
      requestId
    }
  );
}
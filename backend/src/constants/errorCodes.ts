/**
 * Centralized error codes for consistent error handling and debugging
 * 
 * These constants provide structured error identification while maintaining
 * generic user-facing messages for security purposes.
 */

export const ERROR_CODES = {
  // Authentication Errors
  AUTH: {
    UNAUTHENTICATED: 'AUTH_UNAUTHENTICATED',
    INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
    TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  },

  // Authorization Errors
  AUTHORIZATION: {
    INSUFFICIENT_PERMISSIONS: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
    INVALID_WORKSPACE_ID: 'AUTHZ_INVALID_WORKSPACE_ID',
    INVALID_PERMISSION: 'AUTHZ_INVALID_PERMISSION',
    INVALID_USER_ID: 'AUTHZ_INVALID_USER_ID',
    WORKSPACE_ACCESS_DENIED: 'AUTHZ_WORKSPACE_ACCESS_DENIED',
    USER_DATA_ACCESS_DENIED: 'AUTHZ_USER_DATA_ACCESS_DENIED',
    GLOBAL_PERMISSION_DENIED: 'AUTHZ_GLOBAL_PERMISSION_DENIED',
  },

  // Validation Errors
  VALIDATION: {
    INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
    REQUIRED_FIELD_MISSING: 'VALIDATION_REQUIRED_FIELD_MISSING',
    INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
    INVALID_LENGTH: 'VALIDATION_INVALID_LENGTH',
  },

  // Resource Errors
  RESOURCE: {
    NOT_FOUND: 'RESOURCE_NOT_FOUND',
    ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
    CONFLICT: 'RESOURCE_CONFLICT',
  },

  // System Errors
  SYSTEM: {
    DATABASE_ERROR: 'SYSTEM_DATABASE_ERROR',
    CACHE_ERROR: 'SYSTEM_CACHE_ERROR',
    SERVICE_UNAVAILABLE: 'SYSTEM_SERVICE_UNAVAILABLE',
    INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR',
  },

  // Workspace-specific Errors
  WORKSPACE: {
    INVALID_ID: 'WORKSPACE_INVALID_ID',
    ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
    NOT_FOUND: 'WORKSPACE_NOT_FOUND',
    INSUFFICIENT_ROLE: 'WORKSPACE_INSUFFICIENT_ROLE',
    MEMBER_NOT_FOUND: 'WORKSPACE_MEMBER_NOT_FOUND',
  },

  // User-specific Errors
  USER: {
    NOT_FOUND: 'USER_NOT_FOUND',
    INVALID_ID: 'USER_INVALID_ID',
    ACCESS_DENIED: 'USER_ACCESS_DENIED',
    SYNC_FAILED: 'USER_SYNC_FAILED',
  },
} as const;

/**
 * Generic user-facing messages for security purposes
 * These messages are intentionally vague to prevent information disclosure
 */
export const GENERIC_ERROR_MESSAGES = {
  // Authentication
  AUTHENTICATION_REQUIRED: 'Authentication required',
  INVALID_CREDENTIALS: 'Invalid credentials',

  // Authorization  
  ACCESS_DENIED: 'Access denied',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  WORKSPACE_ACCESS_DENIED: 'Insufficient permissions for workspace access',

  // Validation
  INVALID_REQUEST: 'Invalid request parameters',
  REQUIRED_FIELDS_MISSING: 'Required fields are missing',

  // Resources
  RESOURCE_NOT_FOUND: 'Resource not found',
  RESOURCE_UNAVAILABLE: 'Resource temporarily unavailable',

  // System
  SERVICE_ERROR: 'Service temporarily unavailable',
  INTERNAL_ERROR: 'Internal server error',
} as const;

/**
 * Development-specific error messages (only used in development mode)
 * These provide detailed information for debugging purposes
 */
export const DEBUG_ERROR_MESSAGES = {
  AUTHORIZATION: {
    MISSING_PERMISSION: (permission: string, workspace?: string) => 
      workspace 
        ? `Missing permission '${permission}' in workspace '${workspace}'`
        : `Missing global permission '${permission}'`,
    INVALID_WORKSPACE_ID: (workspaceId: string) => 
      `Invalid workspace ID format: '${workspaceId}'`,
    INVALID_PERMISSION: (permission: string) => 
      `Invalid permission format: '${permission}'`,
    USER_NOT_MEMBER: (userId: string, workspaceId: string) => 
      `User '${userId}' is not a member of workspace '${workspaceId}'`,
  },

  VALIDATION: {
    FIELD_REQUIRED: (field: string) => `Field '${field}' is required`,
    INVALID_FORMAT: (field: string, expected: string) => 
      `Field '${field}' has invalid format, expected: ${expected}`,
    INVALID_LENGTH: (field: string, min: number, max: number) => 
      `Field '${field}' length must be between ${min} and ${max} characters`,
  },
} as const;

/**
 * Check if we're in development mode for detailed error messages
 */
export const isDevelopmentMode = (): boolean => {
  return process.env.NODE_ENV === 'development' || process.env.DEBUG_ERRORS === 'true';
};

/**
 * Get appropriate error message based on environment
 */
export const getErrorMessage = (
  genericMessage: string, 
  debugMessage?: string
): string => {
  return isDevelopmentMode() && debugMessage ? debugMessage : genericMessage;
};

/**
 * Create structured error information for logging
 */
export const createErrorInfo = (
  code: string,
  context?: Record<string, any>
): { code: string; context?: Record<string, any>; timestamp: string } => {
  return {
    code,
    context,
    timestamp: new Date().toISOString(),
  };
};
/**
 * Error Mapping Utilities
 *
 * Maps backend GraphQL/validation errors to user-friendly frontend messages.
 * Provides consistent error handling across the application.
 */

import { createContextLogger } from './logger';

const logger = createContextLogger({ module: 'ErrorMapping' });

/**
 * Error type from backend GraphQL responses
 */
export interface GraphQLError {
  message: string;
  extensions?: {
    code?: string;
    field?: string;
    [key: string]: any;
  };
}

/**
 * Mapped frontend error with user-friendly message
 */
export interface MappedError {
  /** User-friendly error message */
  message: string;
  /** Suggested action for the user */
  suggestion?: string;
  /** Error category for handling */
  category: 'validation' | 'network' | 'auth' | 'unknown';
  /** Original backend error code */
  code?: string;
  /** Affected field (if applicable) */
  field?: string;
}

/**
 * Tiptap validation error patterns and their user-friendly messages
 */
const TIPTAP_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  getMessage: (match: RegExpMatchArray) => MappedError;
}> = [
  // Character limit exceeded (with or without details)
  {
    pattern: /Content exceeds maximum character limit/i,
    getMessage: (match) => {
      // Extract numbers if present
      const fullMatch = match[0];
      const numberMatch = fullMatch.match(/of ([\d,]+) characters/i);
      const maxChars = numberMatch ? numberMatch[1] : '100,000';

      return {
        message: 'Content too long',
        suggestion: `Maximum ${maxChars} characters allowed. Please shorten your content.`,
        category: 'validation',
        code: 'CHAR_LIMIT_EXCEEDED',
      };
    },
  },
  // Node count exceeded
  {
    pattern: /Node count exceeds maximum allowed limit of ([\d,]+) nodes \(current: ([\d,]+)\)/i,
    getMessage: (match) => ({
      message: 'Content too complex',
      suggestion: `Maximum ${match[1]} elements allowed. Please simplify your content.`,
      category: 'validation',
      code: 'NODE_COUNT_EXCEEDED',
    }),
  },
  // Nesting depth exceeded
  {
    pattern: /JSON nesting depth exceeds maximum allowed \((\d+)\)/i,
    getMessage: (match) => ({
      message: 'Content too deeply nested',
      suggestion: `Maximum ${match[1]} levels allowed. Please reduce nesting depth.`,
      category: 'validation',
      code: 'NESTING_DEPTH_EXCEEDED',
    }),
  },
  // Dangerous protocol in link
  {
    pattern: /Dangerous protocol detected in link: (\w+):/i,
    getMessage: () => ({
      message: 'Invalid link',
      suggestion: 'Dangerous URLs are not allowed. Please use safe protocols (http, https, mailto).',
      category: 'validation',
      code: 'DANGEROUS_LINK',
    }),
  },
  // Invalid protocol in link
  {
    pattern: /Invalid protocol in link/i,
    getMessage: () => ({
      message: 'Invalid link',
      suggestion: 'Please use valid URL protocols (http, https, mailto).',
      category: 'validation',
      code: 'INVALID_PROTOCOL',
    }),
  },
  // Invalid node type
  {
    pattern: /Invalid node type: (\w+)/i,
    getMessage: (match) => ({
      message: 'Invalid content structure',
      suggestion: `The content type "${match[1]}" is not supported. Please check your formatting.`,
      category: 'validation',
      code: 'INVALID_NODE_TYPE',
    }),
  },
  // Invalid mark type
  {
    pattern: /Invalid mark type: (\w+)/i,
    getMessage: (match) => ({
      message: 'Invalid formatting',
      suggestion: `The formatting "${match[1]}" is not supported. Please check your text formatting.`,
      category: 'validation',
      code: 'INVALID_MARK_TYPE',
    }),
  },
];

/**
 * Map GraphQL error to user-friendly error
 * @param error - GraphQL error from backend
 * @returns Mapped error with user-friendly message
 */
export function mapGraphQLError(error: GraphQLError | Error | any): MappedError {
  // Handle Error objects
  if (error instanceof Error && !('extensions' in error)) {
    logger.debug('Mapping generic error', { message: error.message });
    return {
      message: 'An error occurred',
      suggestion: 'Please try again. If the problem persists, contact support.',
      category: 'unknown',
    };
  }

  const errorMessage = error.message || 'Unknown error';
  const errorCode = error.extensions?.code;
  const errorField = error.extensions?.field;

  logger.debug('Mapping GraphQL error', {
    message: errorMessage,
    code: errorCode,
    field: errorField,
  });

  // Check for validation errors
  if (errorCode === 'VALIDATION_ERROR') {
    // Try to match Tiptap-specific validation errors
    for (const { pattern, getMessage } of TIPTAP_ERROR_PATTERNS) {
      const match = errorMessage.match(pattern);
      if (match) {
        const mappedError = getMessage(match);
        logger.info('Mapped Tiptap validation error', {
          originalMessage: errorMessage,
          mappedMessage: mappedError.message,
          code: mappedError.code,
        });
        return { ...mappedError, field: errorField };
      }
    }

    // Generic validation error fallback
    logger.warn('Unmapped validation error', { message: errorMessage });
    return {
      message: 'Validation error',
      suggestion: 'Please check your input and try again.',
      category: 'validation',
      code: errorCode,
      field: errorField,
    };
  }

  // Check for authentication errors
  if (errorCode === 'UNAUTHENTICATED' || errorCode === 'INVALID_TOKEN' || errorCode === 'TOKEN_EXPIRED') {
    return {
      message: 'Authentication required',
      suggestion: 'Please sign in again to continue.',
      category: 'auth',
      code: errorCode,
    };
  }

  // Check for authorization errors
  if (errorCode === 'FORBIDDEN' || errorCode === 'WORKSPACE_ACCESS_DENIED') {
    return {
      message: 'Access denied',
      suggestion: 'You do not have permission to perform this action.',
      category: 'auth',
      code: errorCode,
    };
  }

  // Check for network errors
  if (
    errorMessage.includes('Network request failed') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError')
  ) {
    return {
      message: 'Network error',
      suggestion: 'Please check your connection and try again.',
      category: 'network',
    };
  }

  // Generic error fallback
  logger.warn('Unmapped error', {
    message: errorMessage,
    code: errorCode,
  });

  return {
    message: 'An unexpected error occurred',
    suggestion: 'Please try again. If the problem persists, contact support.',
    category: 'unknown',
    code: errorCode,
  };
}

/**
 * Check if error is a validation error
 * @param error - Error to check
 * @returns True if validation error
 */
export function isValidationError(error: any): boolean {
  return (
    error?.extensions?.code === 'VALIDATION_ERROR' ||
    mapGraphQLError(error).category === 'validation'
  );
}

/**
 * Get user-friendly error message from error
 * @param error - Error from backend
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: any): string {
  const mapped = mapGraphQLError(error);
  return mapped.suggestion
    ? `${mapped.message}: ${mapped.suggestion}`
    : mapped.message;
}

/**
 * Format error for display in UI
 * @param error - Error from backend
 * @returns Formatted error object for UI display
 */
export function formatErrorForDisplay(error: any): {
  title: string;
  message: string;
  category: 'validation' | 'network' | 'auth' | 'unknown';
} {
  const mapped = mapGraphQLError(error);

  return {
    title: mapped.message,
    message: mapped.suggestion || 'Please try again.',
    category: mapped.category,
  };
}

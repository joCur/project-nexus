/**
 * Retry Utility with Exponential Backoff
 *
 * Provides retry logic with exponential backoff for async operations.
 * Supports custom retry strategies and error filtering.
 */

import { createContextLogger } from './logger';
import { isValidationError } from './errorMapping';

const logger = createContextLogger({ module: 'RetryWithBackoff' });

/**
 * Options for retry with backoff
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error should trigger retry (default: retry non-validation errors) */
  shouldRetry?: (error: unknown) => boolean;
  /** Callback for retry attempts */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current retry attempt (0-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const {
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2
  } = options;

  const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Default retry strategy: retry all errors except validation errors
 * @param error - Error to check
 * @returns True if should retry
 */
export function defaultShouldRetry(error: unknown): boolean {
  return !isValidationError(error);
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - Async operation to retry
 * @param options - Retry options
 * @returns Promise that resolves with operation result or rejects after max retries
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    shouldRetry = defaultShouldRetry,
    onRetry
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Attempting operation', { attempt, maxRetries });
      return await operation();
    } catch (error) {
      lastError = error;

      logger.warn('Operation failed', {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error)
      });

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        logger.info('Error not retryable - stopping', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      // Check if we have retries left
      if (attempt >= maxRetries) {
        logger.error('Max retries reached - giving up', {
          maxRetries,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt, options);

      logger.info('Retrying operation', {
        attempt: attempt + 1,
        maxRetries,
        delay
      });

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retry wrapper function for an async operation
 *
 * @param operation - Async operation to wrap
 * @param options - Retry options
 * @returns Wrapped function that retries on failure
 *
 * @example
 * ```typescript
 * const fetchWithRetry = createRetryWrapper(
 *   async (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3 }
 * );
 *
 * const data = await fetchWithRetry('/api/data');
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRetryWrapper<TArgs extends any[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retryWithBackoff(() => operation(...args), options);
}

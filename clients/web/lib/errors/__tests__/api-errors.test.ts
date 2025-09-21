/**
 * Tests for the API error classification system
 */

import {
  ApiError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  BackendError,
  Auth0TokenError,
  ErrorType,
  ErrorCode,
  classifyError,
  isNetworkError,
  isTimeoutError,
} from '../api-errors';

describe('API Error Classification System', () => {
  describe('Error Type Detection', () => {
    it('should detect network errors correctly', () => {
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isNetworkError(new Error('ENOTFOUND'))).toBe(true);
      expect(isNetworkError(new Error('network error'))).toBe(true);

      // Should not detect non-network errors
      expect(isNetworkError(new Error('some other error'))).toBe(false);
    });

    it('should detect timeout errors correctly', () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';

      expect(isTimeoutError(abortError)).toBe(true);
      expect(isTimeoutError(new Error('timeout'))).toBe(true);

      expect(isTimeoutError(new Error('some other error'))).toBe(false);
    });

    // Auth0 errors are now handled at the source, no need for string matching
  });

  describe('Error Classification', () => {
    const requestId = 'test-request-id';

    it('should classify network errors as NetworkError', () => {
      const error = new Error('fetch failed');
      const classified = classifyError(error, requestId);

      expect(classified).toBeInstanceOf(NetworkError);
      expect(classified.type).toBe(ErrorType.NETWORK_ERROR);
      expect(classified.code).toBe(ErrorCode.BACKEND_UNREACHABLE);
      expect(classified.statusCode).toBe(503);
      expect(classified.retryAfter).toBe(30);
    });

    it('should classify timeout errors as TimeoutError', () => {
      const error = new Error('Request aborted');
      error.name = 'AbortError';
      const classified = classifyError(error, requestId);

      expect(classified).toBeInstanceOf(TimeoutError);
      expect(classified.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(classified.code).toBe(ErrorCode.REQUEST_TIMEOUT);
      expect(classified.statusCode).toBe(408);
      expect(classified.retryAfter).toBe(10);
    });

    // Auth0 token errors are now handled at the source with explicit ApiError creation

    it('should classify unknown errors as internal errors', () => {
      const error = new Error('Some random error');
      const classified = classifyError(error, requestId);

      expect(classified.type).toBe(ErrorType.INTERNAL_ERROR);
      expect(classified.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(classified.statusCode).toBe(500);
    });

    it('should preserve already classified ApiError instances', () => {
      const originalError = new NetworkError('Network failure', { requestId });
      const classified = classifyError(originalError, requestId);

      expect(classified).toBe(originalError);
    });
  });

  describe('Error JSON Serialization', () => {
    it('should serialize errors to JSON correctly', () => {
      const error = new NetworkError('Cannot connect', { requestId: 'test-123' });
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Cannot connect',
        code: ErrorCode.BACKEND_UNREACHABLE,
        retryAfter: 30,
        requestId: 'test-123',
      });
    });

    it('should include original message for safe error types', () => {
      const cause = new Error('GraphQL query failed: Invalid field');
      const error = new ApiError(
        ErrorType.INTERNAL_ERROR,
        ErrorCode.INTERNAL_ERROR,
        'Internal server error occurred while fetching onboarding status',
        500,
        { cause, requestId: 'test-123' }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Internal server error occurred while fetching onboarding status',
        code: ErrorCode.INTERNAL_ERROR,
        requestId: 'test-123',
        message: 'GraphQL query failed: Invalid field',
      });
    });

    it('should not expose sensitive error messages', () => {
      const cause = new Error('Database password is wrong');
      const error = new ApiError(
        ErrorType.INTERNAL_ERROR,
        ErrorCode.INTERNAL_ERROR,
        'Internal server error occurred while fetching onboarding status',
        500,
        { cause, requestId: 'test-123' }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Internal server error occurred while fetching onboarding status',
        code: ErrorCode.INTERNAL_ERROR,
        requestId: 'test-123',
        // No 'message' field should be present for sensitive errors
      });
      expect(json.message).toBeUndefined();
    });
  });

  describe('Specific Error Classes', () => {
    it('should create AuthenticationError correctly', () => {
      const error = new AuthenticationError(
        ErrorCode.NO_SESSION,
        'Authentication required',
        { requestId: 'test-123' }
      );

      expect(error.type).toBe(ErrorType.AUTH_ERROR);
      expect(error.code).toBe(ErrorCode.NO_SESSION);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication required');
    });

    it('should create BackendError correctly', () => {
      const error = new BackendError(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        404,
        { requestId: 'test-123' }
      );

      expect(error.type).toBe(ErrorType.BACKEND_ERROR);
      expect(error.code).toBe(ErrorCode.USER_NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
    });

    it('should create Auth0TokenError correctly', () => {
      const error = new Auth0TokenError(
        'Auth0 token service temporarily unavailable',
        { requestId: 'test-123' }
      );

      expect(error.type).toBe(ErrorType.INTERNAL_ERROR);
      expect(error.code).toBe(ErrorCode.AUTH0_TOKEN_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Auth0 token service temporarily unavailable');
    });
  });
});
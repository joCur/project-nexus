import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Auth0Service } from '@/services/auth0';
import { CacheService } from '@/services/cache';
import { UserService } from '@/services/user';
import {
  InvalidTokenError,
  TokenExpiredError,
  Auth0ServiceError,
} from '@/utils/errors';
import {
  createMockCacheService,
  createMockUserService,
  TEST_JWT_SECRET,
  ERROR_SCENARIOS,
} from '../../utils/test-helpers';
import {
  JWT_FIXTURES,
  AUTH0_USER_FIXTURES,
  USER_FIXTURES,
  SESSION_FIXTURES,
} from '../../utils/test-fixtures';
import { createMockFetch } from '../../utils/mock-auth0';

// Mock external dependencies - we don't test Auth0's JWT verification, only our business logic
jest.mock('jwks-rsa');
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  decode: jest.fn(),
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message: string, _expiredAt: Date) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  },
  JsonWebTokenError: class JsonWebTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  },
}));
jest.mock('@/utils/logger', () => ({
  securityLogger: {
    authFailure: jest.fn(),
    authSuccess: jest.fn(),
    sessionEvent: jest.fn(),
  },
  performanceLogger: {
    externalService: jest.fn(),
    dbQuery: jest.fn(),
  },
  createContextLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('Auth0Service', () => {
  let auth0Service: Auth0Service;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockJwksClient: jest.Mocked<any>;

  beforeEach(() => {
    // Create mock services
    mockCacheService = createMockCacheService() as jest.Mocked<CacheService>;
    mockUserService = createMockUserService() as jest.Mocked<UserService>;

    // Create mock JWKS client
    mockJwksClient = {
      getSigningKey: jest.fn(),
    };

    // Mock jwks-rsa constructor
    (jwksClient as jest.MockedFunction<typeof jwksClient>).mockReturnValue(mockJwksClient);

    // Mock JWT verification - we assume Auth0's JWT library works correctly
    // We only test OUR business logic: how we handle the verified payload
    (jwt.verify as jest.Mock).mockImplementation((_token: string, _key: any, _options: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Don't test JWT validation itself - just return appropriate payloads for our business logic tests
      return AUTH0_USER_FIXTURES.STANDARD_USER;
    });
    
    (jwt.decode as jest.Mock).mockImplementation((token: string) => {
      if (typeof token === 'string' && token.includes('.')) {
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          return {
            header: { kid: 'test-key-id' },
            payload: payload
          };
        } catch (error) {
          return null;
        }
      }
      
      return {
        header: { kid: 'test-key-id' },
        payload: AUTH0_USER_FIXTURES.STANDARD_USER
      };
    });

    // Mock global fetch
    global.fetch = createMockFetch('valid');

    // Create Auth0Service instance
    auth0Service = new Auth0Service(mockCacheService, mockUserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAuth0Token', () => {
    it('should validate a valid JWT token successfully', async () => {
      // Arrange
      const validToken = JWT_FIXTURES.VALID_TOKEN;
      const expectedUser = AUTH0_USER_FIXTURES.STANDARD_USER;

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act
      const result = await auth0Service.validateAuth0Token(validToken);

      // Assert
      expect(result).toBeDefined();
      expect(result?.sub).toBe(expectedUser.sub);
      expect(result?.email).toBe(expectedUser.email);
      expect(mockJwksClient.getSigningKey).toHaveBeenCalledWith('test-key-id');
    });

    it('should reject expired token', async () => {
      // Arrange - mock JWT.verify to throw TokenExpiredError
      // We're testing OUR error handling, not JWT expiration validation
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      // Make it an instance of JsonWebTokenError as well since the service checks for that first
      Object.setPrototypeOf(expiredError, jwt.JsonWebTokenError.prototype);
      
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw expiredError;
      });

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act & Assert
      await expect(auth0Service.validateAuth0Token('any-token'))
        .rejects.toThrow(TokenExpiredError);
    });

    it('should reject malformed token', async () => {
      // Arrange - mock JWT.decode to return null for malformed token
      // We're testing OUR handling of malformed tokens, not JWT parsing
      (jwt.decode as jest.Mock).mockReturnValueOnce(null);

      // Act
      const result = await auth0Service.validateAuth0Token('any-token');

      // Assert - service returns null for malformed tokens
      expect(result).toBeNull();
    });

    it('should handle JWKS key retrieval failure', async () => {
      // Arrange
      const validToken = JWT_FIXTURES.VALID_TOKEN;

      mockJwksClient.getSigningKey.mockRejectedValue(
        new Error('Unable to find signing key')
      );

      // Act
      const result = await auth0Service.validateAuth0Token(validToken);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle invalid token structure', async () => {
      // Arrange
      const invalidToken = 'not.a.valid.jwt.structure';

      // Act
      const result = await auth0Service.validateAuth0Token(invalidToken);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle JWT verification with wrong audience', async () => {
      // Arrange - mock JWT.verify to throw audience error
      // We're testing OUR error handling, not JWT audience validation
      const audienceError = new (jwt.JsonWebTokenError as any)('jwt audience invalid');
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw audienceError;
      });

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act & Assert
      await expect(auth0Service.validateAuth0Token('any-token'))
        .rejects.toThrow(InvalidTokenError);
    });

    it('should handle JWT verification with wrong issuer', async () => {
      // Arrange - mock JWT.verify to throw issuer error
      // We're testing OUR error handling, not JWT issuer validation
      const issuerError = new (jwt.JsonWebTokenError as any)('jwt issuer invalid');
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw issuerError;
      });

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act & Assert
      await expect(auth0Service.validateAuth0Token('any-token'))
        .rejects.toThrow(InvalidTokenError);
    });

    it('should handle network errors during key retrieval', async () => {
      // Arrange
      const validToken = JWT_FIXTURES.VALID_TOKEN;

      mockJwksClient.getSigningKey.mockRejectedValue(ERROR_SCENARIOS.NETWORK_ERROR);

      // Act
      const result = await auth0Service.validateAuth0Token(validToken);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('syncUserFromAuth0', () => {
    it('should sync existing user successfully', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const existingUser = USER_FIXTURES.STANDARD_USER;
      const updatedUser = { ...existingUser, lastLogin: new Date() };

      mockUserService.findByAuth0Id.mockResolvedValue(existingUser);
      mockUserService.update.mockResolvedValue(updatedUser);

      // Act
      const result = await auth0Service.syncUserFromAuth0(auth0User);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserService.findByAuth0Id).toHaveBeenCalledWith(auth0User.sub);
      expect(mockUserService.update).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({
          email: auth0User.email,
          lastLogin: expect.any(Date),
        })
      );
      expect(mockCacheService.set).toHaveBeenCalledTimes(2); // Permissions and Auth0 user cache
    });

    it('should create new user when not found', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const newUser = USER_FIXTURES.NEW_USER;

      mockUserService.findByAuth0Id.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(newUser as any);

      // Act
      const result = await auth0Service.syncUserFromAuth0(auth0User);

      // Assert
      expect(result).toEqual(newUser);
      expect(mockUserService.findByAuth0Id).toHaveBeenCalledWith(auth0User.sub);
      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: auth0User.email,
          auth0UserId: auth0User.sub,
          emailVerified: true, // Always true since we get email from custom claims
          displayName: auth0User.name,
        })
      );
    });

    it('should handle user service errors', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;

      mockUserService.findByAuth0Id.mockRejectedValue(ERROR_SCENARIOS.DATABASE_ERROR);

      // Act & Assert
      await expect(auth0Service.syncUserFromAuth0(auth0User))
        .rejects.toThrow(Auth0ServiceError);
    });

    it('should cache user permissions when available', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.ADMIN_USER;
      const adminUser = USER_FIXTURES.ADMIN_USER;

      mockUserService.findByAuth0Id.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(adminUser);

      // Act
      await auth0Service.syncUserFromAuth0(auth0User);

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('permissions:'),
        adminUser.permissions,
        60 * 60 * 1000
      );
    });

    it('should handle cache service errors gracefully', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockUserService.findByAuth0Id.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(user);
      mockCacheService.set.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await auth0Service.syncUserFromAuth0(auth0User);

      // Assert
      expect(result).toEqual(user);
      // Should not throw error even if cache fails
    });
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;

      // Act
      const sessionId = await auth0Service.createSession(user, auth0User);

      // Assert
      expect(sessionId).toMatch(/^session_/);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.objectContaining({
          userId: user.id,
          auth0UserId: auth0User.sub,
          email: user.email,
        }),
        4 * 60 * 60 * 1000 // 4 hours
      );
    });

    it('should handle cache service errors', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;

      mockCacheService.set.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const sessionId = await auth0Service.createSession(user, auth0User);

      // Assert
      expect(sessionId).toMatch(/^session_/);
      // Should complete even if cache fails
    });
  });

  describe('validateSession', () => {
    it('should validate active session successfully', async () => {
      // Arrange
      const userId = 'test-user-id';
      const activeSession = SESSION_FIXTURES.ACTIVE_SESSION;

      mockCacheService.get.mockResolvedValue(JSON.stringify(activeSession));

      // Act
      const result = await auth0Service.validateSession(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.objectContaining({
          lastActivity: expect.any(Date),
        }),
        4 * 60 * 60 * 1000
      );
    });

    it('should reject expired session', async () => {
      // Arrange
      const userId = 'test-user-id';
      const expiredSession = SESSION_FIXTURES.EXPIRED_SESSION;

      mockCacheService.get.mockResolvedValue(JSON.stringify(expiredSession));

      // Act
      const result = await auth0Service.validateSession(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        expect.stringContaining('session:')
      );
    });

    it('should reject inactive session', async () => {
      // Arrange
      const userId = 'test-user-id';
      const inactiveSession = SESSION_FIXTURES.INACTIVE_SESSION;

      mockCacheService.get.mockResolvedValue(JSON.stringify(inactiveSession));

      // Act
      const result = await auth0Service.validateSession(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        expect.stringContaining('session:')
      );
    });

    it('should handle missing session', async () => {
      // Arrange
      const userId = 'test-user-id';

      mockCacheService.get.mockResolvedValue(null);

      // Act
      const result = await auth0Service.validateSession(userId);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle cache service errors', async () => {
      // Arrange
      const userId = 'test-user-id';

      mockCacheService.get.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act
      const result = await auth0Service.validateSession(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('destroySession', () => {
    it('should destroy session successfully', async () => {
      // Arrange
      const userId = 'test-user-id';

      // Act
      await auth0Service.destroySession(userId);

      // Assert
      expect(mockCacheService.del).toHaveBeenCalledWith(
        expect.stringContaining('session:')
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(
        expect.stringContaining('permissions:')
      );
    });

    it('should handle cache service errors gracefully', async () => {
      // Arrange
      const userId = 'test-user-id';

      mockCacheService.del.mockRejectedValue(ERROR_SCENARIOS.REDIS_ERROR);

      // Act & Assert
      await expect(auth0Service.destroySession(userId)).resolves.not.toThrow();
    });
  });

  describe('getUserPermissions', () => {
    it('should return cached permissions', async () => {
      // Arrange
      const userId = 'test-user-id';
      const permissions = ['card:read', 'workspace:read'];

      mockCacheService.get.mockResolvedValue(JSON.stringify(permissions));

      // Act
      const result = await auth0Service.getUserPermissions(userId);

      // Assert
      expect(result).toEqual(permissions);
      expect(mockUserService.findById).not.toHaveBeenCalled();
    });

    it('should fetch permissions from database when not cached', async () => {
      // Arrange
      const userId = 'test-user-id';
      const user = USER_FIXTURES.STANDARD_USER;

      mockCacheService.get.mockResolvedValue(null);
      mockUserService.findById.mockResolvedValue(user);

      // Act
      const result = await auth0Service.getUserPermissions(userId);

      // Assert
      expect(result).toEqual(user.permissions);
      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('permissions:'),
        user.permissions,
        60 * 60 * 1000
      );
    });

    it('should return empty array for non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-user';

      mockCacheService.get.mockResolvedValue(null);
      mockUserService.findById.mockResolvedValue(null);

      // Act
      const result = await auth0Service.getUserPermissions(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('checkPermission', () => {
    it('should return true for user with permission', async () => {
      // Arrange
      const userId = 'test-user-id';
      const permission = 'card:read';
      const permissions = ['card:read', 'workspace:read'];

      mockCacheService.get.mockResolvedValue(JSON.stringify(permissions));

      // Act
      const result = await auth0Service.checkPermission(userId, permission);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for user without permission', async () => {
      // Arrange
      const userId = 'test-user-id';
      const permission = 'admin:user_management';
      const permissions = ['card:read', 'workspace:read'];

      mockCacheService.get.mockResolvedValue(JSON.stringify(permissions));

      // Act
      const result = await auth0Service.checkPermission(userId, permission);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return OK status for healthy Auth0 connection', async () => {
      // Arrange
      global.fetch = createMockFetch('valid');

      // Act
      const result = await auth0Service.healthCheck();

      // Assert
      expect(result.status).toBe('OK');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return ERROR status for failed Auth0 connection', async () => {
      // Arrange
      global.fetch = createMockFetch('network_error');

      // Act
      const result = await auth0Service.healthCheck();

      // Assert
      expect(result.status).toBe('ERROR');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    });

    it('should handle 404 response from JWKS endpoint', async () => {
      // Arrange
      global.fetch = createMockFetch('not_found');

      // Act
      const result = await auth0Service.healthCheck();

      // Assert
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('404');
    });
  });

  describe('getSigningKey (private method)', () => {
    it('should cache signing keys in memory and Redis', async () => {
      // Arrange - reset JWT mock to default behavior for this test
      (jwt.verify as jest.Mock).mockReturnValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      
      const kid = 'test-key-id';
      const validToken = JWT_FIXTURES.VALID_TOKEN;

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act
      await auth0Service.validateAuth0Token(validToken);

      // Assert
      expect(mockJwksClient.getSigningKey).toHaveBeenCalledWith(kid);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('auth0_jwks'),
        TEST_JWT_SECRET,
        60 * 60 * 1000
      );
    });

    it('should use cached signing key from Redis', async () => {
      // Arrange
      const validToken = JWT_FIXTURES.VALID_TOKEN;

      mockCacheService.get.mockResolvedValue(JSON.stringify(TEST_JWT_SECRET));

      // Act
      await auth0Service.validateAuth0Token(validToken);

      // Assert
      expect(mockJwksClient.getSigningKey).not.toHaveBeenCalled();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle concurrent token validation requests', async () => {
      // Arrange
      const validToken = JWT_FIXTURES.VALID_TOKEN;

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act
      const promises = Array(10).fill(null).map(() => 
        auth0Service.validateAuth0Token(validToken)
      );
      const results = await Promise.all(promises);

      // Assert
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.sub).toBe(AUTH0_USER_FIXTURES.STANDARD_USER.sub);
      });
    });

    it('should handle malformed JSON in cache', async () => {
      // Arrange
      const userId = 'test-user-id';

      mockCacheService.get.mockResolvedValue('invalid-json');

      // Act
      const result = await auth0Service.validateSession(userId);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle custom claims with special characters', async () => {
      // Arrange - mock JWT.verify to return custom claims with special characters
      // We're testing OUR handling of custom claims, not JWT parsing
      const customClaimsPayload = {
        ...AUTH0_USER_FIXTURES.STANDARD_USER,
        'https://api.nexus-app.de/roles': ['role with spaces', 'role-with-dashes'],
        'https://api.nexus-app.de/permissions': ['permission:with:colons'],
      };
      
      (jwt.verify as jest.Mock).mockReturnValueOnce(customClaimsPayload);

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act
      const result = await auth0Service.validateAuth0Token('any-token');

      // Assert
      expect(result).toBeDefined();
      expect(result?.roles).toContain('role with spaces');
      expect(result?.permissions).toContain('permission:with:colons');
    });
  });

  describe('Performance and metrics', () => {
    it('should complete token validation within acceptable time', async () => {
      // Arrange
      const validToken = JWT_FIXTURES.VALID_TOKEN;
      const startTime = Date.now();

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act
      await auth0Service.validateAuth0Token(validToken);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle high concurrency without errors', async () => {
      // Arrange
      const validToken = JWT_FIXTURES.VALID_TOKEN;
      const concurrency = 50;

      mockJwksClient.getSigningKey.mockResolvedValue({
        getPublicKey: () => TEST_JWT_SECRET,
      });

      // Act
      const promises = Array(concurrency).fill(null).map(() => 
        auth0Service.validateAuth0Token(validToken)
      );
      const results = await Promise.allSettled(promises);

      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBe(concurrency);
    });
  });
});
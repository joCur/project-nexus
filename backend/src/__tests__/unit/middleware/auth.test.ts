import { Request, Response, NextFunction } from 'express';
import {
  createAuthMiddleware,
  requireAuth,
  requirePermission,
  requireRole,
  createGraphQLContext,
  authDirectives,
  AuthenticatedRequest,
} from '@/middleware/auth';
import { Auth0Service } from '@/services/auth0';
import { UserService } from '@/services/user';
import { CacheService } from '@/services/cache';
import {
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
} from '@/utils/errors';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockAuth0Service,
  createMockUserService,
  createMockCacheService,
  createMockGraphQLContext,
} from '../../utils/test-helpers';
import {
  JWT_FIXTURES,
  AUTH0_USER_FIXTURES,
  USER_FIXTURES,
  REQUEST_FIXTURES,
} from '../../utils/test-fixtures';

// Mock logger
jest.mock('@/utils/logger');

describe('Authentication Middleware', () => {
  let mockAuth0Service: jest.Mocked<Auth0Service>;
  let mockUserService: jest.Mocked<UserService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockReq: AuthenticatedRequest;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockAuth0Service = createMockAuth0Service() as jest.Mocked<Auth0Service>;
    mockUserService = createMockUserService() as jest.Mocked<UserService>;
    mockCacheService = createMockCacheService() as jest.Mocked<CacheService>;
    mockReq = createMockRequest() as AuthenticatedRequest;
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuthMiddleware', () => {
    let authMiddleware: ReturnType<typeof createAuthMiddleware>;

    beforeEach(() => {
      authMiddleware = createAuthMiddleware(
        mockAuth0Service,
        mockUserService,
        mockCacheService
      );
    });

    it('should authenticate valid user successfully', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockReq.headers.authorization = `Bearer ${JWT_FIXTURES.VALID_TOKEN}`;
      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockUserService.updateLastLogin.mockResolvedValue();

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.isAuthenticated).toBe(true);
      expect(mockReq.user).toBe(user);
      expect(mockReq.auth0Payload).toBe(auth0User);
      expect(mockReq.permissions).toBe(user.permissions);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAuth0Service.validateAuth0Token).toHaveBeenCalledWith(JWT_FIXTURES.VALID_TOKEN);
      expect(mockAuth0Service.syncUserFromAuth0).toHaveBeenCalledWith(auth0User);
      expect(mockUserService.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it('should handle unauthenticated request (no token)', async () => {
      // Arrange
      mockReq.headers.authorization = undefined;

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.isAuthenticated).toBe(false);
      expect(mockReq.user).toBeUndefined();
      expect(mockReq.permissions).toEqual([]);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAuth0Service.validateAuth0Token).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header', async () => {
      // Arrange
      mockReq.headers.authorization = 'InvalidFormat token';

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.isAuthenticated).toBe(false);
      expect(mockReq.permissions).toEqual([]);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAuth0Service.validateAuth0Token).not.toHaveBeenCalled();
    });

    it('should handle invalid Auth0 token', async () => {
      // Arrange
      mockReq.headers.authorization = `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`;
      mockAuth0Service.validateAuth0Token.mockResolvedValue(null);

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should handle expired session', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockReq.headers.authorization = `Bearer ${JWT_FIXTURES.VALID_TOKEN}`;
      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(false);

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(TokenExpiredError));
    });

    it('should handle Auth0 token validation error', async () => {
      // Arrange
      mockReq.headers.authorization = `Bearer ${JWT_FIXTURES.EXPIRED_TOKEN}`;
      mockAuth0Service.validateAuth0Token.mockRejectedValue(new TokenExpiredError());

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(TokenExpiredError));
    });

    it('should handle user synchronization error', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;

      mockReq.headers.authorization = `Bearer ${JWT_FIXTURES.VALID_TOKEN}`;
      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockRejectedValue(new Error('Database error'));

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should handle concurrent authentication requests', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockUserService.updateLastLogin.mockResolvedValue();

      const requests = Array(5).fill(null).map(() => {
        const req = createMockRequest({
          headers: { authorization: `Bearer ${JWT_FIXTURES.VALID_TOKEN}` }
        }) as AuthenticatedRequest;
        return authMiddleware(req, mockRes, mockNext);
      });

      // Act
      await Promise.all(requests);

      // Assert
      expect(mockAuth0Service.validateAuth0Token).toHaveBeenCalledTimes(5);
      expect(mockNext).toHaveBeenCalledTimes(5);
    });

    it('should gracefully handle updateLastLogin failure', async () => {
      // Arrange
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockReq.headers.authorization = `Bearer ${JWT_FIXTURES.VALID_TOKEN}`;
      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockUserService.updateLastLogin.mockRejectedValue(new Error('Update failed'));

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.isAuthenticated).toBe(true);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireAuth middleware', () => {
    it('should pass authenticated request', () => {
      // Arrange
      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;

      // Act
      requireAuth(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject unauthenticated request', () => {
      // Arrange
      mockReq.isAuthenticated = false;

      // Act & Assert
      expect(() => requireAuth(mockReq, mockRes, mockNext))
        .toThrow(AuthenticationError);
    });
  });

  describe('requirePermission middleware', () => {
    it('should pass request with required permission', () => {
      // Arrange
      const permission = 'card:read';
      const middleware = requirePermission(permission);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;
      mockReq.permissions = ['card:read', 'workspace:read'];

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject unauthenticated request', () => {
      // Arrange
      const permission = 'card:read';
      const middleware = requirePermission(permission);

      mockReq.isAuthenticated = false;

      // Act & Assert
      expect(() => middleware(mockReq, mockRes, mockNext))
        .toThrow(AuthenticationError);
    });

    it('should reject request without required permission', () => {
      // Arrange
      const permission = 'admin:user_management';
      const middleware = requirePermission(permission);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;
      mockReq.permissions = ['card:read', 'workspace:read'];

      // Act & Assert
      expect(() => middleware(mockReq, mockRes, mockNext))
        .toThrow(AuthorizationError);
    });

    it('should pass admin user with any permission', () => {
      // Arrange
      const permission = 'some:permission';
      const middleware = requirePermission(permission);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.ADMIN_USER;
      mockReq.permissions = USER_FIXTURES.ADMIN_USER.permissions;

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireRole middleware', () => {
    it('should pass request with required role', () => {
      // Arrange
      const role = 'user';
      const middleware = requireRole(role);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject unauthenticated request', () => {
      // Arrange
      const role = 'user';
      const middleware = requireRole(role);

      mockReq.isAuthenticated = false;

      // Act & Assert
      expect(() => middleware(mockReq, mockRes, mockNext))
        .toThrow(AuthenticationError);
    });

    it('should reject request without required role', () => {
      // Arrange
      const role = 'super_admin';
      const middleware = requireRole(role);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;

      // Act & Assert
      expect(() => middleware(mockReq, mockRes, mockNext))
        .toThrow(AuthorizationError);
    });

    it('should pass admin user with super_admin role', () => {
      // Arrange
      const role = 'super_admin';
      const middleware = requireRole(role);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.ADMIN_USER;

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('createGraphQLContext', () => {
    it('should create context with authenticated user', async () => {
      // Arrange
      const contextFactory = createGraphQLContext(
        mockAuth0Service,
        mockUserService,
        mockCacheService,
        {} as any, // userProfileService
        {} as any, // onboardingService
        {} as any  // workspaceService
      );

      mockReq.user = USER_FIXTURES.STANDARD_USER;
      mockReq.auth0Payload = AUTH0_USER_FIXTURES.STANDARD_USER;
      mockReq.permissions = USER_FIXTURES.STANDARD_USER.permissions;
      mockReq.isAuthenticated = true;

      // Act
      const context = await contextFactory({ req: mockReq, res: mockRes });

      // Assert
      expect(context.user).toBe(USER_FIXTURES.STANDARD_USER);
      expect(context.auth0Payload).toBe(AUTH0_USER_FIXTURES.STANDARD_USER);
      expect(context.permissions).toBe(USER_FIXTURES.STANDARD_USER.permissions);
      expect(context.isAuthenticated).toBe(true);
      expect(context.dataSources.auth0Service).toBe(mockAuth0Service);
      expect(context.dataSources.userService).toBe(mockUserService);
      expect(context.dataSources.cacheService).toBe(mockCacheService);
    });

    it('should create context for unauthenticated user', async () => {
      // Arrange
      const contextFactory = createGraphQLContext(
        mockAuth0Service,
        mockUserService,
        mockCacheService,
        {} as any, // userProfileService
        {} as any, // onboardingService
        {} as any  // workspaceService
      );

      mockReq.isAuthenticated = false;
      mockReq.permissions = [];

      // Act
      const context = await contextFactory({ req: mockReq, res: mockRes });

      // Assert
      expect(context.user).toBeUndefined();
      expect(context.auth0Payload).toBeUndefined();
      expect(context.permissions).toEqual([]);
      expect(context.isAuthenticated).toBe(false);
    });
  });

  describe('GraphQL directives', () => {
    describe('@auth directive', () => {
      it('should pass authenticated request', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: true,
          user: USER_FIXTURES.STANDARD_USER,
        });
        const next = jest.fn();

        // Act
        authDirectives.auth(next, null, null, context);

        // Assert
        expect(next).toHaveBeenCalled();
      });

      it('should reject unauthenticated request', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: false,
        });
        const next = jest.fn();

        // Act & Assert
        expect(() => authDirectives.auth(next, null, null, context))
          .toThrow(AuthenticationError);
      });
    });

    describe('@requirePermission directive', () => {
      it('should pass request with required permission', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: true,
          user: USER_FIXTURES.STANDARD_USER,
          permissions: ['card:read', 'workspace:read'],
        });
        const info = {
          directive: {
            arguments: {
              permission: { value: 'card:read' }
            }
          },
          operation: { operation: 'query' },
          fieldName: 'cards',
        };
        const next = jest.fn();

        // Act
        authDirectives.requirePermission(next, null, null, context, info);

        // Assert
        expect(next).toHaveBeenCalled();
      });

      it('should reject unauthenticated request', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: false,
        });
        const info = {
          directive: {
            arguments: {
              permission: { value: 'card:read' }
            }
          }
        };
        const next = jest.fn();

        // Act & Assert
        expect(() => authDirectives.requirePermission(next, null, null, context, info))
          .toThrow(AuthenticationError);
      });

      it('should reject request without required permission', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: true,
          user: USER_FIXTURES.STANDARD_USER,
          permissions: ['card:read'],
        });
        const info = {
          directive: {
            arguments: {
              permission: { value: 'admin:user_management' }
            }
          },
          operation: { operation: 'mutation' },
          fieldName: 'deleteUser',
        };
        const next = jest.fn();

        // Act & Assert
        expect(() => authDirectives.requirePermission(next, null, null, context, info))
          .toThrow(AuthorizationError);
      });
    });

    describe('@requireRole directive', () => {
      it('should pass request with required role', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: true,
          user: USER_FIXTURES.ADMIN_USER,
        });
        const info = {
          directive: {
            arguments: {
              role: { value: 'super_admin' }
            }
          },
          operation: { operation: 'mutation' },
          fieldName: 'adminOperation',
        };
        const next = jest.fn();

        // Act
        authDirectives.requireRole(next, null, null, context, info);

        // Assert
        expect(next).toHaveBeenCalled();
      });

      it('should reject unauthenticated request', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: false,
        });
        const info = {
          directive: {
            arguments: {
              role: { value: 'admin' }
            }
          }
        };
        const next = jest.fn();

        // Act & Assert
        expect(() => authDirectives.requireRole(next, null, null, context, info))
          .toThrow(AuthenticationError);
      });

      it('should reject request without required role', () => {
        // Arrange
        const context = createMockGraphQLContext({
          isAuthenticated: true,
          user: USER_FIXTURES.STANDARD_USER,
        });
        const info = {
          directive: {
            arguments: {
              role: { value: 'super_admin' }
            }
          },
          operation: { operation: 'mutation' },
          fieldName: 'adminOperation',
        };
        const next = jest.fn();

        // Act & Assert
        expect(() => authDirectives.requireRole(next, null, null, context, info))
          .toThrow(AuthorizationError);
      });
    });
  });

  describe('Security edge cases', () => {
    it('should handle token injection attacks', async () => {
      // Arrange
      const authMiddleware = createAuthMiddleware(
        mockAuth0Service,
        mockUserService,
        mockCacheService
      );

      // Simulate token injection in various headers
      mockReq.headers.authorization = `Bearer ${JWT_FIXTURES.VALID_TOKEN}`;
      mockReq.headers['x-forwarded-authorization'] = `Bearer ${JWT_FIXTURES.ADMIN_TOKEN}`;
      mockReq.headers.cookie = `token=${JWT_FIXTURES.ADMIN_TOKEN}`;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockAuth0Service.validateAuth0Token).toHaveBeenCalledWith(JWT_FIXTURES.VALID_TOKEN);
      expect(mockAuth0Service.validateAuth0Token).toHaveBeenCalledTimes(1);
      expect(mockReq.user).toBe(USER_FIXTURES.STANDARD_USER);
    });

    it('should handle extremely long authorization headers', async () => {
      // Arrange
      const authMiddleware = createAuthMiddleware(
        mockAuth0Service,
        mockUserService,
        mockCacheService
      );

      const longToken = 'Bearer ' + 'x'.repeat(10000);
      mockReq.headers.authorization = longToken;

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.isAuthenticated).toBe(false);
      expect(mockAuth0Service.validateAuth0Token).toHaveBeenCalledWith('x'.repeat(10000));
    });

    it('should handle null and undefined values safely', async () => {
      // Arrange
      const authMiddleware = createAuthMiddleware(
        mockAuth0Service,
        mockUserService,
        mockCacheService
      );

      mockReq.headers.authorization = null as any;
      mockReq.user = null as any;

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockReq.isAuthenticated).toBe(false);
      expect(mockReq.permissions).toEqual([]);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle permission arrays with duplicate values', () => {
      // Arrange
      const permission = 'card:read';
      const middleware = requirePermission(permission);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;
      mockReq.permissions = ['card:read', 'card:read', 'workspace:read'];

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle case-sensitive permission checks', () => {
      // Arrange
      const permission = 'Card:Read'; // Different case
      const middleware = requirePermission(permission);

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;
      mockReq.permissions = ['card:read']; // Lowercase

      // Act & Assert
      expect(() => middleware(mockReq, mockRes, mockNext))
        .toThrow(AuthorizationError);
    });
  });

  describe('Performance tests', () => {
    it('should handle high-frequency authentication requests', async () => {
      // Arrange
      const authMiddleware = createAuthMiddleware(
        mockAuth0Service,
        mockUserService,
        mockCacheService
      );

      const startTime = Date.now();
      const iterations = 100;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const requests = Array(iterations).fill(null).map(() => {
        const req = createMockRequest({
          headers: { authorization: `Bearer ${JWT_FIXTURES.VALID_TOKEN}` }
        }) as AuthenticatedRequest;
        return authMiddleware(req, mockRes, mockNext);
      });

      // Act
      await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockNext).toHaveBeenCalledTimes(iterations);
    });

    it('should handle permission checks efficiently', () => {
      // Arrange
      const permission = 'card:read';
      const middleware = requirePermission(permission);
      const iterations = 1000;

      mockReq.isAuthenticated = true;
      mockReq.user = USER_FIXTURES.STANDARD_USER;
      mockReq.permissions = ['card:read', 'workspace:read'];

      const startTime = Date.now();

      // Act
      for (let i = 0; i < iterations; i++) {
        middleware(mockReq, mockRes, mockNext);
      }

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(mockNext).toHaveBeenCalledTimes(iterations);
    });
  });
});
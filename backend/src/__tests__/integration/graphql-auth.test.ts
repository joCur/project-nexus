import { authResolvers } from '@/resolvers/auth';
import { Auth0Service } from '@/services/auth0';
import { UserService } from '@/services/user';
import { CacheService } from '@/services/cache';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from '@/utils/errors';
import {
  createMockAuth0Service,
  createMockUserService,
  createMockCacheService,
  createMockWorkspaceAuthorizationService,
  createMockGraphQLContext,
} from '../utils/test-helpers';
import {
  JWT_FIXTURES,
  AUTH0_USER_FIXTURES,
  USER_FIXTURES,
  SESSION_FIXTURES,
} from '../utils/test-fixtures';

// Mock logger
jest.mock('@/utils/logger');

// GraphQL schema for testing

describe('GraphQL Authentication Integration Tests', () => {
  let mockAuth0Service: jest.Mocked<Auth0Service>;
  let mockUserService: jest.Mocked<UserService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockWorkspaceAuthService: any;

  beforeEach(() => {
    mockAuth0Service = createMockAuth0Service() as jest.Mocked<Auth0Service>;
    mockUserService = createMockUserService() as jest.Mocked<UserService>;
    mockCacheService = createMockCacheService() as jest.Mocked<CacheService>;
    mockWorkspaceAuthService = createMockWorkspaceAuthorizationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query: me', () => {
    it('should return current user when authenticated', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
      });

      // Act
      const result = await authResolvers.Query.me(null, {}, context);

      // Assert
      expect(result).toBe(USER_FIXTURES.STANDARD_USER);
    });

    it('should return null when not authenticated', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: false,
        user: null,
      });

      // Act
      const result = await authResolvers.Query.me(null, {}, context);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Query: validateSession', () => {
    it('should return true for valid session', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Act
      const result = await authResolvers.Query.validateSession(null, {}, context);

      // Assert
      expect(result).toBe(true);
      expect(mockAuth0Service.validateSession).toHaveBeenCalledWith(
        USER_FIXTURES.STANDARD_USER.id
      );
    });

    it('should return false for invalid session', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateSession.mockResolvedValue(false);

      // Act
      const result = await authResolvers.Query.validateSession(null, {}, context);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: false,
      });

      // Act
      const result = await authResolvers.Query.validateSession(null, {}, context);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Query: getUserPermissions', () => {
    it('should return user permissions for own user', async () => {
      // Arrange
      const userId = USER_FIXTURES.STANDARD_USER.id;
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
        dataSources: { 
          auth0Service: mockAuth0Service,
          workspaceAuthorizationService: mockWorkspaceAuthService
        },
      });

      // Mock workspace authorization service to return user permissions
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue({
        'workspace-1': ['perm1', 'perm2'],
        'workspace-2': ['perm2', 'perm3']
      });

      // Act
      const result = await authResolvers.Query.getUserPermissions(
        null,
        { userId },
        context
      );

      // Assert
      expect(result).toEqual(['perm1', 'perm2', 'perm3']); // Should be flattened and deduplicated
      expect(mockWorkspaceAuthService.getUserPermissionsForContext).toHaveBeenCalledWith(userId);
    });

    it('should return permissions for admin accessing other user', async () => {
      // Arrange
      const userId = USER_FIXTURES.STANDARD_USER.id;
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { 
          auth0Service: mockAuth0Service,
          workspaceAuthorizationService: mockWorkspaceAuthService
        },
      });

      // Mock admin user having admin permissions across workspaces
      mockWorkspaceAuthService.getUserPermissionsForContext
        .mockResolvedValueOnce({
          'workspace-1': ['admin:user_management'], // Admin user permissions
        })
        .mockResolvedValueOnce({
          'workspace-1': ['perm1'],
          'workspace-2': ['perm2'] // Target user permissions
        });

      // Act
      const result = await authResolvers.Query.getUserPermissions(
        null,
        { userId },
        context
      );

      // Assert
      expect(result).toEqual(['perm1', 'perm2']); // Target user's permissions flattened
      expect(mockWorkspaceAuthService.getUserPermissionsForContext).toHaveBeenCalledTimes(2);
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      // Arrange
      const userId = USER_FIXTURES.STANDARD_USER.id;
      const context = createMockGraphQLContext({
        isAuthenticated: false,
      });

      // Act & Assert
      await expect(
        authResolvers.Query.getUserPermissions(null, { userId }, context)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthorizationError for unauthorized access', async () => {
      // Arrange
      const otherUserId = 'other-user-id';
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
        permissions: ['card:read'], // No admin permissions
      });

      // Act & Assert
      await expect(
        authResolvers.Query.getUserPermissions(null, { userId: otherUserId }, context)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Mutation: syncUserFromAuth0', () => {
    it('should sync user successfully', async () => {
      // Arrange
      const auth0Token = JWT_FIXTURES.VALID_TOKEN;
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;
      const sessionId = 'session-123';
      const _expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

      const context = createMockGraphQLContext({
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.createSession.mockResolvedValue(sessionId);

      // Act
      const result = await authResolvers.Mutation.syncUserFromAuth0(
        null,
        { auth0Token },
        context
      );

      // Assert
      expect(result).toEqual({
        user,
        sessionId,
        expiresAt: expect.any(Date),
        permissions: [], // Empty initially, will be resolved dynamically using WorkspaceAuthorizationService
      });
      expect(mockAuth0Service.validateAuth0Token).toHaveBeenCalledWith(auth0Token);
      expect(mockAuth0Service.syncUserFromAuth0).toHaveBeenCalledWith(auth0User);
      expect(mockAuth0Service.createSession).toHaveBeenCalledWith(user, auth0User);
    });

    it('should throw AuthenticationError for invalid token', async () => {
      // Arrange
      const invalidToken = JWT_FIXTURES.MALFORMED_TOKEN;
      const context = createMockGraphQLContext({
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateAuth0Token.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authResolvers.Mutation.syncUserFromAuth0(
          null,
          { auth0Token: invalidToken },
          context
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('should handle Auth0Service errors', async () => {
      // Arrange
      const auth0Token = JWT_FIXTURES.VALID_TOKEN;
      const context = createMockGraphQLContext({
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Auth0 service error')
      );

      // Act & Assert
      await expect(
        authResolvers.Mutation.syncUserFromAuth0(
          null,
          { auth0Token },
          context
        )
      ).rejects.toThrow();
    });
  });

  describe('Mutation: refreshSession', () => {
    it('should refresh session successfully', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const sessionData = SESSION_FIXTURES.ACTIVE_SESSION;
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user,
        dataSources: {
          auth0Service: mockAuth0Service,
          cacheService: mockCacheService,
        },
      });

      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue(JSON.stringify(sessionData));

      // Act
      const result = await authResolvers.Mutation.refreshSession(null, {}, context);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          lastActivity: expect.any(Date),
        })
      );
      expect(mockAuth0Service.validateSession).toHaveBeenCalledWith(user.id);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: false,
      });

      // Act & Assert
      await expect(
        authResolvers.Mutation.refreshSession(null, {}, context)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for expired session', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user,
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateSession.mockResolvedValue(false);

      // Act & Assert
      await expect(
        authResolvers.Mutation.refreshSession(null, {}, context)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should handle missing session data', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user,
        dataSources: {
          auth0Service: mockAuth0Service,
          cacheService: mockCacheService,
        },
      });

      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authResolvers.Mutation.refreshSession(null, {}, context)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Mutation: logout', () => {
    it('should logout successfully', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user,
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.destroySession.mockResolvedValue();

      // Act
      const result = await authResolvers.Mutation.logout(null, {}, context);

      // Assert
      expect(result).toBe(true);
      expect(mockAuth0Service.destroySession).toHaveBeenCalledWith(user.id);
    });

    it('should return true when already logged out', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: false,
      });

      // Act
      const result = await authResolvers.Mutation.logout(null, {}, context);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle session destruction errors gracefully', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user,
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.destroySession.mockRejectedValue(new Error('Cache error'));

      // Act
      const result = await authResolvers.Mutation.logout(null, {}, context);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Mutation: grantPermissions', () => {
    it('should grant permissions successfully', async () => {
      // Arrange
      const targetUserId = USER_FIXTURES.STANDARD_USER.id;
      const newPermissions = ['card:delete'];
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      const updatedUser = {
        ...USER_FIXTURES.STANDARD_USER,
        permissions: [...USER_FIXTURES.STANDARD_USER.permissions, ...newPermissions],
      };

      mockUserService.findById.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockUserService.update.mockResolvedValue(updatedUser);

      // Act
      const result = await authResolvers.Mutation.grantPermissions(
        null,
        { userId: targetUserId, permissions: newPermissions },
        context
      );

      // Assert
      expect(result).toBe(updatedUser);
      expect(mockUserService.findById).toHaveBeenCalledWith(targetUserId);
      expect(mockUserService.update).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          permissions: expect.arrayContaining(newPermissions),
        })
      );
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: false,
      });

      // Act & Assert
      await expect(
        authResolvers.Mutation.grantPermissions(
          null,
          { userId: 'user-id', permissions: ['card:read'] },
          context
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthorizationError for insufficient permissions', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
        permissions: ['card:read'], // No admin permissions
      });

      // Act & Assert
      await expect(
        authResolvers.Mutation.grantPermissions(
          null,
          { userId: 'user-id', permissions: ['card:delete'] },
          context
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      mockUserService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authResolvers.Mutation.grantPermissions(
          null,
          { userId: 'non-existent', permissions: ['card:read'] },
          context
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Mutation: revokePermissions', () => {
    it('should revoke permissions successfully', async () => {
      // Arrange
      const targetUserId = USER_FIXTURES.ADMIN_USER.id;
      const permissionsToRevoke = ['admin:system_settings'];
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      const updatedUser = {
        ...USER_FIXTURES.ADMIN_USER,
        permissions: USER_FIXTURES.ADMIN_USER.permissions.filter(
          p => !permissionsToRevoke.includes(p)
        ),
      };

      mockUserService.findById.mockResolvedValue(USER_FIXTURES.ADMIN_USER);
      mockUserService.update.mockResolvedValue(updatedUser);

      // Act
      const result = await authResolvers.Mutation.revokePermissions(
        null,
        { userId: targetUserId, permissions: permissionsToRevoke },
        context
      );

      // Assert
      expect(result).toBe(updatedUser);
      expect(mockUserService.update).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          permissions: expect.not.arrayContaining(permissionsToRevoke),
        })
      );
    });
  });

  describe('Mutation: assignRole', () => {
    it('should assign role successfully', async () => {
      // Arrange
      const targetUserId = USER_FIXTURES.STANDARD_USER.id;
      const newRole = 'workspace_admin';
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      const updatedUser = {
        ...USER_FIXTURES.STANDARD_USER,
        roles: [...USER_FIXTURES.STANDARD_USER.roles, newRole],
      };

      mockUserService.findById.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockUserService.update.mockResolvedValue(updatedUser);

      // Act
      const result = await authResolvers.Mutation.assignRole(
        null,
        { userId: targetUserId, role: newRole },
        context
      );

      // Assert
      expect(result).toBe(updatedUser);
      expect(mockUserService.update).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          roles: expect.arrayContaining([newRole]),
        })
      );
    });

    it('should not add duplicate roles', async () => {
      // Arrange
      const targetUserId = USER_FIXTURES.STANDARD_USER.id;
      const existingRole = USER_FIXTURES.STANDARD_USER.roles[0];
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      mockUserService.findById.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockUserService.update.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      // Act
      const result = await authResolvers.Mutation.assignRole(
        null,
        { userId: targetUserId, role: existingRole },
        context
      );

      // Assert
      expect(result).toBe(USER_FIXTURES.STANDARD_USER);
      expect(mockUserService.update).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          roles: USER_FIXTURES.STANDARD_USER.roles,
        })
      );
    });
  });

  describe('Mutation: removeRole', () => {
    it('should remove role successfully', async () => {
      // Arrange
      const targetUserId = USER_FIXTURES.ADMIN_USER.id;
      const roleToRemove = 'super_admin';
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      const updatedUser = {
        ...USER_FIXTURES.ADMIN_USER,
        roles: USER_FIXTURES.ADMIN_USER.roles.filter(r => r !== roleToRemove),
      };

      mockUserService.findById.mockResolvedValue(USER_FIXTURES.ADMIN_USER);
      mockUserService.update.mockResolvedValue(updatedUser);

      // Act
      const result = await authResolvers.Mutation.removeRole(
        null,
        { userId: targetUserId, role: roleToRemove },
        context
      );

      // Assert
      expect(result).toBe(updatedUser);
      expect(mockUserService.update).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          roles: expect.not.arrayContaining([roleToRemove]),
        })
      );
    });
  });

  describe('Scalar resolvers', () => {
    it('should serialize DateTime correctly', () => {
      // Arrange
      const date = new Date('2023-01-01T00:00:00.000Z');

      // Act
      const result = authResolvers.DateTime.serialize(date);

      // Assert
      expect(result).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should parse DateTime value correctly', () => {
      // Arrange
      const dateString = '2023-01-01T00:00:00.000Z';

      // Act
      const result = authResolvers.DateTime.parseValue(dateString);

      // Assert
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(dateString);
    });

    it('should serialize JSON correctly', () => {
      // Arrange
      const jsonValue = { key: 'value', nested: { array: [1, 2, 3] } };

      // Act
      const result = authResolvers.JSON.serialize(jsonValue);

      // Assert
      expect(result).toBe(jsonValue);
    });

    it('should parse JSON value correctly', () => {
      // Arrange
      const jsonValue = { key: 'value' };

      // Act
      const result = authResolvers.JSON.parseValue(jsonValue);

      // Assert
      expect(result).toEqual(jsonValue);
    });
  });

  describe('User field resolvers', () => {
    it('should resolve user workspaces', async () => {
      // Arrange
      const user = USER_FIXTURES.STANDARD_USER;
      const workspaces = ['workspace-1', 'workspace-2'];
      const context = createMockGraphQLContext({
        dataSources: { userService: mockUserService },
      });

      mockUserService.getUserWorkspaces.mockResolvedValue(workspaces);

      // Act
      const result = await authResolvers.User.workspaces(user, {}, context);

      // Assert
      expect(result).toEqual(workspaces);
      expect(mockUserService.getUserWorkspaces).toHaveBeenCalledWith(user.id);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle concurrent GraphQL operations', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateSession.mockResolvedValue(true);

      const operations = Array(10).fill(null).map(() =>
        authResolvers.Query.validateSession(null, {}, context)
      );

      // Act
      const results = await Promise.all(operations);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => expect(result).toBe(true));
    });

    it('should handle service timeouts gracefully', async () => {
      // Arrange
      const auth0Token = JWT_FIXTURES.VALID_TOKEN;
      const context = createMockGraphQLContext({
        dataSources: { auth0Service: mockAuth0Service },
      });

      mockAuth0Service.validateAuth0Token.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      // Act & Assert
      await expect(
        authResolvers.Mutation.syncUserFromAuth0(
          null,
          { auth0Token },
          context
        )
      ).rejects.toThrow('Timeout');
    });

    it('should handle malformed input data', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      // Act & Assert
      await expect(
        authResolvers.Mutation.grantPermissions(
          null,
          { userId: '', permissions: [] }, // Empty values
          context
        )
      ).rejects.toThrow();
    });

    it('should handle database constraint violations', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      mockUserService.findById.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockUserService.update.mockRejectedValue(new Error('Constraint violation'));

      // Act & Assert
      await expect(
        authResolvers.Mutation.grantPermissions(
          null,
          { userId: USER_FIXTURES.STANDARD_USER.id, permissions: ['new:permission'] },
          context
        )
      ).rejects.toThrow();
    });
  });

  describe('Performance and scalability', () => {
    it('should handle high-frequency GraphQL requests', async () => {
      // Arrange
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.STANDARD_USER,
      });

      const requests = 100;
      const startTime = Date.now();

      const operations = Array(requests).fill(null).map(() =>
        authResolvers.Query.me(null, {}, context)
      );

      // Act
      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large permission arrays efficiently', async () => {
      // Arrange
      const largePermissionArray = Array(1000).fill(null).map((_, i) => `permission:${i}`);
      const context = createMockGraphQLContext({
        isAuthenticated: true,
        user: USER_FIXTURES.ADMIN_USER,
        permissions: ['admin:user_management'],
        dataSources: { userService: mockUserService },
      });

      const updatedUser = {
        ...USER_FIXTURES.STANDARD_USER,
        permissions: largePermissionArray,
      };

      mockUserService.findById.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockUserService.update.mockResolvedValue(updatedUser);

      // Act
      const result = await authResolvers.Mutation.grantPermissions(
        null,
        { userId: USER_FIXTURES.STANDARD_USER.id, permissions: largePermissionArray },
        context
      );

      // Assert
      expect(result.permissions).toHaveLength(1000);
    });
  });
});
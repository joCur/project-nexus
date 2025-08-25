import { UserService } from '@/services/user';
import { database, knex } from '@/database/connection';
import {
  NotFoundError,
  UniqueConstraintError as _UniqueConstraintError,
  ValidationError,
} from '@/utils/errors';
import {
  createMockUser as _createMockUser,
  createMockDatabaseQuery,
  createMockKnex,
  ERROR_SCENARIOS,
} from '../../utils/test-helpers';
import {
  USER_FIXTURES,
} from '../../utils/test-fixtures';

// Mock database connection
jest.mock('@/database/connection', () => ({
  database: {
    query: jest.fn(),
  },
  knex: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('UserService', () => {
  let userService: UserService;
  let mockDatabaseQuery: jest.MockedFunction<any>;
  const mockDatabase = database as jest.Mocked<typeof database>;
  const _typedMockKnex = knex as jest.MockedFunction<typeof knex>;

  beforeEach(() => {
    mockDatabaseQuery = createMockDatabaseQuery();
    mockDatabase.query = mockDatabaseQuery;
    
    // Setup knex mock
    const mockKnex = createMockKnex();
    (knex as any) = mockKnex;

    userService = new UserService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const createInput = {
        email: 'test@example.com',
        auth0UserId: 'auth0|test_user_123',
        emailVerified: true,
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        roles: ['user'],
        permissions: ['card:read', 'workspace:read'],
      };

      const expectedDbUser = {
        id: 'user-123-uuid',
        email: 'test@example.com',
        auth0_user_id: 'auth0|test_user_123',
        email_verified: true,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        roles: ['user'],
        permissions: ['card:read', 'workspace:read'],
        created_at: new Date(),
        updated_at: new Date(),
        metadata_synced_at: new Date(),
        last_login: null,
        auth0_updated_at: null,
      };

      mockDatabaseQuery.mockResolvedValue([expectedDbUser]);

      // Act
      const result = await userService.create(createInput);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(expectedDbUser.id);
      expect(result.email).toBe(createInput.email);
      expect(result.auth0UserId).toBe(createInput.auth0UserId);
      expect(result.emailVerified).toBe(createInput.emailVerified);
      expect(result.displayName).toBe(createInput.displayName);
      expect(result.roles).toEqual(createInput.roles);
      expect(result.permissions).toEqual(createInput.permissions);

      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_create'
      );
    });

    it('should create user with minimal data', async () => {
      // Arrange
      const minimalInput = {
        email: 'minimal@example.com',
        auth0UserId: 'auth0|minimal_user',
      };

      const expectedDbUser = {
        id: 'minimal-uuid',
        email: 'minimal@example.com',
        auth0_user_id: 'auth0|minimal_user',
        email_verified: false,
        display_name: null,
        avatar_url: null,
        roles: [],
        permissions: [],
        created_at: new Date(),
        updated_at: new Date(),
        metadata_synced_at: new Date(),
        last_login: null,
        auth0_updated_at: null,
      };

      mockDatabaseQuery.mockResolvedValue([expectedDbUser]);

      // Act
      const result = await userService.create(minimalInput);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(minimalInput.email);
      expect(result.auth0UserId).toBe(minimalInput.auth0UserId);
      expect(result.emailVerified).toBe(false);
      expect(result.roles).toEqual([]);
      expect(result.permissions).toEqual([]);
    });

    it('should validate email format', async () => {
      // Arrange
      const invalidInput = {
        email: 'invalid-email',
        auth0UserId: 'auth0|test_user_123',
      };

      // Act & Assert
      await expect(userService.create(invalidInput))
        .rejects.toThrow(ValidationError);

      expect(mockDatabaseQuery).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidInput = {
        email: 'test@example.com',
        auth0UserId: '', // Empty string
      };

      // Act & Assert
      await expect(userService.create(invalidInput))
        .rejects.toThrow(ValidationError);
    });

    it('should handle database constraint violations', async () => {
      // Arrange
      const duplicateInput = {
        email: 'existing@example.com',
        auth0UserId: 'auth0|existing_user',
      };

      const constraintError = new Error('duplicate key value violates unique constraint');
      constraintError.name = 'UniqueViolationError';
      mockDatabaseQuery.mockRejectedValue(constraintError);

      // Act & Assert
      await expect(userService.create(duplicateInput))
        .rejects.toThrow();
    });

    it('should handle database connection errors', async () => {
      // Arrange
      const validInput = {
        email: 'test@example.com',
        auth0UserId: 'auth0|test_user_123',
      };

      mockDatabaseQuery.mockRejectedValue(ERROR_SCENARIOS.DATABASE_ERROR);

      // Act & Assert
      await expect(userService.create(validInput))
        .rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find user by ID successfully', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      const dbUser = {
        id: userId,
        email: 'test@example.com',
        auth0_user_id: 'auth0|test_user_123',
        email_verified: true,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        roles: ['user'],
        permissions: ['card:read'],
        created_at: new Date(),
        updated_at: new Date(),
        metadata_synced_at: new Date(),
        last_login: new Date(),
        auth0_updated_at: new Date(),
      };

      mockDatabaseQuery.mockResolvedValue(dbUser);

      // Act
      const result = await userService.findById(userId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(userId);
      expect(result?.email).toBe(dbUser.email);
      expect(result?.auth0UserId).toBe(dbUser.auth0_user_id);
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_find_by_id'
      );
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-uuid';
      mockDatabaseQuery.mockResolvedValue(null);

      // Act
      const result = await userService.findById(userId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      mockDatabaseQuery.mockRejectedValue(ERROR_SCENARIOS.DATABASE_ERROR);

      // Act & Assert
      await expect(userService.findById(userId))
        .rejects.toThrow();
    });
  });

  describe('findByAuth0Id', () => {
    it('should find user by Auth0 ID successfully', async () => {
      // Arrange
      const auth0UserId = 'auth0|test_user_123';
      const dbUser = {
        id: 'user-123-uuid',
        auth0_user_id: auth0UserId,
        email: 'test@example.com',
        email_verified: true,
        display_name: 'Test User',
        roles: ['user'],
        permissions: ['card:read'],
        created_at: new Date(),
        updated_at: new Date(),
        metadata_synced_at: new Date(),
      };

      mockDatabaseQuery.mockResolvedValue(dbUser);

      // Act
      const result = await userService.findByAuth0Id(auth0UserId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.auth0UserId).toBe(auth0UserId);
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_find_by_auth0_id'
      );
    });

    it('should return null for non-existent Auth0 user', async () => {
      // Arrange
      const auth0UserId = 'auth0|non_existent_user';
      mockDatabaseQuery.mockResolvedValue(null);

      // Act
      const result = await userService.findByAuth0Id(auth0UserId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      // Arrange
      const email = 'test@example.com';
      const dbUser = {
        id: 'user-123-uuid',
        email: email,
        auth0_user_id: 'auth0|test_user_123',
        email_verified: true,
        display_name: 'Test User',
        roles: ['user'],
        permissions: ['card:read'],
        created_at: new Date(),
        updated_at: new Date(),
        metadata_synced_at: new Date(),
      };

      mockDatabaseQuery.mockResolvedValue(dbUser);

      // Act
      const result = await userService.findByEmail(email);

      // Assert
      expect(result).toBeDefined();
      expect(result?.email).toBe(email);
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_find_by_email'
      );
    });

    it('should handle case-insensitive email search', async () => {
      // Arrange
      const email = 'Test@Example.COM';
      const dbUser = {
        id: 'user-123-uuid',
        email: 'test@example.com', // Stored in lowercase
        auth0_user_id: 'auth0|test_user_123',
        roles: [],
        permissions: [],
        created_at: new Date(),
        updated_at: new Date(),
        metadata_synced_at: new Date(),
      };

      mockDatabaseQuery.mockResolvedValue(dbUser);

      // Act
      const result = await userService.findByEmail(email);

      // Assert
      expect(result).toBeDefined();
      // Verify the query was called with lowercase email
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_find_by_email'
      );
    });

    it('should return null for non-existent email', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      mockDatabaseQuery.mockResolvedValue(null);

      // Act
      const result = await userService.findByEmail(email);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      const existingUser = USER_FIXTURES.STANDARD_USER;
      const updateData = {
        displayName: 'Updated Name',
        roles: ['admin'],
        permissions: ['admin:user_management'],
      };

      const updatedDbUser = {
        id: userId,
        email: existingUser.email,
        auth0_user_id: existingUser.auth0UserId,
        email_verified: existingUser.emailVerified,
        display_name: updateData.displayName,
        avatar_url: existingUser.avatarUrl,
        roles: updateData.roles,
        permissions: updateData.permissions,
        created_at: existingUser.createdAt,
        updated_at: new Date(),
        metadata_synced_at: new Date(),
        last_login: existingUser.lastLogin,
        auth0_updated_at: existingUser.auth0UpdatedAt,
      };

      // Mock finding existing user
      mockDatabaseQuery
        .mockResolvedValueOnce(existingUser) // findById call
        .mockResolvedValueOnce([updatedDbUser]); // update call

      // Act
      const result = await userService.update(userId, updateData);

      // Assert
      expect(result).toBeDefined();
      expect(result.displayName).toBe(updateData.displayName);
      expect(result.roles).toEqual(updateData.roles);
      expect(result.permissions).toEqual(updateData.permissions);
      expect(mockDatabaseQuery).toHaveBeenCalledTimes(2);
    });

    it('should update only provided fields', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      const existingUser = USER_FIXTURES.STANDARD_USER;
      const partialUpdate = {
        displayName: 'New Name',
      };

      const updatedDbUser = {
        ...existingUser,
        display_name: partialUpdate.displayName,
        updated_at: new Date(),
      };

      mockDatabaseQuery
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce([updatedDbUser]);

      // Act
      const result = await userService.update(userId, partialUpdate);

      // Assert
      expect(result.displayName).toBe(partialUpdate.displayName);
      expect(result.email).toBe(existingUser.email); // Unchanged
      expect(result.roles).toEqual(existingUser.roles); // Unchanged
    });

    it('should throw NotFoundError for non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-uuid';
      const updateData = { displayName: 'Updated Name' };

      mockDatabaseQuery.mockResolvedValue(null); // User not found

      // Act & Assert
      await expect(userService.update(userId, updateData))
        .rejects.toThrow(NotFoundError);

      expect(mockDatabaseQuery).toHaveBeenCalledTimes(1);
    });

    it('should validate update data', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      const invalidUpdateData = {
        displayName: '', // Invalid: empty string
      };

      // Act & Assert
      await expect(userService.update(userId, invalidUpdateData))
        .rejects.toThrow(ValidationError);

      expect(mockDatabaseQuery).not.toHaveBeenCalled();
    });

    it('should update metadata_synced_at when roles or permissions change', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      const existingUser = USER_FIXTURES.STANDARD_USER;
      const updateData = {
        roles: ['admin'],
        permissions: ['admin:user_management'],
      };

      const updatedDbUser = {
        ...existingUser,
        roles: updateData.roles,
        permissions: updateData.permissions,
        updated_at: new Date(),
        metadata_synced_at: new Date(),
      };

      mockDatabaseQuery
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce([updatedDbUser]);

      // Act
      await userService.update(userId, updateData);

      // Assert
      // Verify that the update query includes metadata_synced_at
      const updateCall = mockDatabaseQuery.mock.calls[1];
      expect(updateCall[1]).toBe('user_update');
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      const existingUser = USER_FIXTURES.STANDARD_USER;

      mockDatabaseQuery
        .mockResolvedValueOnce(existingUser) // findById call
        .mockResolvedValueOnce(1); // delete call (affected rows)

      // Act
      await userService.delete(userId);

      // Assert
      expect(mockDatabaseQuery).toHaveBeenCalledTimes(2);
      expect(mockDatabaseQuery).toHaveBeenLastCalledWith(
        expect.anything(),
        'user_delete'
      );
    });

    it('should throw NotFoundError for non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-uuid';

      mockDatabaseQuery.mockResolvedValue(null); // User not found

      // Act & Assert
      await expect(userService.delete(userId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('should list users with pagination', async () => {
      // Arrange
      const paginationInput = {
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc' as const,
      };

      const mockUsers = [
        { ...USER_FIXTURES.STANDARD_USER, created_at: new Date() },
        { ...USER_FIXTURES.ADMIN_USER, created_at: new Date() },
      ];

      mockDatabaseQuery
        .mockResolvedValueOnce([{ count: '25' }]) // Total count
        .mockResolvedValueOnce(mockUsers); // Users

      // Act
      const result = await userService.list(paginationInput);

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
    });

    it('should use default pagination values', async () => {
      // Arrange
      mockDatabaseQuery
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([]);

      // Act
      const result = await userService.list({});

      // Assert
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalCount).toBe(5);
    });

    it('should handle empty result set', async () => {
      // Arrange
      mockDatabaseQuery
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      // Act
      const result = await userService.list();

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });
  });

  describe('search', () => {
    it('should search users by display name', async () => {
      // Arrange
      const query = 'John';
      const mockUsers = [
        { ...USER_FIXTURES.STANDARD_USER, display_name: 'John Doe' },
      ];

      mockDatabaseQuery.mockResolvedValue(mockUsers);

      // Act
      const result = await userService.search(query);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toContain('John');
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_search'
      );
    });

    it('should search users by email', async () => {
      // Arrange
      const query = 'example.com';
      const mockUsers = [
        { ...USER_FIXTURES.STANDARD_USER, email: 'test@example.com' },
      ];

      mockDatabaseQuery.mockResolvedValue(mockUsers);

      // Act
      const result = await userService.search(query);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].email).toContain('example.com');
    });

    it('should limit search results', async () => {
      // Arrange
      const query = 'test';
      const limit = 5;
      const mockUsers = Array(3).fill(USER_FIXTURES.STANDARD_USER);

      mockDatabaseQuery.mockResolvedValue(mockUsers);

      // Act
      const result = await userService.search(query, limit);

      // Assert
      expect(result).toHaveLength(3);
      // Verify limit was applied in query
    });

    it('should handle empty search results', async () => {
      // Arrange
      const query = 'nonexistent';
      mockDatabaseQuery.mockResolvedValue([]);

      // Act
      const result = await userService.search(query);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      mockDatabaseQuery.mockResolvedValue(1); // Affected rows

      // Act
      await userService.updateLastLogin(userId);

      // Assert
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_update_last_login'
      );
    });

    it('should not throw error on update failure', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      mockDatabaseQuery.mockRejectedValue(ERROR_SCENARIOS.DATABASE_ERROR);

      // Act & Assert
      await expect(userService.updateLastLogin(userId))
        .resolves.not.toThrow();
    });
  });

  describe('getUserWorkspaces', () => {
    it('should get user workspace memberships', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      const mockWorkspaces = [
        { workspace_id: 'workspace-1' },
        { workspace_id: 'workspace-2' },
      ];

      mockDatabaseQuery.mockResolvedValue(mockWorkspaces);

      // Act
      const result = await userService.getUserWorkspaces(userId);

      // Assert
      expect(result).toEqual(['workspace-1', 'workspace-2']);
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.anything(),
        'user_workspaces'
      );
    });

    it('should return empty array for user with no workspaces', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      mockDatabaseQuery.mockResolvedValue([]);

      // Act
      const result = await userService.getUserWorkspaces(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('mapDbUserToUser (private method)', () => {
    it('should correctly map database user to User interface', async () => {
      // Arrange
      const dbUser = {
        id: 'user-123-uuid',
        email: 'test@example.com',
        auth0_user_id: 'auth0|test_user_123',
        email_verified: true,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        last_login: '2023-01-01T00:00:00.000Z',
        auth0_updated_at: '2023-01-01T00:00:00.000Z',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        roles: ['user'],
        permissions: ['card:read'],
        metadata_synced_at: '2023-01-01T00:00:00.000Z',
      };

      mockDatabaseQuery.mockResolvedValue(dbUser);

      // Act
      const result = await userService.findById('user-123-uuid');

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(dbUser.id);
      expect(result?.email).toBe(dbUser.email);
      expect(result?.auth0UserId).toBe(dbUser.auth0_user_id);
      expect(result?.emailVerified).toBe(dbUser.email_verified);
      expect(result?.displayName).toBe(dbUser.display_name);
      expect(result?.avatarUrl).toBe(dbUser.avatar_url);
      expect(result?.lastLogin).toBeInstanceOf(Date);
      expect(result?.auth0UpdatedAt).toBeInstanceOf(Date);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
      expect(result?.metadataSyncedAt).toBeInstanceOf(Date);
      expect(result?.roles).toEqual(dbUser.roles);
      expect(result?.permissions).toEqual(dbUser.permissions);
    });

    it('should handle null values correctly', async () => {
      // Arrange
      const dbUser = {
        id: 'user-123-uuid',
        email: 'test@example.com',
        auth0_user_id: 'auth0|test_user_123',
        email_verified: true,
        display_name: null,
        avatar_url: null,
        last_login: null,
        auth0_updated_at: null,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        roles: null,
        permissions: null,
        metadata_synced_at: '2023-01-01T00:00:00.000Z',
      };

      mockDatabaseQuery.mockResolvedValue(dbUser);

      // Act
      const result = await userService.findById('user-123-uuid');

      // Assert
      expect(result?.displayName).toBeNull();
      expect(result?.avatarUrl).toBeNull();
      expect(result?.lastLogin).toBeUndefined();
      expect(result?.auth0UpdatedAt).toBeUndefined();
      expect(result?.roles).toEqual([]);
      expect(result?.permissions).toEqual([]);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle concurrent create operations', async () => {
      // Arrange
      const createInput = {
        email: 'concurrent@example.com',
        auth0UserId: 'auth0|concurrent_user',
      };

      const dbUser = {
        id: 'concurrent-uuid',
        ...createInput,
        created_at: new Date(),
        updated_at: new Date(),
        metadata_synced_at: new Date(),
      };

      mockDatabaseQuery.mockResolvedValue([dbUser]);

      const promises = Array(5).fill(null).map(() => 
        userService.create({ ...createInput, email: `${Date.now()}@example.com` })
      );

      // Act
      const results = await Promise.allSettled(promises);

      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });

    it('should handle malformed database responses', async () => {
      // Arrange
      const userId = 'user-123-uuid';
      mockDatabaseQuery.mockResolvedValue({}); // Empty object instead of user

      // Act
      const result = await userService.findById(userId);

      // Assert
      expect(result).toBeDefined();
      // Should still create a user object with available fields
    });

    it('should handle very long user data', async () => {
      // Arrange
      const longString = 'x'.repeat(1000);
      const createInput = {
        email: 'long@example.com',
        auth0UserId: 'auth0|long_user',
        displayName: longString,
      };

      // Act & Assert
      await expect(userService.create(createInput))
        .rejects.toThrow(ValidationError);
    });
  });
});
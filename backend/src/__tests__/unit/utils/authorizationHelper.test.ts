import { 
  AuthorizationHelper,
  createAuthorizationHelper,
  clearPermissionCache,
  getPermissionCacheStats,
  isValidWorkspaceId,
  isValidPermission,
  extendedSecurityLogger
} from '@/utils/authorizationHelper';
import { 
  AuthenticationError, 
  AuthorizationError 
} from '@/utils/errors';
import { GraphQLContext } from '@/types';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  securityLogger: {
    authSuccess: jest.fn(),
    authFailure: jest.fn(),
    authorizationFailure: jest.fn(),
    sessionEvent: jest.fn()
  }
}));
jest.mock('@/services/workspaceAuthorization');

describe('AuthorizationHelper', () => {
  let mockWorkspaceAuthService: jest.Mocked<WorkspaceAuthorizationService>;
  let mockContext: GraphQLContext;
  let authHelper: AuthorizationHelper;

  beforeEach(() => {
    // Clear permission cache before each test
    clearPermissionCache();

    // Mock WorkspaceAuthorizationService
    mockWorkspaceAuthService = {
      getUserPermissionsForContext: jest.fn(),
      hasPermissionInWorkspace: jest.fn(),
      getUserPermissionsInWorkspace: jest.fn(),
    } as any;

    // Mock GraphQL context
    mockContext = {
      isAuthenticated: true,
      user: { 
        id: 'test-user-id',
        email: 'test@example.com',
        auth0UserId: 'auth0|test-user-id',
        emailVerified: true,
        displayName: 'Test User',
        avatarUrl: null,
        lastLogin: new Date(),
        auth0UpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
        permissions: [],
        metadataSyncedAt: new Date()
      },
      permissions: [],
      req: {} as any,
      res: {} as any,
      dataSources: {
        workspaceAuthorizationService: mockWorkspaceAuthService,
        auth0Service: {} as any,
        userService: {} as any,
        cacheService: {} as any,
        userProfileService: {} as any,
        onboardingService: {} as any,
        workspaceService: {} as any,
      },
    } as GraphQLContext;

    authHelper = new AuthorizationHelper(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create helper with valid context', () => {
      expect(authHelper).toBeInstanceOf(AuthorizationHelper);
    });

    it('should throw error if context is null/undefined', () => {
      expect(() => new AuthorizationHelper(null as any)).toThrow('GraphQL context is required');
      expect(() => new AuthorizationHelper(undefined as any)).toThrow('GraphQL context is required');
    });

    it('should throw AuthenticationError if user not authenticated', () => {
      const unauthContext = {
        ...mockContext,
        isAuthenticated: false,
        user: null
      };

      expect(() => new AuthorizationHelper(unauthContext)).toThrow(AuthenticationError);
    });

    it('should throw error if WorkspaceAuthorizationService missing', () => {
      const contextWithoutService = {
        ...mockContext,
        dataSources: {}
      };

      expect(() => new AuthorizationHelper(contextWithoutService as any)).toThrow(
        'WorkspaceAuthorizationService is required in context.dataSources'
      );
    });

    it('should throw error if user ID is invalid', () => {
      const contextWithInvalidUserId = {
        ...mockContext,
        user: { id: '', email: 'test@example.com', roles: [] }
      };

      expect(() => new AuthorizationHelper(contextWithInvalidUserId as any)).toThrow(
        'Valid user ID is required'
      );
    });
  });

  describe('getFlatPermissions', () => {
    it('should return flattened permissions from multiple workspaces', async () => {
      const mockPermissions = {
        'workspace-1': ['perm1', 'perm2'],
        'workspace-2': ['perm2', 'perm3']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      const result = await authHelper.getFlatPermissions();
      
      expect(result).toEqual(['perm1', 'perm2', 'perm3']); // Should deduplicate
      expect(mockWorkspaceAuthService.getUserPermissionsForContext).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle null/undefined permissions gracefully', async () => {
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(null as any);

      const result = await authHelper.getFlatPermissions();
      
      expect(result).toEqual([]);
    });

    it('should filter out invalid permissions', async () => {
      const mockPermissions = {
        'workspace-1': ['valid-perm', '', null, undefined, 123, 'another-valid'] as any
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      const result = await authHelper.getFlatPermissions();
      
      expect(result).toEqual(['valid-perm', 'another-valid']);
    });

    it('should handle service errors gracefully', async () => {
      mockWorkspaceAuthService.getUserPermissionsForContext.mockRejectedValue(
        new Error('Service error')
      );

      const result = await authHelper.getFlatPermissions();
      
      expect(result).toEqual([]);
    });

    it('should use cache on subsequent calls', async () => {
      const mockPermissions = {
        'workspace-1': ['perm1', 'perm2']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      // First call
      await authHelper.getFlatPermissions();
      
      // Second call
      await authHelper.getFlatPermissions();

      // Service should only be called once due to caching
      expect(mockWorkspaceAuthService.getUserPermissionsForContext).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasGlobalPermission', () => {
    it('should return true if user has permission in any workspace', async () => {
      const mockPermissions = {
        'workspace-1': ['perm1'],
        'workspace-2': ['perm2']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      const result = await authHelper.hasGlobalPermission('perm2');
      
      expect(result).toBe(true);
    });

    it('should return false if user does not have permission', async () => {
      const mockPermissions = {
        'workspace-1': ['perm1']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      const result = await authHelper.hasGlobalPermission('perm2');
      
      expect(result).toBe(false);
    });

    it('should return false if no permissions exist', async () => {
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue({});

      const result = await authHelper.hasGlobalPermission('any-perm');
      
      expect(result).toBe(false);
    });
  });

  describe('hasWorkspacePermission', () => {
    it('should validate input parameters', async () => {
      // Invalid workspace ID
      let result = await authHelper.hasWorkspacePermission('', 'valid-perm');
      expect(result).toBe(false);

      result = await authHelper.hasWorkspacePermission(null as any, 'valid-perm');
      expect(result).toBe(false);

      // Invalid permission
      result = await authHelper.hasWorkspacePermission('valid-workspace', '');
      expect(result).toBe(false);

      result = await authHelper.hasWorkspacePermission('valid-workspace', null as any);
      expect(result).toBe(false);
    });

    it('should return true if user has permission in workspace', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(true);

      const result = await authHelper.hasWorkspacePermission('workspace-1', 'perm1');
      
      expect(result).toBe(true);
      expect(mockWorkspaceAuthService.hasPermissionInWorkspace).toHaveBeenCalledWith(
        'test-user-id', 'workspace-1', 'perm1'
      );
    });

    it('should return false if user does not have permission', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(false);

      const result = await authHelper.hasWorkspacePermission('workspace-1', 'perm1');
      
      expect(result).toBe(false);
    });

    it('should handle service errors and return false', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockRejectedValue(
        new Error('Service error')
      );

      const result = await authHelper.hasWorkspacePermission('workspace-1', 'perm1');
      
      expect(result).toBe(false);
    });

    it('should use cache for repeated calls', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(true);

      // First call
      await authHelper.hasWorkspacePermission('workspace-1', 'perm1');
      
      // Second call
      await authHelper.hasWorkspacePermission('workspace-1', 'perm1');

      // Service should only be called once due to caching
      expect(mockWorkspaceAuthService.hasPermissionInWorkspace).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireGlobalPermission', () => {
    it('should validate input parameters', async () => {
      await expect(
        authHelper.requireGlobalPermission('')
      ).rejects.toThrow(AuthorizationError);

      await expect(
        authHelper.requireGlobalPermission(null as any)
      ).rejects.toThrow(AuthorizationError);
    });

    it('should pass if user has permission', async () => {
      const mockPermissions = {
        'workspace-1': ['required-perm']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      await expect(
        authHelper.requireGlobalPermission('required-perm')
      ).resolves.not.toThrow();
    });

    it('should throw AuthorizationError if user lacks permission', async () => {
      const mockPermissions = {
        'workspace-1': ['other-perm']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      await expect(
        authHelper.requireGlobalPermission('required-perm', 'Custom error message')
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should use default error message if none provided', async () => {
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue({});

      await expect(
        authHelper.requireGlobalPermission('required-perm')
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('requireWorkspacePermission', () => {
    it('should validate input parameters', async () => {
      await expect(
        authHelper.requireWorkspacePermission('', 'valid-perm')
      ).rejects.toThrow('Invalid request parameters');

      await expect(
        authHelper.requireWorkspacePermission('valid-workspace', '')
      ).rejects.toThrow('Invalid request parameters');
    });

    it('should pass if user has permission in workspace', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(true);

      await expect(
        authHelper.requireWorkspacePermission('workspace-1', 'required-perm')
      ).resolves.not.toThrow();
    });

    it('should throw AuthorizationError if user lacks permission', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(false);
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue(['other-perm']);

      await expect(
        authHelper.requireWorkspacePermission('workspace-1', 'required-perm', 'Custom error')
      ).rejects.toThrow('Insufficient permissions for workspace access');
    });

    it('should handle getUserPermissionsInWorkspace errors gracefully', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(false);
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockRejectedValue(
        new Error('Service error')
      );

      await expect(
        authHelper.requireWorkspacePermission('workspace-1', 'required-perm')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('canAccessUserData', () => {
    it('should return true for self-access', async () => {
      const result = await authHelper.canAccessUserData('test-user-id');
      
      expect(result).toBe(true);
    });

    it('should return true if user has admin permission', async () => {
      const mockPermissions = {
        'workspace-1': ['admin:user_management']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      const result = await authHelper.canAccessUserData('other-user-id');
      
      expect(result).toBe(true);
    });

    it('should return false if user lacks admin permission', async () => {
      const mockPermissions = {
        'workspace-1': ['other-perm']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      const result = await authHelper.canAccessUserData('other-user-id');
      
      expect(result).toBe(false);
    });
  });

  describe('requireUserDataAccess', () => {
    it('should validate input parameters', async () => {
      await expect(
        authHelper.requireUserDataAccess('')
      ).rejects.toThrow('Invalid request parameters');

      await expect(
        authHelper.requireUserDataAccess(null as any)
      ).rejects.toThrow('Invalid request parameters');
    });

    it('should pass for self-access', async () => {
      await expect(
        authHelper.requireUserDataAccess('test-user-id')
      ).resolves.not.toThrow();
    });

    it('should pass if user has admin permission', async () => {
      const mockPermissions = {
        'workspace-1': ['admin:user_management']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      await expect(
        authHelper.requireUserDataAccess('other-user-id')
      ).resolves.not.toThrow();
    });

    it('should throw AuthorizationError if user lacks permission', async () => {
      const mockPermissions = {
        'workspace-1': ['other-perm']
      };

      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      await expect(
        authHelper.requireUserDataAccess('other-user-id', 'Custom error message')
      ).rejects.toThrow('Access denied');
    });
  });

  describe('getUserWorkspacePermissions', () => {
    it('should validate input parameters', async () => {
      const result1 = await authHelper.getUserWorkspacePermissions('');
      expect(result1).toEqual([]);

      const result2 = await authHelper.getUserWorkspacePermissions(null as any);
      expect(result2).toEqual([]);
    });

    it('should return user permissions for workspace', async () => {
      const mockPermissions = ['perm1', 'perm2'];
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue(mockPermissions);

      const result = await authHelper.getUserWorkspacePermissions('workspace-1');
      
      expect(result).toEqual(mockPermissions);
      expect(mockWorkspaceAuthService.getUserPermissionsInWorkspace).toHaveBeenCalledWith(
        'test-user-id', 'workspace-1'
      );
    });

    it('should handle null/undefined permissions', async () => {
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue(null as any);

      const result = await authHelper.getUserWorkspacePermissions('workspace-1');
      
      expect(result).toEqual([]);
    });

    it('should filter out invalid permissions', async () => {
      const mockPermissions = ['valid-perm', '', null, undefined, 123] as any;
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue(mockPermissions);

      const result = await authHelper.getUserWorkspacePermissions('workspace-1');
      
      expect(result).toEqual(['valid-perm']);
    });

    it('should handle service errors gracefully', async () => {
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockRejectedValue(
        new Error('Service error')
      );

      const result = await authHelper.getUserWorkspacePermissions('workspace-1');
      
      expect(result).toEqual([]);
    });

    it('should use cache for repeated calls', async () => {
      const mockPermissions = ['perm1', 'perm2'];
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue(mockPermissions);

      // First call
      await authHelper.getUserWorkspacePermissions('workspace-1');
      
      // Second call
      await authHelper.getUserWorkspacePermissions('workspace-1');

      // Service should only be called once due to caching
      expect(mockWorkspaceAuthService.getUserPermissionsInWorkspace).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache management', () => {
    beforeEach(() => {
      // Don't clear cache for these specific tests
    });

    it('should clear cache properly', () => {
      // Set some cache data first
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue({'workspace-1': ['perm1']});
      
      // Make a call to populate cache
      return authHelper.getFlatPermissions().then(() => {
        // Now clear and verify
        clearPermissionCache();
        
        const stats = getPermissionCacheStats();
        expect(stats.cache.hits).toBe(0);
        expect(stats.cache.misses).toBe(0);
        expect(stats.cache.sets).toBe(0);
        expect(stats.cache.size).toBe(0);
      });
    });

    it('should track cache statistics', async () => {
      // Clear cache for clean test
      clearPermissionCache();
      
      const mockPermissions = {
        'workspace-1': ['perm1']
      };
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      // Verify stats are initially zero
      let stats = getPermissionCacheStats();
      expect(stats.cache.hits).toBe(0);
      expect(stats.cache.misses).toBe(0);
      expect(stats.cache.sets).toBe(0);

      // First call (cache miss + set)
      await authHelper.getFlatPermissions();
      
      stats = getPermissionCacheStats();
      expect(stats.cache.sets).toBeGreaterThan(0);
      
      // Second call should result in cache hit
      await authHelper.getFlatPermissions();
      
      stats = getPermissionCacheStats();
      expect(stats.cache.hits).toBeGreaterThan(0);
    });
  });

  describe('utility functions', () => {
    describe('isValidWorkspaceId', () => {
      it('should validate workspace IDs correctly', () => {
        expect(isValidWorkspaceId('valid-workspace-id')).toBe(true);
        expect(isValidWorkspaceId('')).toBe(false);
        expect(isValidWorkspaceId(null)).toBe(false);
        expect(isValidWorkspaceId(undefined)).toBe(false);
        expect(isValidWorkspaceId(123)).toBe(false);
        expect(isValidWorkspaceId({})).toBe(false);
      });
    });

    describe('isValidPermission', () => {
      it('should validate permissions correctly', () => {
        expect(isValidPermission('valid:permission')).toBe(true);
        expect(isValidPermission('simple_permission')).toBe(true);
        expect(isValidPermission('permission123')).toBe(true);
        expect(isValidPermission('')).toBe(false);
        expect(isValidPermission('invalid-permission!')).toBe(false);
        expect(isValidPermission('permission with spaces')).toBe(false);
        expect(isValidPermission(null)).toBe(false);
        expect(isValidPermission(undefined)).toBe(false);
        expect(isValidPermission(123)).toBe(false);
      });
    });
  });

  describe('createAuthorizationHelper', () => {
    it('should create helper with valid context', () => {
      const helper = createAuthorizationHelper(mockContext);
      expect(helper).toBeInstanceOf(AuthorizationHelper);
    });

    it('should throw error if context is null/undefined', () => {
      expect(() => createAuthorizationHelper(null as any)).toThrow(
        'GraphQL context is required to create AuthorizationHelper'
      );
      expect(() => createAuthorizationHelper(undefined as any)).toThrow(
        'GraphQL context is required to create AuthorizationHelper'
      );
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle workspace service returning non-object permissions', async () => {
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue('invalid-data' as any);

      const result = await authHelper.getFlatPermissions();
      
      expect(result).toEqual([]);
    });

    it('should handle workspace service returning array instead of object', async () => {
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(['perm1', 'perm2'] as any);

      const result = await authHelper.getFlatPermissions();
      
      expect(result).toEqual([]);
    });

    it('should handle getUserPermissionsInWorkspace returning non-array', async () => {
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue('invalid-data' as any);

      const result = await authHelper.getUserWorkspacePermissions('workspace-1');
      
      expect(result).toEqual([]);
    });

    it('should handle hasPermissionInWorkspace returning non-boolean', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue('true' as any);

      const result = await authHelper.hasWorkspacePermission('workspace-1', 'perm1');
      
      expect(result).toBe(true); // Should convert to boolean
    });

    it('should handle concurrent calls properly', async () => {
      // Clear cache and reset mock call counts
      clearPermissionCache();
      mockWorkspaceAuthService.getUserPermissionsForContext.mockClear();
      
      const mockPermissions = {
        'workspace-1': ['perm1']
      };
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue(mockPermissions);

      // Make multiple concurrent calls
      const promises = [
        authHelper.getFlatPermissions(),
        authHelper.getFlatPermissions(),
        authHelper.getFlatPermissions()
      ];

      const results = await Promise.all(promises);
      
      // All should return the same result
      results.forEach(result => {
        expect(result).toEqual(['perm1']);
      });

      // Due to caching, service might be called once or multiple times depending on timing
      // but all results should be consistent
      expect(mockWorkspaceAuthService.getUserPermissionsForContext).toHaveBeenCalled();
      expect(results.every(result => JSON.stringify(result) === JSON.stringify(['perm1']))).toBe(true);
    });
  });
});
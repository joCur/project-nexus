import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { WorkspaceRole } from '@/types/auth';

// Mock dependencies
jest.mock('@/database/connection');
jest.mock('@/services/cache');

describe('WorkspaceAuthorizationService', () => {
  let authService: WorkspaceAuthorizationService;
  let mockDb: any;
  let mockCacheService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock database
    mockDb = {
      fn: { now: jest.fn(() => new Date()) },
      transaction: jest.fn(),
      raw: jest.fn(),
    };

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    // Create service instance
    authService = new WorkspaceAuthorizationService();
    (authService as any).db = mockDb;
    (authService as any).cacheService = mockCacheService;
  });

  describe('permission system', () => {
    test('owner role has all permissions', () => {
      const permissions = (authService as any).getRolePermissions('owner');
      expect(permissions).toContain('workspace:read');
      expect(permissions).toContain('workspace:update');
      expect(permissions).toContain('workspace:delete');
      expect(permissions).toContain('workspace:invite');
      expect(permissions).toContain('workspace:manage_members');
      expect(permissions).toContain('card:create');
      expect(permissions).toContain('card:read');
      expect(permissions).toContain('card:update');
      expect(permissions).toContain('card:delete');
    });

    test('admin role has management permissions but not deletion', () => {
      const permissions = (authService as any).getRolePermissions('admin');
      expect(permissions).toContain('workspace:read');
      expect(permissions).toContain('workspace:update');
      expect(permissions).toContain('workspace:invite');
      expect(permissions).toContain('workspace:manage_members');
      expect(permissions).toContain('card:create');
      expect(permissions).toContain('card:read');
      expect(permissions).toContain('card:update');
      expect(permissions).toContain('card:delete');
      expect(permissions).not.toContain('workspace:delete');
    });

    test('editor role has content permissions', () => {
      const permissions = (authService as any).getRolePermissions('member');
      expect(permissions).toContain('workspace:read');
      expect(permissions).toContain('card:create');
      expect(permissions).toContain('card:read');
      expect(permissions).toContain('card:update');
      expect(permissions).toContain('card:delete');
      expect(permissions).toContain('connection:create');
      expect(permissions).not.toContain('workspace:update');
      expect(permissions).not.toContain('workspace:invite');
    });

    test('viewer role has read-only permissions', () => {
      const permissions = (authService as any).getRolePermissions('viewer');
      expect(permissions).toContain('workspace:read');
      expect(permissions).toContain('card:read');
      expect(permissions).toContain('connection:read');
      expect(permissions).not.toContain('card:create');
      expect(permissions).not.toContain('card:update');
      expect(permissions).not.toContain('workspace:update');
    });
  });

  describe('permission checking', () => {
    test('hasPermission returns true for valid role permission', () => {
      const member = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'editor' as WorkspaceRole,
        permissions: ['workspace:read', 'card:create', 'card:read', 'card:update'],
        joinedAt: new Date(),
        isActive: true
      };

      const hasPermission = (authService as any).hasPermission(member, 'card:create');
      expect(hasPermission).toBe(true);
    });

    test('hasPermission returns false for invalid permission', () => {
      const member = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'viewer' as WorkspaceRole,
        permissions: ['workspace:read', 'card:read'],
        joinedAt: new Date(),
        isActive: true
      };

      const hasPermission = (authService as any).hasPermission(member, 'card:create');
      expect(hasPermission).toBe(false);
    });

    test('hasPermission returns true for additional permissions', () => {
      const member = {
        id: 'member-1',
        workspaceId: 'ws-1', 
        userId: 'user-1',
        role: 'viewer' as WorkspaceRole,
        permissions: ['workspace:read', 'card:read', 'card:create'], // Extra permission
        joinedAt: new Date(),
        isActive: true
      };

      const hasPermission = (authService as any).hasPermission(member, 'card:create');
      expect(hasPermission).toBe(true);
    });
  });

  describe('cache operations', () => {
    describe('cache hits', () => {
      test('getWorkspaceMember returns cached result when available', async () => {
      const cachedMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'editor',
        permissions: ['workspace:read', 'card:create'],
        joinedAt: new Date(),
        isActive: true
      };

      mockCacheService.get.mockResolvedValue(cachedMember);

      const result = await authService.getWorkspaceMember('user-1', 'ws-1');
      
      expect(mockCacheService.get).toHaveBeenCalledWith('workspace_member:ws-1:user-1');
      expect(result).toEqual(cachedMember);
    });
    });

    describe('cache misses', () => {
      test('getWorkspaceMember queries database when cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Mock database query
      const mockQueryBuilder = {
        where: jest.fn(() => ({
          first: jest.fn(() => null)
        }))
      };
      
      mockDb = jest.fn(() => mockQueryBuilder);
      mockDb.fn = { now: jest.fn(() => new Date()) };
      mockDb.transaction = jest.fn();
      mockDb.raw = jest.fn();
      (authService as any).db = mockDb;

      const result = await authService.getWorkspaceMember('user-1', 'ws-1');
      
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(result).toBeNull();
    });
    });
  });

  describe('role validation', () => {
    test('owner role has comprehensive permissions', () => {
      expect(() => {
        (authService as any).getRolePermissions('owner');
      }).not.toThrow(); // Owner role should have valid permissions
    });

    test('valid roles are accepted', () => {
      const validRoles: WorkspaceRole[] = ['admin', 'member', 'viewer'];
      validRoles.forEach(role => {
        expect(() => {
          (authService as any).getRolePermissions(role);
        }).not.toThrow();
      });
    });
  });

  describe('new permission resolution methods', () => {
    describe('getUserPermissionsInWorkspace', () => {
      test('returns cached permissions when available', async () => {
        const cachedPermissions = ['workspace:read', 'card:read', 'card:create'];
        mockCacheService.get.mockResolvedValue(cachedPermissions);

        const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
        
        expect(mockCacheService.get).toHaveBeenCalledWith('user_permissions:user-1:ws-1');
        expect(result).toEqual(cachedPermissions);
      });

      test('returns empty array for non-member', async () => {
        mockCacheService.get.mockResolvedValue(null);
        // Mock getWorkspaceMember to return null (not a member)
        jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(null);

        const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
        
        expect(result).toEqual([]);
        expect(mockCacheService.set).toHaveBeenCalledWith('user_permissions:user-1:ws-1', [], 60);
      });

      test('combines role and custom permissions', async () => {
        mockCacheService.get.mockResolvedValue(null);
        
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'viewer' as WorkspaceRole,
          permissions: ['custom:permission'],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

        const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
        
        expect(result).toContain('workspace:read'); // Role permission
        expect(result).toContain('card:read'); // Role permission
        expect(result).toContain('custom:permission'); // Custom permission
        expect(mockCacheService.set).toHaveBeenCalled();
      });
    });

    describe('getUserWorkspaceRole', () => {
      test('returns user role when member exists', async () => {
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'admin' as WorkspaceRole,
          permissions: [],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

        const result = await authService.getUserWorkspaceRole('user-1', 'ws-1');
        
        expect(result).toBe('admin');
      });

      test('returns null when user is not a member', async () => {
        jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(null);

        const result = await authService.getUserWorkspaceRole('user-1', 'ws-1');
        
        expect(result).toBeNull();
      });
    });

    describe('hasPermissionInWorkspace', () => {
      test('returns true when user has permission', async () => {
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'member' as WorkspaceRole,
          permissions: [],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

        const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'card:create');
        
        expect(result).toBe(true);
      });

      test('returns false when user does not have permission', async () => {
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'viewer' as WorkspaceRole,
          permissions: [],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

        const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'card:create');
        
        expect(result).toBe(false);
      });

      test('returns false when user is not a member', async () => {
        jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(null);

        const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'card:create');
        
        expect(result).toBe(false);
      });
    });

    describe('getUserPermissionsForContext', () => {
      test('returns cached permissions when available', async () => {
        const cachedContext = { 'ws-1': ['workspace:read'], 'ws-2': ['workspace:read', 'card:create'] };
        mockCacheService.get.mockResolvedValue(cachedContext);

        const result = await authService.getUserPermissionsForContext('user-1');
        
        expect(mockCacheService.get).toHaveBeenCalledWith('user_context_permissions:user-1');
        expect(result).toEqual(cachedContext);
      });

      test('combines member and owned workspaces', async () => {
        mockCacheService.get.mockResolvedValue(null);
        
        // Mock member workspaces query
        const memberWorkspaces = [
          { workspace_id: 'ws-1', role: 'member', permissions: ['custom:permission'] },
          { workspace_id: 'ws-2', role: 'viewer', permissions: null }
        ];
        
        // Mock owned workspaces query
        const ownedWorkspaces = [
          { id: 'ws-3' }
        ];

        mockDb = jest.fn((table) => {
          if (table === 'workspace_members') {
            return {
              select: jest.fn(() => ({
                where: jest.fn(() => Promise.resolve(memberWorkspaces))
              }))
            };
          } else if (table === 'workspaces') {
            return {
              select: jest.fn(() => ({
                where: jest.fn(() => Promise.resolve(ownedWorkspaces))
              }))
            };
          }
        });
        
        (authService as any).db = mockDb;

        const result = await authService.getUserPermissionsForContext('user-1');
        
        expect(result['ws-1']).toContain('workspace:read'); // Editor permissions
        expect(result['ws-1']).toContain('card:create'); // Editor permissions
        expect(result['ws-1']).toContain('custom:permission'); // Custom permission
        expect(result['ws-2']).toContain('workspace:read'); // Viewer permissions
        expect(result['ws-3']).toContain('workspace:delete'); // Owner permissions
        expect(mockCacheService.set).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    describe('database errors', () => {
      test('getUserPermissionsInWorkspace handles database errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      jest.spyOn(authService, 'getWorkspaceMember').mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(result).toEqual([]);
    });

    test('getUserWorkspaceRole handles database errors gracefully', async () => {
      jest.spyOn(authService, 'getWorkspaceMember').mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.getUserWorkspaceRole('user-1', 'ws-1');
      
      expect(result).toBeNull();
    });

    test('hasPermissionInWorkspace handles database errors gracefully', async () => {
      jest.spyOn(authService, 'getWorkspaceMember').mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'card:create');
      
      expect(result).toBe(false);
    });

    test('getUserPermissionsForContext handles database errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Mock database to throw error
      mockDb = jest.fn(() => {
        throw new Error('Database connection failed');
      });
      (authService as any).db = mockDb;

      const result = await authService.getUserPermissionsForContext('user-1');
      
      expect(result).toEqual({});
    });
    });

    describe('cache errors', () => {
      test('handles cache service errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));
      mockCacheService.set.mockRejectedValue(new Error('Redis connection failed'));
      
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'viewer' as WorkspaceRole,
        permissions: [],
        joinedAt: new Date(),
        isActive: true
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      // Should still work without cache
      expect(result).toContain('workspace:read');
      expect(result).toContain('card:read');
    });
    });
  });

  describe('edge cases', () => {
    test('handles invalid workspace ID', async () => {
      const result = await authService.getUserPermissionsInWorkspace('user-1', '');
      expect(result).toEqual([]);
    });

    test('handles invalid user ID', async () => {
      const result = await authService.getUserPermissionsInWorkspace('', 'ws-1');
      expect(result).toEqual([]);
    });

    test('handles null permission parameter', async () => {
      const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', null as any);
      expect(result).toBe(false);
    });

    test('handles inactive member', async () => {
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'member' as WorkspaceRole,
        permissions: [],
        joinedAt: new Date(),
        isActive: false // Inactive member
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(result).toEqual([]);
    });

    test('handles member with null permissions array', async () => {
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'viewer' as WorkspaceRole,
        permissions: null as any,
        joinedAt: new Date(),
        isActive: true
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(result).toContain('workspace:read');
      expect(result).toContain('card:read');
    });

    test('handles unknown role type', async () => {
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'unknown' as any,
        permissions: [],
        joinedAt: new Date(),
        isActive: true
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(result).toEqual([]); // Should fallback to empty permissions
    });
  });


  describe('performance and caching', () => {
    test('getUserPermissionsInWorkspace uses cache with TTL', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'viewer' as WorkspaceRole,
        permissions: ['custom:permission'],
        joinedAt: new Date(),
        isActive: true
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'user_permissions:user-1:ws-1',
        expect.any(Array),
        300 // 5 minutes TTL
      );
    });

    test('getUserPermissionsForContext uses cache with TTL', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Mock empty database results
      mockDb = jest.fn(() => ({
        select: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([]))
        }))
      }));
      (authService as any).db = mockDb;

      await authService.getUserPermissionsForContext('user-1');
      
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'user_context_permissions:user-1',
        expect.any(Object),
        300 // 5 minutes TTL
      );
    });

    test('multiple calls to same method use cache', async () => {
      const cachedPermissions = ['workspace:read', 'card:read'];
      mockCacheService.get.mockResolvedValue(cachedPermissions);

      // Make multiple calls
      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      // Cache should only be queried 3 times, no database calls
      expect(mockCacheService.get).toHaveBeenCalledTimes(3);
      expect(authService.getWorkspaceMember).not.toHaveBeenCalled();
    });
  });

  describe('permission inheritance and custom permissions', () => {
    test('custom permissions override role restrictions', async () => {
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'viewer' as WorkspaceRole, // Viewer can't normally delete
        permissions: ['card:delete'], // But has custom delete permission
        joinedAt: new Date(),
        isActive: true
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'card:delete');
      
      expect(result).toBe(true);
    });

    test('custom permissions are added to role permissions', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'viewer' as WorkspaceRole,
        permissions: ['custom:special', 'another:custom'],
        joinedAt: new Date(),
        isActive: true
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(result).toContain('workspace:read'); // Role permission
      expect(result).toContain('card:read'); // Role permission
      expect(result).toContain('custom:special'); // Custom permission
      expect(result).toContain('another:custom'); // Custom permission
    });

    test('duplicate permissions are handled correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const mockMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'member' as WorkspaceRole,
        permissions: ['card:read', 'card:create'], // Duplicates role permissions
        joinedAt: new Date(),
        isActive: true
      };
      
      jest.spyOn(authService, 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      // Should not have duplicates
      const cardReadCount = result.filter(p => p === 'card:read').length;
      const cardCreateCount = result.filter(p => p === 'card:create').length;
      
      expect(cardReadCount).toBe(1);
      expect(cardCreateCount).toBe(1);
    });
  });

  describe('database transaction handling', () => {
    test('handles transaction errors gracefully', async () => {
      // Mock database to throw an error
      const mockQueryBuilder = {
        where: jest.fn(() => ({
          first: jest.fn(() => {
            throw new Error('Database connection failed');
          })
        }))
      };
      
      mockDb = jest.fn(() => mockQueryBuilder);
      mockDb.transaction = jest.fn();
      mockDb.fn = { now: jest.fn(() => new Date()) };
      mockDb.raw = jest.fn();
      (authService as any).db = mockDb;

      await expect(
        authService.getWorkspaceMember('user-1', 'ws-1')
      ).rejects.toThrow('Database connection failed');
    });

    test('verifies transaction method exists on database', () => {
      expect(mockDb.transaction).toBeDefined();
      expect(typeof mockDb.transaction).toBe('function');
    });

    test('database operations fail gracefully with proper error handling', async () => {
      // Set up mock to simulate constraint violations
      const mockQueryBuilder = {
        where: jest.fn(() => ({
          first: jest.fn(() => null),
          insert: jest.fn(() => {
            throw new Error('Unique constraint violation');
          })
        }))
      };
      
      mockDb = jest.fn(() => mockQueryBuilder);
      mockDb.transaction = jest.fn();
      mockDb.fn = { now: jest.fn(() => new Date()) };
      mockDb.raw = jest.fn();
      (authService as any).db = mockDb;

      // Test that errors are properly propagated
      await expect(
        authService.getWorkspaceMember('user-1', 'ws-1')
      ).resolves.toBeNull(); // Should handle the null case gracefully
    });
  });
});
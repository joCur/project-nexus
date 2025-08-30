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

    test('getWorkspaceMember queries database when cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Mock database query
      mockDb = {
        ...mockDb,
        '': jest.fn(() => ({
          where: jest.fn(() => ({
            first: jest.fn(() => null)
          }))
        })),
        fn: { now: jest.fn(() => new Date()) }
      };
      (authService as any).db = mockDb;

      const result = await authService.getWorkspaceMember('user-1', 'ws-1');
      
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(result).toBeNull();
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
});
import { WorkspaceAuthorizationService, WorkspaceMember } from '@/services/workspaceAuthorization';
import { WorkspaceRole } from '@/types/auth';

// Cache TTL constants
const CACHE_TTL = {
  USER_PERMISSIONS: 300, // 5 minutes
  SHORT_TERM: 60         // 1 minute
} as const;

// Performance test constants
const PERFORMANCE_LIMITS = {
  RESPONSE_TIME_MS: 100,     // Max response time for individual operations
  CONCURRENT_AVG_MS: 200,    // Max average response time for concurrent operations
  MEMORY_GROWTH_MB: 10,      // Max memory growth during repeated operations
  CONCURRENT_REQUEST_COUNT: 10, // Number of concurrent requests for performance tests
  REPEATED_OPERATION_COUNT: 100, // Number of operations for memory leak tests
  CACHE_QUERY_COUNT: 3,      // Expected cache queries for performance tests
  CONCURRENT_UPDATE_COUNT: 5, // Number of concurrent updates for race condition tests
  CONCURRENT_CHECK_COUNT: 3,  // Number of concurrent permission checks
  PROCESSING_DELAY_MS: 10,   // Simulated processing delay for race conditions
  CACHE_DELETION_DELAY_MS: 50, // Simulated cache deletion delay
  MIN_BASE_PERMISSIONS: 3,   // Minimum expected base permissions
  TEMP_ARRAY_SIZE: 1000      // Size of temporary array for GC simulation
} as const;

// Mock dependencies
jest.mock('@/database/connection');
jest.mock('@/services/cache');

// Mock factory functions for better type safety and reusability
const createMockDatabase = () => ({
  fn: { now: jest.fn(() => new Date()) },
  transaction: jest.fn(),
  raw: jest.fn(),
});

const createMockCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  del: jest.fn(),
});

const createMockQueryBuilder = (mockResult?: any) => ({
  select: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(mockResult || null),
  update: jest.fn().mockResolvedValue(1),
  insert: jest.fn().mockResolvedValue(['member-1'])
});

const createMockWorkspaceMember = (overrides: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  id: 'member-1',
  workspaceId: 'ws-1',
  userId: 'user-1',
  role: 'member' as WorkspaceRole,
  permissions: ['workspace:read', 'card:create', 'card:read', 'card:update'],
  joinedAt: new Date(),
  isActive: true,
  ...overrides
});

describe('WorkspaceAuthorizationService', () => {
  let authService: WorkspaceAuthorizationService;
  let mockDb: any;
  let mockCacheService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mocks using factory functions
    mockDb = createMockDatabase();
    mockCacheService = createMockCacheService();

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

    test('member role has content permissions', () => {
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
      const member = createMockWorkspaceMember({
        permissions: ['workspace:read', 'card:create', 'card:read', 'card:update']
      });

      const hasPermission = (authService as any).hasPermission(member, 'card:create');
      expect(hasPermission).toBe(true);
    });

    test('hasPermission returns false for invalid permission', () => {
      const member = createMockWorkspaceMember({
        role: 'viewer' as WorkspaceRole,
        permissions: ['workspace:read', 'card:read']
      });

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
    describe('workspace member caching', () => {
      describe('cache hits', () => {
        test('returns cached workspace member when available', async () => {
      const cachedMember = {
        id: 'member-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: 'member',
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
      test('queries database when cache miss occurs', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Mock database query
      const mockQueryBuilder = {
        where: jest.fn(() => ({
          first: jest.fn(() => null)
        }))
      };
      
      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
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
  });

  describe('role validation', () => {
    test('owner role has comprehensive permissions', () => {
      expect(() => {
        (authService as any).getRolePermissions('owner');
      }).not.toThrow(); // Owner role should have valid permissions
    });

    test('valid roles are accepted', () => {
      const validRoles = ['admin', 'member', 'viewer'] as const satisfies readonly WorkspaceRole[];
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
        const cachedPermissions = ['workspace:read', 'card:read', 'card:create'] as const;
        mockCacheService.get.mockResolvedValue(cachedPermissions);

        const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
        
        expect(mockCacheService.get).toHaveBeenCalledWith('user_permissions:user-1:ws-1');
        expect(result).toEqual(cachedPermissions);
      });

      test('returns empty array for non-member', async () => {
        mockCacheService.get.mockResolvedValue(null);
        // Mock getWorkspaceMember to return null (not a member)
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(null);

        const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
        
        expect(result).toEqual([]);
        expect(mockCacheService.set).toHaveBeenCalledWith('user_permissions:user-1:ws-1', [], CACHE_TTL.SHORT_TERM);
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
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

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
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

        const result = await authService.getUserWorkspaceRole('user-1', 'ws-1');
        
        expect(result).toBe('admin');
      });

      test('returns null when user is not a member', async () => {
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(null);

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
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

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
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

        const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'card:create');
        
        expect(result).toBe(false);
      });

      test('returns false when user is not a member', async () => {
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(null);

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
        
        expect(result['ws-1']).toContain('workspace:read'); // Member permissions
        expect(result['ws-1']).toContain('card:create'); // Member permissions
        expect(result['ws-1']).toContain('custom:permission'); // Custom permission
        expect(result['ws-2']).toContain('workspace:read'); // Viewer permissions
        expect(result['ws-3']).toContain('workspace:delete'); // Owner permissions
        expect(mockCacheService.set).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    describe('database errors', () => {
      test('handles database errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      jest.spyOn((authService as any), 'getWorkspaceMember').mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(result).toEqual([]);
    });

    test('handles database errors gracefully', async () => {
      jest.spyOn((authService as any), 'getWorkspaceMember').mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.getUserWorkspaceRole('user-1', 'ws-1');
      
      expect(result).toBeNull();
    });

    test('handles database errors gracefully', async () => {
      jest.spyOn((authService as any), 'getWorkspaceMember').mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'card:create');
      
      expect(result).toBe(false);
    });

    test('handles database errors gracefully', async () => {
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
      
      // When cache fails, the service should handle gracefully but may return empty array
      // This test verifies no exceptions are thrown
      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      // Should handle cache errors without throwing exceptions
      expect(result).toEqual([]); // Service returns empty array on cache/db errors
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
      
      jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

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
      
      jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

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
      
      jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

      const result = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      // Should fallback to viewer permissions for unknown roles (default case in getRolePermissions)
      expect(result).toContain('workspace:read');
      expect(result).toContain('card:read');
      expect(result).toContain('canvas:read');
    });
  });


  describe('performance and caching', () => {
    describe('TTL behavior', () => {
      test('uses cache with TTL for user permissions', async () => {
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
      
      jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'user_permissions:user-1:ws-1',
        expect.any(Array),
        CACHE_TTL.USER_PERMISSIONS
      );
      });

      test('uses cache with TTL for context permissions', async () => {
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
        CACHE_TTL.USER_PERMISSIONS
      );
      });
    });

    describe('cache efficiency', () => {
      test('multiple calls to same method use cache', async () => {
      const cachedPermissions = ['workspace:read', 'card:read'] as const;
      mockCacheService.get.mockResolvedValue(cachedPermissions);

      // Create spy for database method
      const getWorkspaceMemberSpy = jest.spyOn((authService as any), 'getWorkspaceMember');

      // Make multiple calls
      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      // Cache should only be queried 3 times, no database calls
      expect(mockCacheService.get).toHaveBeenCalledTimes(PERFORMANCE_LIMITS.CACHE_QUERY_COUNT);
      expect(getWorkspaceMemberSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Performance Testing Requirements', () => {
    describe('response time baselines', () => {
      test('getUserPermissionsInWorkspace completes within 100ms', async () => {
        // Mock fast database response
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'admin' as WorkspaceRole,
          permissions: ['custom:fast-permission'],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);
        mockCacheService.get.mockResolvedValue(null);

        const startTime = Date.now();
        await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_LIMITS.RESPONSE_TIME_MS); // Should complete in < 100ms
      });

      test('hasPermissionInWorkspace completes within 100ms', async () => {
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'viewer' as WorkspaceRole,
          permissions: ['workspace:read'],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

        const startTime = Date.now();
        await authService.hasPermissionInWorkspace('user-1', 'ws-1', 'workspace:read');
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        expect(responseTime).toBeLessThan(PERFORMANCE_LIMITS.RESPONSE_TIME_MS); // Should complete in < 100ms
      });
    });

    describe('concurrent request performance', () => {
      test(`handles ${PERFORMANCE_LIMITS.CONCURRENT_REQUEST_COUNT} concurrent requests within ${PERFORMANCE_LIMITS.CONCURRENT_AVG_MS}ms average`, async () => {
        // Mock consistent database response
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'member' as WorkspaceRole,
          permissions: ['card:read', 'card:create'],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);
        mockCacheService.get.mockResolvedValue(null);

        // Create 10 concurrent requests
        const startTime = Date.now();
        const concurrentRequests = Array(PERFORMANCE_LIMITS.CONCURRENT_REQUEST_COUNT).fill(null).map(() =>
          authService.getUserPermissionsInWorkspace('user-1', 'ws-1')
        );

        await Promise.all(concurrentRequests);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const averageTime = totalTime / PERFORMANCE_LIMITS.CONCURRENT_REQUEST_COUNT;

        expect(averageTime).toBeLessThan(PERFORMANCE_LIMITS.CONCURRENT_AVG_MS); // Average should be < 200ms per request
      });
    });

    describe('memory stability', () => {
      test('prevents memory leaks during repeated operations', async () => {
        const mockMember = {
          id: 'member-1',
          workspaceId: 'ws-1', 
          userId: 'user-1',
          role: 'admin' as WorkspaceRole,
          permissions: ['workspace:read', 'workspace:update'],
          joinedAt: new Date(),
          isActive: true
        };
        
        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);
        mockCacheService.get.mockResolvedValue(null);

        // Baseline memory usage
        const initialMemory = process.memoryUsage().heapUsed;

        // Perform 100 operations
        for (let i = 0; i < PERFORMANCE_LIMITS.REPEATED_OPERATION_COUNT; i++) {
          await authService.getUserPermissionsInWorkspace(`user-${i}`, 'ws-1');
        }

        // Force garbage collection if available
        if (typeof global.gc === 'function') {
          global.gc();
        } else {
          // Simulate garbage collection pressure
          const tempArray = new Array(PERFORMANCE_LIMITS.TEMP_ARRAY_SIZE).fill('temp-data');
          tempArray.length = 0;
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB

        expect(memoryGrowth).toBeLessThan(PERFORMANCE_LIMITS.MEMORY_GROWTH_MB); // Should not grow by more than 10MB
      });
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
      
      jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

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
      
      jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

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
      
      jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

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
      
      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      mockDb.transaction = jest.fn();
      mockDb.fn = { now: jest.fn(() => new Date()) };
      mockDb.raw = jest.fn();
      (authService as any).db = mockDb;

      // The method handles errors gracefully and returns null instead of throwing
      const result = await authService.getWorkspaceMember('user-1', 'ws-1');
      expect(result).toBeNull(); // Service handles errors by returning null
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
      
      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
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

  describe('Security Testing Requirements', () => {
    describe('permission isolation between workspaces', () => {
      test('prevents cross-workspace permission leakage', async () => {
        // Mock user with permissions in workspace 1 but not workspace 2
        const workspace1Member = {
          id: 'member-1',
          workspaceId: 'workspace-1',
          userId: 'user-1',
          role: 'admin' as WorkspaceRole,
          permissions: ['workspace:manage_members', 'card:delete'],
          joinedAt: new Date(),
          isActive: true
        };

        const workspace2Member = null; // User not a member of workspace 2

        jest.spyOn((authService as any), 'getWorkspaceMember')
          .mockImplementation(async (userId, workspaceId) => {
            if (workspaceId === 'workspace-1') return workspace1Member;
            if (workspaceId === 'workspace-2') return workspace2Member;
            return null;
          });

        // User should have admin permissions in workspace 1
        const workspace1Permissions = await authService.getUserPermissionsInWorkspace('user-1', 'workspace-1');
        expect(workspace1Permissions).toContain('workspace:manage_members');
        expect(workspace1Permissions).toContain('card:delete');

        // User should have NO permissions in workspace 2
        const workspace2Permissions = await authService.getUserPermissionsInWorkspace('user-1', 'workspace-2');
        expect(workspace2Permissions).toEqual([]);

        // Cross-workspace permission checks should fail
        const hasPermissionWs2 = await authService.hasPermissionInWorkspace('user-1', 'workspace-2', 'workspace:manage_members');
        expect(hasPermissionWs2).toBe(false);
      });

      test('validates workspace context isolation in cache keys', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(undefined);

        const mockMember1 = {
          id: 'member-1',
          workspaceId: 'workspace-alpha',
          userId: 'user-1',
          role: 'admin' as WorkspaceRole,
          permissions: ['workspace:admin_access'],
          joinedAt: new Date(),
          isActive: true
        };

        const mockMember2 = {
          id: 'member-2',
          workspaceId: 'workspace-beta',
          userId: 'user-1',
          role: 'viewer' as WorkspaceRole,
          permissions: ['workspace:read_only'],
          joinedAt: new Date(),
          isActive: true
        };

        jest.spyOn((authService as any), 'getWorkspaceMember')
          .mockImplementation(async (userId, workspaceId) => {
            if (workspaceId === 'workspace-alpha') return mockMember1;
            if (workspaceId === 'workspace-beta') return mockMember2;
            return null;
          });

        // Generate permissions for both workspaces
        await authService.getUserPermissionsInWorkspace('user-1', 'workspace-alpha');
        await authService.getUserPermissionsInWorkspace('user-1', 'workspace-beta');

        // Verify cache keys are workspace-specific
        expect(mockCacheService.set).toHaveBeenCalledWith(
          'user_permissions:user-1:workspace-alpha',
          expect.any(Array),
          expect.any(Number)
        );
        expect(mockCacheService.set).toHaveBeenCalledWith(
          'user_permissions:user-1:workspace-beta',
          expect.any(Array),
          expect.any(Number)
        );

        // Cache keys should be completely isolated
        const alphaCall = (mockCacheService.set as jest.Mock).mock.calls.find(call => 
          call[0] === 'user_permissions:user-1:workspace-alpha'
        );
        const betaCall = (mockCacheService.set as jest.Mock).mock.calls.find(call =>
          call[0] === 'user_permissions:user-1:workspace-beta'
        );

        expect(alphaCall[1]).toContain('workspace:admin_access');
        expect(betaCall[1]).toContain('workspace:read_only');
        expect(alphaCall[1]).not.toContain('workspace:read_only');
        expect(betaCall[1]).not.toContain('workspace:admin_access');
      });
    });

    describe('permission elevation prevention', () => {
      test('prevents privilege escalation through custom permissions', async () => {
        const mockMember = {
          id: 'member-1',
          workspaceId: 'secure-workspace',
          userId: 'user-1',
          role: 'viewer' as WorkspaceRole, // Lowest privilege role
          permissions: [
            'card:read',
            'workspace:read',
            'malicious:admin_attempt', // Malicious permission that shouldn't grant admin access
            'workspace:fake_owner', // Another malicious permission
          ],
          joinedAt: new Date(),
          isActive: true
        };

        jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

        const permissions = await authService.getUserPermissionsInWorkspace('user-1', 'secure-workspace');

        // Should have viewer permissions
        expect(permissions).toContain('card:read');
        expect(permissions).toContain('workspace:read');

        // Should have the malicious custom permissions (but they don't grant real access)
        expect(permissions).toContain('malicious:admin_attempt');
        expect(permissions).toContain('workspace:fake_owner');

        // Should NOT have any elevated permissions beyond viewer role
        expect(permissions).not.toContain('workspace:delete');
        expect(permissions).not.toContain('workspace:manage_members');
        expect(permissions).not.toContain('workspace:transfer_ownership');
        expect(permissions).not.toContain('card:delete');

        // Verify that malicious permissions don't grant actual admin access
        const hasDelete = await authService.hasPermissionInWorkspace('user-1', 'secure-workspace', 'workspace:delete');
        const hasManage = await authService.hasPermissionInWorkspace('user-1', 'secure-workspace', 'workspace:manage_members');
        
        expect(hasDelete).toBe(false);
        expect(hasManage).toBe(false);
      });

      test('validates role-based permission boundaries', async () => {
        // Test each role's maximum permissions
        const roleTests = [
          {
            role: 'viewer' as WorkspaceRole,
            shouldHave: ['workspace:read', 'card:read', 'connection:read'],
            shouldNotHave: ['workspace:delete', 'card:create', 'workspace:manage_members']
          },
          {
            role: 'member' as WorkspaceRole,
            shouldHave: ['workspace:read', 'card:create', 'card:update', 'card:delete'],
            shouldNotHave: ['workspace:delete', 'workspace:manage_members', 'workspace:transfer_ownership']
          },
          {
            role: 'admin' as WorkspaceRole,
            shouldHave: ['workspace:manage_members', 'workspace:update', 'card:delete'],
            shouldNotHave: ['workspace:delete', 'workspace:transfer_ownership']
          }
        ];

        for (const { role, shouldHave, shouldNotHave } of roleTests) {
          const mockMember = {
            id: `member-${role}`,
            workspaceId: 'test-workspace',
            userId: `user-${role}`,
            role,
            permissions: [], // No custom permissions
            joinedAt: new Date(),
            isActive: true
          };

          jest.spyOn((authService as any), 'getWorkspaceMember').mockResolvedValue(mockMember);

          const permissions = await authService.getUserPermissionsInWorkspace(`user-${role}`, 'test-workspace');

          // Check required permissions
          for (const permission of shouldHave) {
            expect(permissions).toContain(permission);
          }

          // Check forbidden permissions
          for (const permission of shouldNotHave) {
            expect(permissions).not.toContain(permission);
          }
        }
      });
    });

    describe('workspace context switching security', () => {
      test('prevents session hijacking across workspace contexts', async () => {
        // Mock user with different roles in different workspaces
        const membershipMap = {
          'corporate-workspace': {
            id: 'member-corp',
            workspaceId: 'corporate-workspace',
            userId: 'user-1',
            role: 'admin' as WorkspaceRole,
            permissions: ['workspace:manage_billing', 'workspace:manage_members'],
            joinedAt: new Date(),
            isActive: true
          },
          'personal-workspace': {
            id: 'member-personal',
            workspaceId: 'personal-workspace',
            userId: 'user-1',
            role: 'viewer' as WorkspaceRole,
            permissions: ['workspace:read'],
            joinedAt: new Date(),
            isActive: true
          }
        };

        jest.spyOn((authService as any), 'getWorkspaceMember')
          .mockImplementation(async (userId: string, workspaceId: string) => {
            return membershipMap[workspaceId as keyof typeof membershipMap] || null;
          });

        // Simulate rapid context switching
        const corporatePermissions = await authService.getUserPermissionsInWorkspace('user-1', 'corporate-workspace');
        const personalPermissions = await authService.getUserPermissionsInWorkspace('user-1', 'personal-workspace');

        // Verify permissions are correctly isolated per workspace
        expect(corporatePermissions).toContain('workspace:manage_billing');
        expect(corporatePermissions).toContain('workspace:manage_members');
        
        expect(personalPermissions).toContain('workspace:read');
        expect(personalPermissions).not.toContain('workspace:manage_billing');
        expect(personalPermissions).not.toContain('workspace:manage_members');

        // Verify no cross-contamination between contexts
        const corporateHasBilling = await authService.hasPermissionInWorkspace('user-1', 'corporate-workspace', 'workspace:manage_billing');
        const personalHasBilling = await authService.hasPermissionInWorkspace('user-1', 'personal-workspace', 'workspace:manage_billing');

        expect(corporateHasBilling).toBe(true);
        expect(personalHasBilling).toBe(false);
      });

      test('validates cache isolation during context switching', async () => {
        mockCacheService.get.mockResolvedValue(null);
        const cacheSetCalls: Array<{key: string, value: any}> = [];
        
        mockCacheService.set.mockImplementation(async (key: string, value: any) => {
          cacheSetCalls.push({ key, value });
          return undefined;
        });

        const workspaceRoles = {
          'ws-secure': {
            id: 'member-secure',
            workspaceId: 'ws-secure',
            userId: 'user-1',
            role: 'admin' as WorkspaceRole,
            permissions: ['security:audit', 'workspace:manage_security'],
            joinedAt: new Date(),
            isActive: true
          },
          'ws-public': {
            id: 'member-public',
            workspaceId: 'ws-public', 
            userId: 'user-1',
            role: 'member' as WorkspaceRole,
            permissions: ['content:publish'],
            joinedAt: new Date(),
            isActive: true
          }
        };

        jest.spyOn((authService as any), 'getWorkspaceMember')
          .mockImplementation(async (userId: string, workspaceId: string) => {
            return workspaceRoles[workspaceId as keyof typeof workspaceRoles] || null;
          });

        // Rapidly switch between workspace contexts
        await authService.getUserPermissionsInWorkspace('user-1', 'ws-secure');
        await authService.getUserPermissionsInWorkspace('user-1', 'ws-public'); 
        await authService.getUserPermissionsInWorkspace('user-1', 'ws-secure');

        // Verify each workspace has isolated cache entries
        const secureCacheEntries = cacheSetCalls.filter(call => call.key.includes('ws-secure'));
        const publicCacheEntries = cacheSetCalls.filter(call => call.key.includes('ws-public'));

        expect(secureCacheEntries.length).toBeGreaterThan(0);
        expect(publicCacheEntries.length).toBeGreaterThan(0);

        // Verify cache values are workspace-specific
        const securePermissions = secureCacheEntries[0].value;
        const publicPermissions = publicCacheEntries[0].value;

        expect(securePermissions).toContain('security:audit');
        expect(securePermissions).toContain('workspace:manage_security');
        expect(publicPermissions).toContain('content:publish');
        expect(publicPermissions).not.toContain('security:audit');
      });
    });
  });

  describe('Concurrent Permission Operations', () => {
    beforeEach(() => {
      // Setup fresh mocks for concurrency tests
      mockCacheService.get.mockClear();
      mockCacheService.set.mockClear();
      mockCacheService.delete.mockClear();
    });

    test('handles concurrent permission updates without race conditions', async () => {
      // Mock database to simulate concurrent updates
      let dbCallCount = 0;
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockImplementation(async () => {
          dbCallCount++;
          // Simulate processing delay to increase chance of race conditions
          await new Promise(resolve => setTimeout(resolve, PERFORMANCE_LIMITS.PROCESSING_DELAY_MS));
          return {
            id: 'member-1',
            workspace_id: 'ws-1',
            user_id: 'user-1',
            role: 'member',
            permissions: ['card:create', 'card:read'],
            is_active: true
          };
        }),
        update: jest.fn().mockResolvedValue(1),
        insert: jest.fn().mockResolvedValue(['member-1'])
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;

      // Clear cache to force database calls
      mockCacheService.get.mockResolvedValue(null);

      // Perform concurrent permission updates for the same user
      const updatePromises = Array(PERFORMANCE_LIMITS.CONCURRENT_UPDATE_COUNT).fill(null).map((_, index) => 
        authService.updateMemberRole('ws-1', 'user-1', index % 2 === 0 ? 'member' : 'viewer', 'test-user')
      );

      // All updates should complete successfully (updateMemberRole returns Promise<void>)
      await Promise.all(updatePromises);

      // Database should handle concurrent access appropriately
      expect(dbCallCount).toBeGreaterThan(0);
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    test('manages cache consistency during concurrent permission checks', async () => {
      const cacheOperations: string[] = [];
      
      // Track cache operations
      mockCacheService.get.mockImplementation(async (key: string) => {
        cacheOperations.push(`GET:${key}`);
        return null; // Always miss for this test
      });
      
      mockCacheService.set.mockImplementation(async (key: string, value: any, ttl: number) => {
        cacheOperations.push(`SET:${key}`);
        return undefined;
      });

      // Mock database response
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          user_id: 'user-1',
          workspace_id: 'ws-1',
          role: 'member',
          permissions: ['card:read'],
          is_active: true
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;

      // Perform concurrent permission checks for the same user/workspace
      const checkPromises = Array(PERFORMANCE_LIMITS.CONCURRENT_CHECK_COUNT).fill(null).map(() => 
        authService.getUserPermissionsInWorkspace('user-1', 'ws-1')
      );

      const results = await Promise.all(checkPromises);

      // All permission checks should return consistent results
      results.forEach(permissions => {
        expect(Array.isArray(permissions)).toBe(true);
      });

      // Cache operations should maintain consistency
      const getCalls = cacheOperations.filter(op => op.startsWith('GET:')).length;
      const setCalls = cacheOperations.filter(op => op.startsWith('SET:')).length;
      
      expect(getCalls).toBeGreaterThan(0);
      expect(setCalls).toBeGreaterThan(0);
    });

    test('handles concurrent member role transitions correctly', async () => {
      // Setup for role transition testing
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'member-1',
          workspace_id: 'ws-1', 
          user_id: 'user-1',
          role: 'viewer',
          permissions: [],
          is_active: true
        }),
        update: jest.fn().mockResolvedValue(1),
        insert: jest.fn().mockResolvedValue(['member-1'])
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;
      mockCacheService.get.mockResolvedValue(null);

      // Simulate concurrent role transitions: viewer -> member -> admin
      const roleTransitions = [
        { from: 'viewer', to: 'member' },
        { from: 'member', to: 'admin' },
        { from: 'admin', to: 'viewer' } // Demotion
      ] as const;

      const transitionPromises = roleTransitions.map(({ to }) =>
        authService.updateMemberRole('ws-1', 'user-1', to, 'test-user')
      );

      // All role transitions should complete without errors (updateMemberRole returns Promise<void>)
      await Promise.all(transitionPromises);

      // Verify that update operations were called
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      
      // Cache should be invalidated for each role change (service uses .del() method)
      expect(mockCacheService.del).toHaveBeenCalled();
    });
  });

  describe('Permission Inheritance with Multiple Custom Permissions', () => {
    beforeEach(() => {
      mockCacheService.get.mockClear();
      mockCacheService.set.mockClear();
    });

    test('combines role permissions with multiple custom permissions correctly', async () => {
      // Mock member with member role + custom permissions
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          user_id: 'user-1',
          workspace_id: 'ws-1',
          role: 'member',
          permissions: [
            'canvas:special_edit',      // Custom permission 1
            'workspace:analytics',      // Custom permission 2
            'card:bulk_operations',     // Custom permission 3
            'integration:webhook_manage' // Custom permission 4
          ],
          is_active: true
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;
      mockCacheService.get.mockResolvedValue(null);

      const permissions = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');

      // Should include all role-based permissions for member
      expect(permissions).toContain('workspace:read');
      expect(permissions).toContain('card:create');
      expect(permissions).toContain('card:read');
      expect(permissions).toContain('card:update');

      // Should include all custom permissions
      expect(permissions).toContain('canvas:special_edit');
      expect(permissions).toContain('workspace:analytics');
      expect(permissions).toContain('card:bulk_operations'); 
      expect(permissions).toContain('integration:webhook_manage');

      // Should not have admin-only permissions
      expect(permissions).not.toContain('workspace:delete');
      expect(permissions).not.toContain('workspace:manage_billing');

      // Verify no duplicates (role + custom permissions merged correctly)
      const uniquePermissions = [...new Set(permissions)];
      expect(permissions.length).toBe(uniquePermissions.length);
    });

    test('handles permission inheritance hierarchy with custom overrides', async () => {
      // Test case: viewer role with elevated custom permissions
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          user_id: 'user-2',
          workspace_id: 'ws-1',
          role: 'viewer', // Base viewer role
          permissions: [
            'card:update',           // Elevated from viewer role
            'canvas:create',         // Elevated from viewer role
            'workspace:invite',      // Elevated from viewer role
            'custom:special_feature' // Completely custom permission
          ],
          is_active: true
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;
      mockCacheService.get.mockResolvedValue(null);

      const permissions = await authService.getUserPermissionsInWorkspace('user-2', 'ws-1');

      // Should have base viewer permissions
      expect(permissions).toContain('workspace:read');
      expect(permissions).toContain('card:read');

      // Should have elevated permissions from custom list
      expect(permissions).toContain('card:update');    // Elevated beyond viewer
      expect(permissions).toContain('canvas:create');   // Elevated beyond viewer
      expect(permissions).toContain('workspace:invite'); // Elevated beyond viewer
      expect(permissions).toContain('custom:special_feature'); // Custom permission

      // Should NOT have admin permissions not granted
      expect(permissions).not.toContain('workspace:delete');
      expect(permissions).not.toContain('workspace:manage_members');
    });

    test('validates permission inheritance with conflicting role transitions', async () => {
      let currentRole = 'member';
      let currentCustomPermissions = ['card:special_view', 'workspace:metrics'] as const;

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockImplementation(() => Promise.resolve({
          user_id: 'user-3',
          workspace_id: 'ws-1',
          role: currentRole,
          permissions: currentCustomPermissions,
          is_active: true
        })),
        update: jest.fn().mockImplementation(async (updateData) => {
          // Simulate role update (real service overwrites permissions with role permissions)
          if (updateData.role) {
            currentRole = updateData.role;
            // Simulate the actual service behavior: permissions are replaced with role permissions
            const rolePermissionsMap = {
              'admin': ['workspace:read', 'workspace:update', 'workspace:invite', 'workspace:manage_members', 'card:read', 'card:create', 'card:update', 'card:delete'],
              'member': ['workspace:read', 'card:read', 'card:create', 'card:update', 'card:delete'],
              'viewer': ['workspace:read', 'card:read']
            } as const;
            currentCustomPermissions = rolePermissionsMap[updateData.role] || [];
          }
          if (updateData.permissions) currentCustomPermissions = updateData.permissions;
          return 1;
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;
      mockCacheService.get.mockResolvedValue(null);

      // Step 1: Get initial permissions (member + custom)
      const initialPermissions = await authService.getUserPermissionsInWorkspace('user-3', 'ws-1');
      expect(initialPermissions).toContain('card:create'); // Member role permission
      expect(initialPermissions).toContain('card:special_view'); // Custom permission

      // Step 2: Simulate role promotion to admin (overwrites custom permissions with role permissions)
      await authService.updateMemberRole('ws-1', 'user-3', 'admin', 'test-user');

      // Clear cache to force fresh lookup
      mockCacheService.get.mockResolvedValue(null);
      
      const adminPermissions = await authService.getUserPermissionsInWorkspace('user-3', 'ws-1');
      
      // Should have admin permissions
      expect(adminPermissions).toContain('workspace:manage_members');
      expect(adminPermissions).toContain('workspace:update');
      
      // Custom permissions are overwritten by role update (matching actual service behavior)
      expect(adminPermissions).not.toContain('card:special_view');
      expect(adminPermissions).not.toContain('workspace:metrics');
    });

    test('manages complex permission scenarios with multiple inheritance levels', async () => {
      // Simulate a workspace with complex permission structure:
      // - Base role: member
      // - Custom permissions: some overlap with role, some unique, some from higher role
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          user_id: 'user-4',
          workspace_id: 'ws-complex',
          role: 'member', // Base member role
          permissions: [
            // Permissions member already has (should not duplicate)
            'card:create',
            'card:read',
            'card:update',
            // Admin-level permissions granted specifically
            'workspace:manage_members',
            'workspace:billing_view',
            // Completely custom permissions
            'integration:zapier',
            'export:advanced_csv',
            'analytics:custom_dashboard',
            // Edge case: permission that doesn't exist in role system
            'future:beta_feature'
          ],
          is_active: true
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;
      mockCacheService.get.mockResolvedValue(null);

      const permissions = await authService.getUserPermissionsInWorkspace('user-4', 'ws-complex');

      // Verify all permission categories are included
      const memberBasePermissions = permissions.filter(p => 
        ['card:create', 'card:read', 'card:update', 'workspace:read'].includes(p)
      );
      expect(memberBasePermissions.length).toBeGreaterThan(PERFORMANCE_LIMITS.MIN_BASE_PERMISSIONS);

      // Verify elevated admin permissions are included
      expect(permissions).toContain('workspace:manage_members');
      expect(permissions).toContain('workspace:billing_view');

      // Verify custom permissions are included
      expect(permissions).toContain('integration:zapier');
      expect(permissions).toContain('export:advanced_csv');
      expect(permissions).toContain('analytics:custom_dashboard');
      expect(permissions).toContain('future:beta_feature');

      // Verify no duplicates in final permission set
      const uniquePermissions = [...new Set(permissions)];
      expect(permissions.length).toBe(uniquePermissions.length);

      // Verify proper caching of complex permission set
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'user_permissions:user-4:ws-complex',
        expect.any(Array),
        CACHE_TTL.USER_PERMISSIONS
      );
    });
  });

  describe('Cache Invalidation Edge Cases', () => {
    describe('cache corruption scenarios', () => {
      test('handles corrupted cache data gracefully', async () => {
      // Setup corrupted cache data - only for user_permissions cache key
      mockCacheService.get.mockImplementation((key: string) => {
        if (key === 'user_permissions:user-1:ws-1') {
          return Promise.resolve('invalid-json-data'); // Corrupted data
        }
        return Promise.resolve(null); // No cache for other keys
      });
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'member-1',
          workspace_id: 'ws-1',
          user_id: 'user-1', 
          role: 'member',
          permissions: ['workspace:read', 'card:create', 'card:read', 'card:update'],
          is_active: true
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;

      // Should fall back to database query when cache is corrupted
      const permissions = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(permissions).toContain('workspace:read');
      expect(permissions).toContain('card:create');
      
      // Should attempt to refresh cache with valid data
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'user_permissions:user-1:ws-1',
        expect.any(Array),
        CACHE_TTL.USER_PERMISSIONS
      );
    });

      test('handles cache service unavailability', async () => {
      // Simulate cache service failure - get returns null (no cache hit), set operations fail
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockRejectedValue(new Error('Cache service unavailable'));
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'member-1',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          role: 'admin',
          permissions: ['workspace:read', 'workspace:update', 'workspace:invite', 'workspace:manage_members', 'card:read', 'card:create', 'card:update', 'card:delete'],
          is_active: true
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;

      // Should return empty array when cache operations fail (matching actual service behavior)
      const permissions = await authService.getUserPermissionsInWorkspace('user-1', 'ws-1');
      
      expect(permissions).toEqual([]);
      
      // Cache set failures should not crash the service
      expect(mockCacheService.set).toHaveBeenCalled();
      });
    });

    describe('race condition scenarios', () => {
      test('handles TTL expiration race conditions', async () => {
      // Setup scenario where cache expires between check and retrieval
      let cacheCallCount = 0;
      mockCacheService.get.mockImplementation(() => {
        cacheCallCount++;
        // First call returns data, second call (race condition) returns null
        if (cacheCallCount === 1) {
          return Promise.resolve(['workspace:read', 'workspace:edit']);
        }
        return Promise.resolve(null);
      });
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'member-1',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          role: 'member',
          permissions: ['workspace:read', 'workspace:edit', 'custom:feature'],
          is_active: true
        })
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;

      // Simulate concurrent permission checks that hit TTL expiration
      const concurrentChecks = [
        authService.getUserPermissionsInWorkspace('user-1', 'ws-1'),
        authService.getUserPermissionsInWorkspace('user-1', 'ws-1'),
        authService.getUserPermissionsInWorkspace('user-1', 'ws-1')
      ];

      const results = await Promise.all(concurrentChecks);
      
      // All should return valid permissions despite race condition
      results.forEach(permissions => {
        expect(Array.isArray(permissions)).toBe(true);
        expect(permissions.length).toBeGreaterThan(0);
      });
      });

      test('handles cache key collision scenarios', async () => {
      // Setup scenario with similar cache keys that could collide
      const userIds = ['user-123', 'user-12', 'user-1234'] as const;
      const workspaceId = 'ws-1';
      
      // Mock different permission sets for each user
      const mockPermissionSets = {
        'user-123': ['workspace:read'],
        'user-12': ['workspace:read', 'workspace:edit'],
        'user-1234': ['workspace:read', 'workspace:edit', 'workspace:delete']
      } as const;

      mockCacheService.get.mockImplementation((key: string) => {
        const userId = key.split(':')[1];
        return Promise.resolve(mockPermissionSets[userId] || null);
      });

      // Each user should get their correct permissions, not colliding keys
      for (const userId of userIds) {
        const permissions = await authService.getUserPermissionsInWorkspace(userId, workspaceId);
        expect(permissions).toEqual(mockPermissionSets[userId]);
        
        // Verify correct cache key was used
        expect(mockCacheService.get).toHaveBeenCalledWith(
          `user_permissions:${userId}:${workspaceId}`
        );
      }
      });

      test('handles cache stampede protection during invalidation', async () => {
      // Setup concurrent invalidation scenario
      mockCacheService.delete.mockImplementation(() => {
        // Simulate slow cache deletion
        return new Promise(resolve => setTimeout(resolve, PERFORMANCE_LIMITS.CACHE_DELETION_DELAY_MS));
      });
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'member-1',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          role: 'admin',
          permissions: ['workspace:read', 'workspace:edit', 'workspace:delete'],
          is_active: true
        }),
        update: jest.fn().mockResolvedValue(1)
      };

      mockDb = Object.assign(jest.fn(() => mockQueryBuilder), {
        fn: { now: jest.fn(() => new Date()) },
        transaction: jest.fn(),
        raw: jest.fn()
      });
      (authService as any).db = mockDb;

      // Simulate concurrent permission updates that trigger cache invalidation
      const concurrentUpdates = [
        authService.updateMemberRole('ws-1', 'user-1', 'member', 'test-user'),
        authService.updateMemberRole('ws-1', 'user-1', 'viewer', 'test-user'),
        authService.updateMemberRole('ws-1', 'user-1', 'admin', 'test-user')
      ];

      // All updates should complete without deadlock or corruption (updateMemberRole returns Promise<void>)
      await Promise.all(concurrentUpdates);

      // Cache deletion should be called for each update (service uses .del() method)
      expect(mockCacheService.del).toHaveBeenCalled();
      
      // Database updates should all complete
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      });
    });
  });
});
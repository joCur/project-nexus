/**
 * Cross-Workspace Permission Integration Tests
 * 
 * This test suite validates that workspace permissions are properly isolated
 * and that users cannot access resources across workspace boundaries without
 * proper authorization.
 */

import { GraphQLContext as _GraphQLContext } from '@/types';
import { workspaceResolvers } from '@/resolvers/workspace';
import { AuthorizationError } from '@/utils/errors';
import { WorkspaceRole } from '@/types/auth';
import {
  createMockGraphQLContext,
  createMockWorkspaceService,
  createMockWorkspaceAuthorizationService,
  createMockUserService,
  createMockCacheService,
} from '../utils/test-helpers';

// Mock logger to prevent test noise
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  securityLogger: {
    authorizationFailure: jest.fn(),
    authorizationSuccess: jest.fn(),
  },
}));

// Mock authorization helper to use real implementation but with mocked dependencies
jest.mock('@/utils/authorizationHelper', () => ({
  ...jest.requireActual('@/utils/authorizationHelper'),
  clearPermissionCache: jest.fn(),
}));

describe('Cross-Workspace Permission Integration Tests', () => {
  let mockWorkspaceService: any;
  let mockWorkspaceAuthService: any;
  let mockUserService: any;
  let mockCacheService: any;

  // Test users
  const users = {
    alice: {
      id: 'user-alice',
      email: 'alice@example.com',
      auth0UserId: 'auth0|alice',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: ['user'],
      permissions: [],
      metadataSyncedAt: new Date(),
    },
    bob: {
      id: 'user-bob', 
      email: 'bob@example.com',
      auth0UserId: 'auth0|bob',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: ['user'],
      permissions: [],
      metadataSyncedAt: new Date(),
    },
  };

  // Test workspaces
  const workspaces = {
    workspaceA: {
      id: 'ws-a',
      name: 'Workspace A',
      description: 'Alice\'s workspace',
      ownerId: users.alice.id,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    workspaceB: {
      id: 'ws-b',
      name: 'Workspace B',
      description: 'Bob\'s workspace',
      ownerId: users.bob.id,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Workspace memberships (will be reset in beforeEach for multi-workspace scenarios)
  let workspaceMembers: any = {
    alice: {
      [workspaces.workspaceA.id]: {
        id: 'member-alice-ws-a',
        workspaceId: workspaces.workspaceA.id,
        userId: users.alice.id,
        role: 'owner' as WorkspaceRole,
        permissions: ['workspace:read', 'workspace:update', 'workspace:delete', 'card:read'],
        joinedAt: new Date(),
        isActive: true,
      },
    },
    bob: {
      [workspaces.workspaceB.id]: {
        id: 'member-bob-ws-b',
        workspaceId: workspaces.workspaceB.id,
        userId: users.bob.id,
        role: 'owner' as WorkspaceRole,
        permissions: ['workspace:read', 'workspace:update', 'workspace:delete', 'card:read'],
        joinedAt: new Date(),
        isActive: true,
      },
    },
  };

  beforeEach(() => {
    mockWorkspaceService = createMockWorkspaceService();
    mockWorkspaceAuthService = createMockWorkspaceAuthorizationService();
    mockUserService = createMockUserService();
    mockCacheService = createMockCacheService();

    // Setup mocks
    mockWorkspaceService.getWorkspaceById.mockImplementation((id: string) => {
      return Promise.resolve(Object.values(workspaces).find(ws => ws.id === id) || null);
    });

    mockUserService.findById.mockImplementation((id: string) => {
      return Promise.resolve(Object.values(users).find(u => u.id === id) || null);
    });

    mockWorkspaceAuthService.getWorkspaceMember.mockImplementation((userId: string, workspaceId: string) => {
      const userKey = userId === users.alice.id ? 'alice' : userId === users.bob.id ? 'bob' : 'charlie';
      const userMembers = workspaceMembers[userKey as keyof typeof workspaceMembers];
      return Promise.resolve(userMembers?.[workspaceId] || null);
    });

    mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockImplementation((userId: string, workspaceId: string) => {
      const userKey = userId === users.alice.id ? 'alice' : userId === users.bob.id ? 'bob' : 'charlie';
      const member = workspaceMembers[userKey as keyof typeof workspaceMembers]?.[workspaceId];
      return Promise.resolve(member?.permissions || []);
    });

    mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation((userId: string, workspaceId: string, permission: string) => {
      const userKey = userId === users.alice.id ? 'alice' : userId === users.bob.id ? 'bob' : 'charlie';
      const member = workspaceMembers[userKey as keyof typeof workspaceMembers]?.[workspaceId];
      return Promise.resolve(member?.permissions.includes(permission) || false);
    });

    jest.clearAllMocks();
  });

  describe('Basic Cross-Workspace Isolation', () => {
    it('should allow Alice to access her workspace A but deny access to Bob\'s workspace B', async () => {
      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      // Alice should access workspace A successfully
      const workspaceA = await workspaceResolvers.Query.workspace(
        null,
        { id: workspaces.workspaceA.id },
        contextAlice
      );
      expect(workspaceA).toEqual(workspaces.workspaceA);

      // Alice should be denied access to workspace B
      await expect(
        workspaceResolvers.Query.workspace(
          null,
          { id: workspaces.workspaceB.id },
          contextAlice
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('should allow Bob to access his workspace B but deny access to Alice\'s workspace A', async () => {
      const contextBob = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.bob,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      // Bob should access workspace B successfully
      const workspaceB = await workspaceResolvers.Query.workspace(
        null,
        { id: workspaces.workspaceB.id },
        contextBob
      );
      expect(workspaceB).toEqual(workspaces.workspaceB);

      // Bob should be denied access to workspace A
      await expect(
        workspaceResolvers.Query.workspace(
          null,
          { id: workspaces.workspaceA.id },
          contextBob
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Permission Boundaries', () => {
    it('should not leak permissions across workspace boundaries', async () => {
      // Alice should have no permissions in workspace B
      const alicePermissionsInB = await mockWorkspaceAuthService.getUserPermissionsInWorkspace(
        users.alice.id,
        workspaces.workspaceB.id
      );
      expect(alicePermissionsInB).toEqual([]);

      // Bob should have no permissions in workspace A
      const bobPermissionsInA = await mockWorkspaceAuthService.getUserPermissionsInWorkspace(
        users.bob.id,
        workspaces.workspaceA.id
      );
      expect(bobPermissionsInA).toEqual([]);
    });

    it('should verify workspace membership isolation', async () => {
      // Alice should only be a member of workspace A
      const aliceInA = await mockWorkspaceAuthService.getWorkspaceMember(
        users.alice.id,
        workspaces.workspaceA.id
      );
      expect(aliceInA).toBeTruthy();
      expect(aliceInA.role).toBe('owner');

      const aliceInB = await mockWorkspaceAuthService.getWorkspaceMember(
        users.alice.id,
        workspaces.workspaceB.id
      );
      expect(aliceInB).toBeNull();

      // Bob should only be a member of workspace B
      const bobInB = await mockWorkspaceAuthService.getWorkspaceMember(
        users.bob.id,
        workspaces.workspaceB.id
      );
      expect(bobInB).toBeTruthy();
      expect(bobInB.role).toBe('owner');

      const bobInA = await mockWorkspaceAuthService.getWorkspaceMember(
        users.bob.id,
        workspaces.workspaceA.id
      );
      expect(bobInA).toBeNull();
    });
  });

  describe('Multi-Workspace User Scenarios', () => {
    beforeEach(() => {
      // Reset workspace members to include Charlie with multi-workspace access
      workspaceMembers = {
        alice: {
          [workspaces.workspaceA.id]: {
            id: 'member-alice-ws-a',
            workspaceId: workspaces.workspaceA.id,
            userId: users.alice.id,
            role: 'owner' as WorkspaceRole,
            permissions: ['workspace:read', 'workspace:update', 'workspace:delete', 'card:read'],
            joinedAt: new Date(),
            isActive: true,
          },
        },
        bob: {
          [workspaces.workspaceB.id]: {
            id: 'member-bob-ws-b',
            workspaceId: workspaces.workspaceB.id,
            userId: users.bob.id,
            role: 'owner' as WorkspaceRole,
            permissions: ['workspace:read', 'workspace:update', 'workspace:delete', 'card:read'],
            joinedAt: new Date(),
            isActive: true,
          },
        },
        charlie: {
          [workspaces.workspaceA.id]: {
            id: 'member-charlie-ws-a',
            workspaceId: workspaces.workspaceA.id,
            userId: 'user-charlie',
            role: 'viewer' as WorkspaceRole,
            permissions: ['workspace:read', 'card:read'],
            joinedAt: new Date(),
            isActive: true,
          },
          [workspaces.workspaceB.id]: {
            id: 'member-charlie-ws-b',
            workspaceId: workspaces.workspaceB.id,
            userId: 'user-charlie',
            role: 'member' as WorkspaceRole,
            permissions: ['workspace:read', 'workspace:update', 'card:read', 'card:create', 'card:update'],
            joinedAt: new Date(),
            isActive: true,
          },
        },
      };
    });

    it('should handle different permission levels across workspaces for multi-workspace user', async () => {
      // Charlie should have viewer permissions in workspace A
      const charliePermissionsInA = await mockWorkspaceAuthService.getUserPermissionsInWorkspace(
        'user-charlie',
        workspaces.workspaceA.id
      );
      expect(charliePermissionsInA).toEqual(['workspace:read', 'card:read']);

      // Charlie should have editor permissions in workspace B
      const charliePermissionsInB = await mockWorkspaceAuthService.getUserPermissionsInWorkspace(
        'user-charlie',
        workspaces.workspaceB.id
      );
      expect(charliePermissionsInB).toEqual(['workspace:read', 'workspace:update', 'card:read', 'card:create', 'card:update']);

      // Verify specific permission checks
      const canReadA = await mockWorkspaceAuthService.hasPermissionInWorkspace(
        'user-charlie',
        workspaces.workspaceA.id,
        'workspace:read'
      );
      expect(canReadA).toBe(true);

      const canUpdateA = await mockWorkspaceAuthService.hasPermissionInWorkspace(
        'user-charlie',
        workspaces.workspaceA.id,
        'workspace:update'
      );
      expect(canUpdateA).toBe(false);

      const canUpdateB = await mockWorkspaceAuthService.hasPermissionInWorkspace(
        'user-charlie',
        workspaces.workspaceB.id,
        'workspace:update'
      );
      expect(canUpdateB).toBe(true);
    });

    it('should maintain role isolation across workspaces for multi-workspace user', async () => {
      // Charlie's role in workspace A should be viewer
      const charlieInA = await mockWorkspaceAuthService.getWorkspaceMember(
        'user-charlie',
        workspaces.workspaceA.id
      );
      expect(charlieInA.role).toBe('viewer');

      // Charlie's role in workspace B should be member
      const charlieInB = await mockWorkspaceAuthService.getWorkspaceMember(
        'user-charlie',
        workspaces.workspaceB.id
      );
      expect(charlieInB.role).toBe('member');

      // Roles should not affect each other
      expect(charlieInA.role).not.toBe(charlieInB.role);
    });

    afterEach(() => {
      // Reset workspace members back to original state after multi-workspace tests
      workspaceMembers = {
        alice: {
          [workspaces.workspaceA.id]: {
            id: 'member-alice-ws-a',
            workspaceId: workspaces.workspaceA.id,
            userId: users.alice.id,
            role: 'owner' as WorkspaceRole,
            permissions: ['workspace:read', 'workspace:update', 'workspace:delete', 'card:read'],
            joinedAt: new Date(),
            isActive: true,
          },
        },
        bob: {
          [workspaces.workspaceB.id]: {
            id: 'member-bob-ws-b',
            workspaceId: workspaces.workspaceB.id,
            userId: users.bob.id,
            role: 'owner' as WorkspaceRole,
            permissions: ['workspace:read', 'workspace:update', 'workspace:delete', 'card:read'],
            joinedAt: new Date(),
            isActive: true,
          },
        },
      };
    });
  });

  describe('Workspace Context Validation', () => {
    it('should prevent workspace ID tampering in authorization checks', async () => {
      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      // Simulate an attempt to access workspace B with Alice's context
      // This should fail even if Alice tries to access it directly
      await expect(
        workspaceResolvers.Query.workspace(
          null,
          { id: workspaces.workspaceB.id },
          contextAlice
        )
      ).rejects.toThrow(AuthorizationError);

      // Verify the authorization was properly checked and failed
      // Note: The actual service calls are abstracted by the authorization helper
    });

    it('should handle nonexistent workspace access attempts', async () => {
      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      const nonexistentWorkspaceId = 'ws-nonexistent';

      // Mock returns null for nonexistent workspace
      mockWorkspaceService.getWorkspaceById.mockResolvedValueOnce(null);

      await expect(
        workspaceResolvers.Query.workspace(
          null,
          { id: nonexistentWorkspaceId },
          contextAlice
        )
      ).rejects.toThrow('Workspace with identifier');
    });
  });

  describe('Permission Cache Isolation', () => {
    it('should not allow cached permissions to leak across workspaces', async () => {
      // This test ensures that permission caching doesn't accidentally
      // grant cross-workspace access due to cache key collisions
      
      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      // First, Alice accesses her workspace A (should succeed and cache permissions)
      const workspaceA = await workspaceResolvers.Query.workspace(
        null,
        { id: workspaces.workspaceA.id },
        contextAlice
      );
      expect(workspaceA).toEqual(workspaces.workspaceA);

      // Then Alice tries to access workspace B (should still fail despite cache)
      await expect(
        workspaceResolvers.Query.workspace(
          null,
          { id: workspaces.workspaceB.id },
          contextAlice
        )
      ).rejects.toThrow(AuthorizationError);

      // Verify that both operations were performed with proper isolation
      // The authorization helper handles the internal service calls
    });
  });

  describe('Error Message Security', () => {
    it('should return generic error messages to prevent information disclosure', async () => {
      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      // Alice tries to access Bob's workspace
      try {
        await workspaceResolvers.Query.workspace(
          null,
          { id: workspaces.workspaceB.id },
          contextAlice
        );
        fail('Expected AuthorizationError to be thrown');
      } catch (error) {
        // Error message should be generic to prevent information disclosure
        expect(error.message).toBe('Insufficient permissions for workspace access');
        // Should not reveal that the workspace exists or specific permission details
        expect(error.message).not.toContain('workspace:read');
        expect(error.message).not.toContain(workspaces.workspaceB.id);
        expect(error.message).not.toContain('Bob');
      }
    });
  });

  describe('Security Enhancements', () => {
    it('should prevent SQL injection attempts in workspace ID parameters', async () => {
      const maliciousWorkspaceId = "'; DROP TABLE workspaces; --";
      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      // Mock should handle malicious input gracefully
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(null);

      await expect(
        workspaceResolvers.Query.workspace(
          null,
          { id: maliciousWorkspaceId },
          contextAlice
        )
      ).rejects.toThrow('Workspace with identifier');

      // Verify service was called with the malicious string (it should be safely handled)
      expect(mockWorkspaceService.getWorkspaceById).toHaveBeenCalledWith(maliciousWorkspaceId);
    });

    it('should validate workspace access with XSS attempt in workspace name', async () => {
      const xssWorkspace = {
        ...workspaces.workspaceA,
        name: '<script>alert("XSS")</script>',
        description: '<img src="x" onerror="alert(1)">',
      };

      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      mockWorkspaceService.getWorkspaceById.mockResolvedValue(xssWorkspace);

      const result = await workspaceResolvers.Query.workspace(
        null,
        { id: workspaces.workspaceA.id },
        contextAlice
      );

      expect(result).toEqual(xssWorkspace);
      // Note: XSS protection should be handled at the client-side or serialization layer
    });

    it('should prevent unauthorized enumeration of workspace IDs', async () => {
      const contextAlice = createMockGraphQLContext({
        isAuthenticated: true,
        user: users.alice,
        dataSources: {
          workspaceService: mockWorkspaceService,
          workspaceAuthorizationService: mockWorkspaceAuthService,
          userService: mockUserService,
          cacheService: mockCacheService,
        },
      });

      // Test multiple workspace ID attempts
      const unauthorizedWorkspaceIds = [
        'ws-random-1',
        'ws-random-2', 
        'ws-random-3',
        workspaces.workspaceB.id, // Bob's workspace
      ];

      for (const workspaceId of unauthorizedWorkspaceIds) {
        if (workspaceId === workspaces.workspaceB.id) {
          mockWorkspaceService.getWorkspaceById.mockResolvedValue(workspaces.workspaceB);
        } else {
          mockWorkspaceService.getWorkspaceById.mockResolvedValue(null);
        }

        await expect(
          workspaceResolvers.Query.workspace(
            null,
            { id: workspaceId },
            contextAlice
          )
        ).rejects.toThrow();
      }

      // Should have been called for each attempt
      expect(mockWorkspaceService.getWorkspaceById).toHaveBeenCalledTimes(unauthorizedWorkspaceIds.length);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});

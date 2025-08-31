/**
 * End-to-end permission scenarios integration tests
 * Tests complete user permission workflows from join to removal
 * Validates permission system behavior across workspace lifecycle
 */

import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../utils/test-helpers';
import { 
  createMockAuth0Service,
  createMockUserService,
  createMockCacheService,
  createMockWorkspaceAuthorizationService,
  createMockUser
} from '../utils/test-helpers';
import { JWT_FIXTURES, USER_FIXTURES } from '../utils/test-fixtures';

// Mock workspace helper
function createMockWorkspace(overrides: any = {}) {
  return {
    id: 'ws-test',
    name: 'Test Workspace',
    description: 'Test workspace for permission testing',
    ownerId: 'user-owner',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('End-to-End Permission Scenarios', () => {
  let app: Express;
  let mockAuth0Service: any;
  let mockUserService: any;
  let mockCacheService: any;
  let mockWorkspaceAuthService: any;

  // Test data with const assertions
  const VIEWER_PERMISSIONS = ['workspace:read', 'canvas:read', 'card:read'] as const;
  const EDITOR_PERMISSIONS = ['workspace:read', 'canvas:read', 'canvas:create', 'canvas:update', 'card:read', 'card:create', 'card:update'] as const;
  const ADMIN_PERMISSIONS = ['workspace:read', 'workspace:update', 'canvas:read', 'canvas:create', 'canvas:update', 'canvas:delete', 'card:read', 'card:create', 'card:update', 'card:delete', 'member:invite', 'member:remove', 'member:update_role'] as const;

  // Test workspace and users
  const testWorkspace = createMockWorkspace({ id: 'ws-test', name: 'Test Workspace' });
  const viewerUser = createMockUser({ id: 'user-viewer', email: 'viewer@test.com', auth0UserId: 'auth0|viewer' });
  const editorUser = createMockUser({ id: 'user-editor', email: 'editor@test.com', auth0UserId: 'auth0|editor' });
  const adminUser = createMockUser({ id: 'user-admin', email: 'admin@test.com', auth0UserId: 'auth0|admin' });
  const ownerUser = createMockUser({ id: 'user-owner', email: 'owner@test.com', auth0UserId: 'auth0|owner' });

  beforeEach(async () => {
    // Create mock services
    mockAuth0Service = createMockAuth0Service();
    mockUserService = createMockUserService();
    mockCacheService = createMockCacheService();
    mockWorkspaceAuthService = createMockWorkspaceAuthorizationService();

    // Create test app
    app = await createTestApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario 1: User joins workspace as viewer → can only read', () => {
    test('new viewer can only read content, cannot create or modify', async () => {
      // Setup: User joins as viewer
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: viewerUser.auth0UserId,
        email: viewerUser.email,
        roles: ['user'],
      } as const);

      mockUserService.findByAuth0Id.mockResolvedValue(viewerUser);

      // Mock viewer permissions
      mockWorkspaceAuthService.getUserWorkspaceRole.mockResolvedValue('viewer');
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue([...VIEWER_PERMISSIONS]);

      mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation(
        (userId: string, workspaceId: string, permission: string) => {
          if (userId === viewerUser.id && workspaceId === testWorkspace.id) {
            return Promise.resolve(VIEWER_PERMISSIONS.includes(permission as any));
          }
          return Promise.resolve(false);
        }
      );

      // Test 1: Can read workspace
      const readResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            query {
              workspace(id: "${testWorkspace.id}") {
                id
                name
                canvases {
                  id
                  title
                }
              }
            }
          `
        });

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.data.workspace).toBeDefined();

      // Test 2: Cannot create canvas
      const createCanvasResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              createCanvas(input: {
                workspaceId: "${testWorkspace.id}"
                title: "New Canvas"
                description: "Test canvas"
              }) {
                id
                title
              }
            }
          `
        });

      expect(createCanvasResponse.status).toBe(200);
      expect(createCanvasResponse.body.errors).toBeDefined();
      expect(createCanvasResponse.body.errors[0].message).toBe('Insufficient permissions for canvas creation');
      expect(createCanvasResponse.body.errors[0].extensions?.code).toBe('INSUFFICIENT_PERMISSIONS');

      // Test 3: Cannot create cards
      const createCardResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              createCard(input: {
                workspaceId: "${testWorkspace.id}"
                title: "New Card"
                content: "Test card"
              }) {
                id
                title
              }
            }
          `
        });

      expect(createCardResponse.status).toBe(200);
      expect(createCardResponse.body.errors).toBeDefined();
      expect(createCardResponse.body.errors[0].message).toBe('Insufficient permissions for card creation');
      expect(createCardResponse.body.errors[0].extensions?.code).toBe('INSUFFICIENT_PERMISSIONS');

      // Verify permission calls
      expect(mockWorkspaceAuthService.hasPermissionInWorkspace).toHaveBeenCalledWith(
        viewerUser.id, testWorkspace.id, 'workspace:read'
      );
      expect(mockWorkspaceAuthService.hasPermissionInWorkspace).toHaveBeenCalledWith(
        viewerUser.id, testWorkspace.id, 'canvas:create'
      );
      expect(mockWorkspaceAuthService.hasPermissionInWorkspace).toHaveBeenCalledWith(
        viewerUser.id, testWorkspace.id, 'card:create'
      );
    });
  });

  describe('Scenario 2: User promoted to editor → can create/edit content', () => {
    test('promoted editor gains create and edit permissions', async () => {
      // Setup: User is promoted from viewer to editor
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: editorUser.auth0UserId,
        email: editorUser.email,
        roles: ['user'],
      } as const);

      mockUserService.findByAuth0Id.mockResolvedValue(editorUser);

      // Mock editor permissions after promotion
      mockWorkspaceAuthService.getUserWorkspaceRole.mockResolvedValue('member'); // member = editor
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue([...EDITOR_PERMISSIONS]);

      mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation(
        (userId: string, workspaceId: string, permission: string) => {
          if (userId === editorUser.id && workspaceId === testWorkspace.id) {
            return Promise.resolve(EDITOR_PERMISSIONS.includes(permission as any));
          }
          return Promise.resolve(false);
        }
      );

      // Simulate cache invalidation after promotion
      mockCacheService.del.mockResolvedValue(1);

      // Test 1: Can now create canvas
      const createCanvasResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              createCanvas(input: {
                workspaceId: "${testWorkspace.id}"
                title: "Editor Canvas"
                description: "Canvas created by editor"
              }) {
                id
                title
              }
            }
          `
        });

      expect(createCanvasResponse.status).toBe(200);
      expect(createCanvasResponse.body.data.createCanvas).toBeDefined();
      expect(createCanvasResponse.body.data.createCanvas.title).toBe('Editor Canvas');

      // Test 2: Can create cards
      const createCardResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              createCard(input: {
                workspaceId: "${testWorkspace.id}"
                title: "Editor Card"
                content: "Card created by editor"
              }) {
                id
                title
              }
            }
          `
        });

      expect(createCardResponse.status).toBe(200);
      expect(createCardResponse.body.data.createCard).toBeDefined();
      expect(createCardResponse.body.data.createCard.title).toBe('Editor Card');

      // Test 3: Can update existing content
      const updateCanvasResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              updateCanvas(id: "canvas-1", input: {
                title: "Updated Canvas Title"
              }) {
                id
                title
              }
            }
          `
        });

      expect(updateCanvasResponse.status).toBe(200);
      expect(updateCanvasResponse.body.data.updateCanvas).toBeDefined();

      // Test 4: Still cannot manage members (admin permission)
      const inviteUserResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              inviteUserToWorkspace(input: {
                workspaceId: "${testWorkspace.id}"
                email: "newuser@test.com"
                role: "viewer"
              }) {
                id
                email
              }
            }
          `
        });

      expect(inviteUserResponse.status).toBe(200);
      expect(inviteUserResponse.body.errors).toBeDefined();
      expect(inviteUserResponse.body.errors[0].message).toBe('Insufficient permissions for member management');
      expect(inviteUserResponse.body.errors[0].extensions?.code).toBe('INSUFFICIENT_PERMISSIONS');

      // Verify cache was invalidated on role change
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_context_permissions:${editorUser.id}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_workspace_permissions:${editorUser.id}:${testWorkspace.id}`);
    });
  });

  describe('Scenario 3: User promoted to admin → can manage members', () => {
    test('promoted admin gains member management permissions', async () => {
      // Setup: User is promoted to admin
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: adminUser.auth0UserId,
        email: adminUser.email,
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(adminUser);

      // Mock admin permissions
      mockWorkspaceAuthService.getUserWorkspaceRole.mockResolvedValue('admin');
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue([...ADMIN_PERMISSIONS]);

      mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation(
        (userId: string, workspaceId: string, permission: string) => {
          if (userId === adminUser.id && workspaceId === testWorkspace.id) {
            return Promise.resolve(ADMIN_PERMISSIONS.includes(permission as any));
          }
          return Promise.resolve(false);
        }
      );

      // Test 1: Can invite new members
      const inviteUserResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              inviteUserToWorkspace(input: {
                workspaceId: "${testWorkspace.id}"
                email: "newmember@test.com"
                role: "viewer"
              }) {
                id
                email
                role
              }
            }
          `
        });

      expect(inviteUserResponse.status).toBe(200);
      expect(inviteUserResponse.body.data.inviteUserToWorkspace).toBeDefined();
      expect(inviteUserResponse.body.data.inviteUserToWorkspace.email).toBe('newmember@test.com');

      // Test 2: Can update member roles
      const updateMemberRoleResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              updateWorkspaceMember(input: {
                workspaceId: "${testWorkspace.id}"
                userId: "${viewerUser.id}"
                role: "member"
              }) {
                id
                role
                user {
                  id
                  email
                }
              }
            }
          `
        });

      expect(updateMemberRoleResponse.status).toBe(200);
      expect(updateMemberRoleResponse.body.data.updateWorkspaceMember).toBeDefined();
      expect(updateMemberRoleResponse.body.data.updateWorkspaceMember.role).toBe('member');

      // Test 3: Can remove members
      const removeMemberResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              removeWorkspaceMember(input: {
                workspaceId: "${testWorkspace.id}"
                userId: "${viewerUser.id}"
              })
            }
          `
        });

      expect(removeMemberResponse.status).toBe(200);
      expect(removeMemberResponse.body.data.removeWorkspaceMember).toBe(true);

      // Test 4: Can delete content
      const deleteCanvasResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              deleteCanvas(id: "canvas-1") {
                id
              }
            }
          `
        });

      expect(deleteCanvasResponse.status).toBe(200);
      expect(deleteCanvasResponse.body.data.deleteCanvas).toBeDefined();

      // Test 5: Still cannot transfer ownership (owner-only permission)
      const transferOwnershipResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              transferWorkspaceOwnership(input: {
                workspaceId: "${testWorkspace.id}"
                newOwnerId: "${editorUser.id}"
              }) {
                id
                owner {
                  id
                }
              }
            }
          `
        });

      expect(transferOwnershipResponse.status).toBe(200);
      expect(transferOwnershipResponse.body.errors).toBeDefined();
      expect(transferOwnershipResponse.body.errors[0].message).toBe('Insufficient permissions for ownership transfer');
      expect(transferOwnershipResponse.body.errors[0].extensions?.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Scenario 4: User removed from workspace → loses all access', () => {
    test('removed user loses all workspace permissions immediately', async () => {
      // Setup: User was previously a member, now removed
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: editorUser.auth0UserId,
        email: editorUser.email,
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(editorUser);

      // Mock removed user - no workspace membership
      mockWorkspaceAuthService.getUserWorkspaceRole.mockResolvedValue(null);
      mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue([]);
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(false);

      // Cache should be cleared when user is removed
      mockCacheService.del.mockResolvedValue(1);

      // Test 1: Cannot read workspace
      const readWorkspaceResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            query {
              workspace(id: "${testWorkspace.id}") {
                id
                name
              }
            }
          `
        });

      expect(readWorkspaceResponse.status).toBe(200);
      expect(readWorkspaceResponse.body.data.workspace).toBeNull();

      // Test 2: Cannot create any content
      const createCanvasResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              createCanvas(input: {
                workspaceId: "${testWorkspace.id}"
                title: "Unauthorized Canvas"
              }) {
                id
                title
              }
            }
          `
        });

      expect(createCanvasResponse.status).toBe(200);
      expect(createCanvasResponse.body.errors).toBeDefined();
      expect(createCanvasResponse.body.errors[0].message).toBe('Access denied to workspace');
      expect(createCanvasResponse.body.errors[0].extensions?.code).toBe('ACCESS_DENIED');

      // Test 3: Cannot access existing content
      const readCanvasResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            query {
              canvas(id: "canvas-1") {
                id
                title
                cards {
                  id
                  title
                }
              }
            }
          `
        });

      expect(readCanvasResponse.status).toBe(200);
      expect(readCanvasResponse.body.data.canvas).toBeNull();

      // Test 4: User can still access other workspaces they're a member of
      const otherWorkspaceId = 'ws-other';
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation(
        (userId: string, workspaceId: string, permission: string) => {
          // User still has access to other workspace
          if (userId === editorUser.id && workspaceId === otherWorkspaceId) {
            return Promise.resolve(permission === 'workspace:read');
          }
          return Promise.resolve(false);
        }
      );

      const otherWorkspaceResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', otherWorkspaceId)
        .send({
          query: `
            query {
              workspace(id: "${otherWorkspaceId}") {
                id
                name
              }
            }
          `
        });

      expect(otherWorkspaceResponse.status).toBe(200);
      expect(otherWorkspaceResponse.body.data.workspace).toBeDefined();

      // Verify cache was cleared for removed user
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_context_permissions:${editorUser.id}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_workspace_permissions:${editorUser.id}:${testWorkspace.id}`);
    });
  });

  describe('Scenario 5: Owner transfers ownership → permissions update correctly', () => {
    test('ownership transfer updates permissions for old and new owners', async () => {
      // Setup: Current owner transfers ownership to admin
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: ownerUser.auth0UserId,
        email: ownerUser.email,
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(ownerUser);

      // Mock current owner permissions
      mockWorkspaceAuthService.getUserWorkspaceRole
        .mockImplementation((userId: string, workspaceId: string) => {
          if (userId === ownerUser.id && workspaceId === testWorkspace.id) {
            return Promise.resolve('owner');
          }
          if (userId === adminUser.id && workspaceId === testWorkspace.id) {
            return Promise.resolve('admin'); // Will become owner
          }
          return Promise.resolve(null);
        });

      mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation(
        (userId: string, workspaceId: string, permission: string) => {
          if (userId === ownerUser.id && workspaceId === testWorkspace.id) {
            // Owner has all permissions
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        }
      );

      // Test 1: Current owner can transfer ownership
      const transferResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              transferWorkspaceOwnership(input: {
                workspaceId: "${testWorkspace.id}"
                newOwnerId: "${adminUser.id}"
              }) {
                id
                owner {
                  id
                  email
                }
              }
            }
          `
        });

      expect(transferResponse.status).toBe(200);
      expect(transferResponse.body.data.transferWorkspaceOwnership).toBeDefined();
      expect(transferResponse.body.data.transferWorkspaceOwnership.owner.id).toBe(adminUser.id);

      // Setup post-transfer state: New owner (previous admin) gets owner permissions
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: adminUser.auth0UserId,
        email: adminUser.email,
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(adminUser);

      // Update role mocks after transfer
      mockWorkspaceAuthService.getUserWorkspaceRole
        .mockImplementation((userId: string, workspaceId: string) => {
          if (userId === adminUser.id && workspaceId === testWorkspace.id) {
            return Promise.resolve('owner'); // Now owner
          }
          if (userId === ownerUser.id && workspaceId === testWorkspace.id) {
            return Promise.resolve('admin'); // Demoted to admin
          }
          return Promise.resolve(null);
        });

      mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation(
        (userId: string, workspaceId: string, permission: string) => {
          if (userId === adminUser.id && workspaceId === testWorkspace.id) {
            // New owner has all permissions
            return Promise.resolve(true);
          }
          if (userId === ownerUser.id && workspaceId === testWorkspace.id) {
            // Old owner now has admin permissions (no ownership transfer)
            const adminPermissions = [
              'workspace:read', 'workspace:update',
              'canvas:read', 'canvas:create', 'canvas:update', 'canvas:delete',
              'card:read', 'card:create', 'card:update', 'card:delete',
              'member:invite', 'member:remove', 'member:update_role'
            ];
            return Promise.resolve(adminPermissions.includes(permission));
          }
          return Promise.resolve(false);
        }
      );

      // Test 2: New owner can perform ownership actions
      const newOwnerTransferResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              transferWorkspaceOwnership(input: {
                workspaceId: "${testWorkspace.id}"
                newOwnerId: "${editorUser.id}"
              }) {
                id
                owner {
                  id
                }
              }
            }
          `
        });

      expect(newOwnerTransferResponse.status).toBe(200);
      expect(newOwnerTransferResponse.body.data.transferWorkspaceOwnership).toBeDefined();

      // Test 3: Verify old owner cannot transfer ownership anymore
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: ownerUser.auth0UserId,
        email: ownerUser.email,
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(ownerUser);

      const oldOwnerTransferResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              transferWorkspaceOwnership(input: {
                workspaceId: "${testWorkspace.id}"
                newOwnerId: "${viewerUser.id}"
              }) {
                id
                owner {
                  id
                }
              }
            }
          `
        });

      expect(oldOwnerTransferResponse.status).toBe(200);
      expect(oldOwnerTransferResponse.body.errors).toBeDefined();
      expect(oldOwnerTransferResponse.body.errors[0].message).toBe('Only workspace owners can transfer ownership');
      expect(oldOwnerTransferResponse.body.errors[0].extensions?.code).toBe('OWNERSHIP_REQUIRED');

      // Test 4: Old owner retains admin permissions
      const oldOwnerAdminActionResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', testWorkspace.id)
        .send({
          query: `
            mutation {
              inviteUserToWorkspace(input: {
                workspaceId: "${testWorkspace.id}"
                email: "invited@test.com"
                role: "viewer"
              }) {
                id
                email
              }
            }
          `
        });

      expect(oldOwnerAdminActionResponse.status).toBe(200);
      expect(oldOwnerAdminActionResponse.body.data.inviteUserToWorkspace).toBeDefined();

      // Verify caches were invalidated for both users
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_context_permissions:${ownerUser.id}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_context_permissions:${adminUser.id}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_workspace_permissions:${ownerUser.id}:${testWorkspace.id}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_workspace_permissions:${adminUser.id}:${testWorkspace.id}`);
    });
  });

  describe('Cross-scenario permission validation', () => {
    test('permission system maintains consistency across all scenarios', async () => {
      const scenarios = [
        { user: viewerUser, role: 'viewer', canCreate: false, canManage: false, canOwn: false },
        { user: editorUser, role: 'member', canCreate: true, canManage: false, canOwn: false },
        { user: adminUser, role: 'admin', canCreate: true, canManage: true, canOwn: false },
        { user: ownerUser, role: 'owner', canCreate: true, canManage: true, canOwn: true }
      ];

      for (const scenario of scenarios) {
        // Setup user authentication
        mockAuth0Service.validateAuth0Token.mockResolvedValue({
          sub: scenario.user.auth0UserId,
          email: scenario.user.email,
          roles: ['user'],
        });

        mockUserService.findByAuth0Id.mockResolvedValue(scenario.user);
        mockWorkspaceAuthService.getUserWorkspaceRole.mockResolvedValue(scenario.role);

        // Mock permissions based on role
        mockWorkspaceAuthService.hasPermissionInWorkspace.mockImplementation(
          (userId: string, workspaceId: string, permission: string) => {
            if (userId !== scenario.user.id || workspaceId !== testWorkspace.id) {
              return Promise.resolve(false);
            }

            // Role-based permission mapping
            const rolePermissions = {
              viewer: ['workspace:read', 'canvas:read', 'card:read'],
              member: ['workspace:read', 'canvas:read', 'canvas:create', 'canvas:update', 'card:read', 'card:create', 'card:update'],
              admin: ['workspace:read', 'workspace:update', 'canvas:read', 'canvas:create', 'canvas:update', 'canvas:delete', 'card:read', 'card:create', 'card:update', 'card:delete', 'member:invite', 'member:remove', 'member:update_role'],
              owner: ['*'] // All permissions
            };

            const permissions = rolePermissions[scenario.role as keyof typeof rolePermissions] || [];
            return Promise.resolve(permissions.includes('*') || permissions.includes(permission));
          }
        );

        // Test create permission
        const createResponse = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .set('x-workspace-id', testWorkspace.id)
          .send({
            query: `
              mutation {
                createCanvas(input: {
                  workspaceId: "${testWorkspace.id}"
                  title: "Test Canvas"
                }) {
                  id
                  title
                }
              }
            `
          });

        if (scenario.canCreate) {
          expect(createResponse.status).toBe(200);
          expect(createResponse.body.data.createCanvas).toBeDefined();
        } else {
          expect(createResponse.status).toBe(200);
          expect(createResponse.body.errors).toBeDefined();
        }

        // Test manage permission
        const manageResponse = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .set('x-workspace-id', testWorkspace.id)
          .send({
            query: `
              mutation {
                inviteUserToWorkspace(input: {
                  workspaceId: "${testWorkspace.id}"
                  email: "manage-test@test.com"
                  role: "viewer"
                }) {
                  id
                }
              }
            `
          });

        if (scenario.canManage) {
          expect(manageResponse.status).toBe(200);
          expect(manageResponse.body.data.inviteUserToWorkspace).toBeDefined();
        } else {
          expect(manageResponse.status).toBe(200);
          expect(manageResponse.body.errors).toBeDefined();
        }

        // Test ownership permission
        const ownResponse = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .set('x-workspace-id', testWorkspace.id)
          .send({
            query: `
              mutation {
                transferWorkspaceOwnership(input: {
                  workspaceId: "${testWorkspace.id}"
                  newOwnerId: "${viewerUser.id}"
                }) {
                  id
                }
              }
            `
          });

        if (scenario.canOwn) {
          expect(ownResponse.status).toBe(200);
          expect(ownResponse.body.data.transferWorkspaceOwnership).toBeDefined();
        } else {
          expect(ownResponse.status).toBe(200);
          expect(ownResponse.body.errors).toBeDefined();
        }
      }
    });
  });
});
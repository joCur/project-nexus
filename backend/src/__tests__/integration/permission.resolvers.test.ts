/**
 * Integration tests for GraphQL resolvers with workspace permissions
 * Tests canvas creation, card operations, and cross-workspace permission isolation
 * Focuses on the new workspace-based authorization system
 */

import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../utils/test-helpers';
import { 
  createMockAuth0Service,
  createMockUserService,
  createMockCacheService,
  createMockWorkspaceAuthorizationService,
  createMockWorkspaceService,
  createMockCanvasService,
  createMockUser
} from '../utils/test-helpers';
import { JWT_FIXTURES, USER_FIXTURES } from '../utils/test-fixtures';
import { WorkspaceRole } from '@/types/auth';

describe('Permission Resolver Integration Tests', () => {
  let app: Express;
  let mockAuth0Service: any;
  let mockUserService: any;
  let mockCacheService: any;
  let mockWorkspaceAuthService: any;
  let mockWorkspaceService: any;
  let mockCanvasService: any;
  // Test data
  const testUser = USER_FIXTURES.STANDARD_USER;
  const adminUser = USER_FIXTURES.ADMIN_USER;
  const workspaceOwner = USER_FIXTURES.WORKSPACE_OWNER;

  const testWorkspace = {
    id: 'ws-test-1',
    name: 'Test Workspace',
    ownerId: workspaceOwner.id,
    privacy: 'private',
    settings: {},
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const testCanvas = {
    id: 'canvas-1',
    workspaceId: testWorkspace.id,
    name: 'Test Canvas',
    description: 'Test canvas for permission testing',
    data: { nodes: [], edges: [] },
    metadata: {},
    createdBy: testUser.id,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const testCard = {
    id: 'card-1',
    canvasId: testCanvas.id,
    workspaceId: testWorkspace.id,
    title: 'Test Card',
    content: 'Test card content',
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    style: {},
    metadata: {},
    createdBy: testUser.id,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    // Create mock services
    mockAuth0Service = createMockAuth0Service();
    mockUserService = createMockUserService();
    mockCacheService = createMockCacheService();
    mockWorkspaceAuthService = createMockWorkspaceAuthorizationService();
    mockWorkspaceService = createMockWorkspaceService();
    mockCanvasService = createMockCanvasService();

    // Create test app
    app = await createTestApp();

    // Default auth setup
    mockAuth0Service.validateAuth0Token.mockResolvedValue({
      sub: testUser.auth0UserId,
      email: testUser.email,
      roles: testUser.roles,
    });
    mockUserService.findByAuth0Id.mockResolvedValue(testUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Canvas creation with proper permissions', () => {
    test('allows canvas creation for users with card:create permission', async () => {
      // Mock user has editor role in workspace
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true); // Has card:create permission
      
      mockCanvasService.create.mockResolvedValue({
        ...testCanvas,
        id: 'new-canvas-1'
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              createCanvas(
                workspaceId: "${testWorkspace.id}"
                input: {
                  name: "New Canvas"
                  description: "Canvas with proper permissions"
                }
              ) {
                id
                name
                workspaceId
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.createCanvas).toBeDefined();
      expect(response.body.data.createCanvas.id).toBe('new-canvas-1');
      expect(response.body.data.createCanvas.workspaceId).toBe(testWorkspace.id);
      expect(mockCanvasService.create).toHaveBeenCalled();
    });

    test('allows canvas creation for workspace owners', async () => {
      // Setup workspace owner
      mockUserService.findByAuth0Id.mockResolvedValue(workspaceOwner);
      mockWorkspaceAuthService.getUserWorkspaceRole
        .mockResolvedValue('owner' as WorkspaceRole);
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true);
      
      mockCanvasService.create.mockResolvedValue({
        ...testCanvas,
        id: 'owner-canvas-1',
        createdBy: workspaceOwner.id
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.WORKSPACE_OWNER_TOKEN}`)
        .send({
          query: `
            mutation {
              createCanvas(
                workspaceId: "${testWorkspace.id}"
                input: {
                  name: "Owner Canvas"
                  description: "Canvas created by owner"
                }
              ) {
                id
                name
                createdBy
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.createCanvas).toBeDefined();
      expect(response.body.data.createCanvas.createdBy).toBe(workspaceOwner.id);
    });

    test('allows canvas updates for users with appropriate permissions', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true);
      mockCanvasService.findById.mockResolvedValue(testCanvas);
      mockCanvasService.update.mockResolvedValue({
        ...testCanvas,
        name: 'Updated Canvas Name'
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              updateCanvas(
                id: "${testCanvas.id}"
                input: {
                  name: "Updated Canvas Name"
                }
              ) {
                id
                name
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updateCanvas.name).toBe('Updated Canvas Name');
      expect(mockCanvasService.update).toHaveBeenCalled();
    });
  });

  describe('Canvas creation denied without permissions', () => {
    test('denies canvas creation for viewers', async () => {
      // Mock user is viewer (no create permissions)
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(false);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.LIMITED_USER_TOKEN}`)
        .send({
          query: `
            mutation {
              createCanvas(
                workspaceId: "${testWorkspace.id}"
                input: {
                  name: "Unauthorized Canvas"
                  description: "Should be denied"
                }
              ) {
                id
                name
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('insufficient permissions');
      expect(mockCanvasService.create).not.toHaveBeenCalled();
    });

    test('denies canvas creation for non-workspace members', async () => {
      // Mock user is not a member of the workspace
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(false);
      mockWorkspaceAuthService.getUserWorkspaceRole
        .mockResolvedValue(null);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              createCanvas(
                workspaceId: "${testWorkspace.id}"
                input: {
                  name: "Non-member Canvas"
                  description: "Should be denied"
                }
              ) {
                id
                name
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('access denied');
    });

    test('denies canvas deletion for non-owners', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(false); // No delete permission
      mockCanvasService.findById.mockResolvedValue(testCanvas);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.LIMITED_USER_TOKEN}`)
        .send({
          query: `
            mutation {
              deleteCanvas(id: "${testCanvas.id}")
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(mockCanvasService.delete).not.toHaveBeenCalled();
    });
  });

  describe('Card operations with workspace permissions', () => {
    test('allows card creation for users with card:create permission', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true);
      mockCanvasService.findById.mockResolvedValue(testCanvas);
      mockCardService.create.mockResolvedValue({
        ...testCard,
        id: 'new-card-1'
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              createCard(
                canvasId: "${testCanvas.id}"
                input: {
                  title: "New Card"
                  content: "New card content"
                  position: { x: 100, y: 100 }
                  size: { width: 200, height: 100 }
                }
              ) {
                id
                title
                canvasId
                workspaceId
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.createCard).toBeDefined();
      expect(response.body.data.createCard.workspaceId).toBe(testWorkspace.id);
      expect(mockCardService.create).toHaveBeenCalled();
    });

    test('allows card updates for users with card:update permission', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true);
      mockCardService.findById.mockResolvedValue(testCard);
      mockCardService.update.mockResolvedValue({
        ...testCard,
        title: 'Updated Card Title'
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              updateCard(
                id: "${testCard.id}"
                input: {
                  title: "Updated Card Title"
                  content: "Updated content"
                }
              ) {
                id
                title
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updateCard.title).toBe('Updated Card Title');
    });

    test('denies card operations for viewers without update permissions', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(false); // No update permission
      mockCardService.findById.mockResolvedValue(testCard);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.LIMITED_USER_TOKEN}`)
        .send({
          query: `
            mutation {
              updateCard(
                id: "${testCard.id}"
                input: {
                  title: "Unauthorized Update"
                }
              ) {
                id
                title
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(mockCardService.update).not.toHaveBeenCalled();
    });

    test('allows card reading for users with card:read permission', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true);
      mockCardService.findById.mockResolvedValue(testCard);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            query {
              card(id: "${testCard.id}") {
                id
                title
                content
                workspaceId
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.card).toBeDefined();
      expect(response.body.data.card.id).toBe(testCard.id);
    });

    test('denies card reading for non-workspace members', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(false);
      mockCardService.findById.mockResolvedValue(testCard);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            query {
              card(id: "${testCard.id}") {
                id
                title
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.card).toBeNull();
    });
  });

  describe('Member role changes affecting permissions', () => {
    test('updates user permissions when role changes from viewer to editor', async () => {
      // Initially user is viewer
      mockWorkspaceAuthService.getUserWorkspaceRole
        .mockResolvedValueOnce('viewer' as WorkspaceRole);
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValueOnce(false); // No create permission

      // Try to create card - should fail
      let response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              createCard(
                canvasId: "${testCanvas.id}"
                input: {
                  title: "Test Card"
                  position: { x: 0, y: 0 }
                  size: { width: 200, height: 100 }
                }
              ) {
                id
                title
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();

      // Promote user to editor
      mockWorkspaceAuthService.getUserWorkspaceRole
        .mockResolvedValue('member' as WorkspaceRole);
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true); // Now has create permission
      mockCardService.create.mockResolvedValue(testCard);

      // Try to create card again - should succeed
      response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              createCard(
                canvasId: "${testCanvas.id}"
                input: {
                  title: "Test Card"
                  position: { x: 0, y: 0 }
                  size: { width: 200, height: 100 }
                }
              ) {
                id
                title
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.createCard).toBeDefined();
    });

    test('workspace admin can manage workspace members', async () => {
      // Setup admin user
      mockUserService.findByAuth0Id.mockResolvedValue(adminUser);
      mockWorkspaceAuthService.getUserWorkspaceRole
        .mockResolvedValue('admin' as WorkspaceRole);
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.ADMIN_TOKEN}`)
        .send({
          query: `
            mutation {
              updateWorkspaceMember(
                workspaceId: "${testWorkspace.id}"
                userId: "${testUser.id}"
                input: {
                  role: EDITOR
                  permissions: ["card:create", "card:update"]
                }
              ) {
                id
                role
                permissions
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updateWorkspaceMember).toBeDefined();
    });
  });

  describe('Cross-workspace permission isolation', () => {
    const workspace2 = {
      id: 'ws-test-2',
      name: 'Test Workspace 2',
      ownerId: adminUser.id,
      privacy: 'private'
    };

    test('user permissions are isolated between workspaces', async () => {
      // User has permissions in workspace 1 but not workspace 2
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockImplementation((userId: string, workspaceId: string, permission: string) => {
          if (workspaceId === testWorkspace.id) {
            return Promise.resolve(true); // Has permission in ws1
          } else if (workspaceId === workspace2.id) {
            return Promise.resolve(false); // No permission in ws2
          }
          return Promise.resolve(false);
        });

      // Should succeed in workspace 1
      mockCanvasService.create.mockResolvedValue({
        ...testCanvas,
        id: 'canvas-ws1',
        workspaceId: testWorkspace.id
      });

      let response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              createCanvas(
                workspaceId: "${testWorkspace.id}"
                input: {
                  name: "Canvas in WS1"
                }
              ) {
                id
                workspaceId
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.createCanvas).toBeDefined();

      // Should fail in workspace 2
      response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              createCanvas(
                workspaceId: "${workspace2.id}"
                input: {
                  name: "Canvas in WS2"
                }
              ) {
                id
                workspaceId
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });

    test('workspace data is not accessible across workspaces', async () => {
      // User can access workspace 1 but not workspace 2
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockImplementation((userId: string, workspaceId: string) => {
          return Promise.resolve(workspaceId === testWorkspace.id);
        });

      mockWorkspaceService.findById.mockImplementation((id: string) => {
        if (id === testWorkspace.id) return Promise.resolve(testWorkspace);
        if (id === workspace2.id) return Promise.resolve(workspace2);
        return Promise.resolve(null);
      });

      // Can access workspace 1
      let response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
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

      expect(response.status).toBe(200);
      expect(response.body.data.workspace).toBeDefined();

      // Cannot access workspace 2
      response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            query {
              workspace(id: "${workspace2.id}") {
                id
                name
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.workspace).toBeNull();
    });

    test('card access is restricted by workspace membership', async () => {
      const card2 = {
        ...testCard,
        id: 'card-ws2',
        workspaceId: workspace2.id
      };

      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockImplementation((userId: string, workspaceId: string) => {
          return Promise.resolve(workspaceId === testWorkspace.id);
        });

      mockCardService.findById.mockImplementation((id: string) => {
        if (id === testCard.id) return Promise.resolve(testCard);
        if (id === card2.id) return Promise.resolve(card2);
        return Promise.resolve(null);
      });

      // Can access card in workspace 1
      let response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            query {
              card(id: "${testCard.id}") {
                id
                title
                workspaceId
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.card).toBeDefined();
      expect(response.body.data.card.workspaceId).toBe(testWorkspace.id);

      // Cannot access card in workspace 2
      response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            query {
              card(id: "${card2.id}") {
                id
                title
                workspaceId
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.card).toBeNull();
    });
  });

  describe('Performance with workspace permissions', () => {
    test('permission checks are cached and reused within request', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockResolvedValue(true);
      mockCanvasService.findByWorkspace.mockResolvedValue([testCanvas]);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            query {
              workspace(id: "${testWorkspace.id}") {
                id
                name
                canvases {
                  id
                  name
                }
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.workspace).toBeDefined();
      
      // Permission check should be cached and not called multiple times
      expect(mockWorkspaceAuthService.hasPermissionInWorkspace).toHaveBeenCalled();
    });

    test('batch queries respect workspace permission boundaries', async () => {
      mockWorkspaceAuthService.hasPermissionInWorkspace
        .mockImplementation((userId: string, workspaceId: string) => {
          return Promise.resolve(workspaceId === testWorkspace.id);
        });

      mockWorkspaceService.findById.mockImplementation((id: string) => {
        if (id === testWorkspace.id) return Promise.resolve(testWorkspace);
        return Promise.resolve(null);
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            query {
              ws1: workspace(id: "${testWorkspace.id}") { id name }
              ws2: workspace(id: "unauthorized-ws") { id name }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.ws1).toBeDefined();
      expect(response.body.data.ws2).toBeNull();
    });
  });
});
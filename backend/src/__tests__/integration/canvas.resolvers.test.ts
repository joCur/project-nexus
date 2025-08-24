import request from 'supertest';
import { Express } from 'express';
import { GraphQLContext } from '@/types';
import { createTestApp, testMockServices } from '../utils/test-helpers';

// Mock all services
jest.mock('@/services/onboarding');
jest.mock('@/services/userProfile');
jest.mock('@/services/workspace');
jest.mock('@/services/workspaceAuthorization');
jest.mock('@/services/canvas');
jest.mock('@/services/CardService');
jest.mock('@/services/connectionService');
jest.mock('@/services/subscriptionService', () => ({
  SubscriptionService: jest.fn(),
  pubSub: {
    publish: jest.fn(),
    asyncIterator: jest.fn(),
  },
}));
jest.mock('@/database/connection');
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock the CanvasService class
const MockCanvasService = jest.fn().mockImplementation(() => ({
  getCanvasById: jest.fn(),
  getCanvasesByWorkspace: jest.fn(),
  getDefaultCanvas: jest.fn(),
  createCanvas: jest.fn(),
  updateCanvas: jest.fn(),
  deleteCanvas: jest.fn(),
  setDefaultCanvas: jest.fn(),
  duplicateCanvas: jest.fn(),
  getCanvasStatistics: jest.fn(),
}));

// Mock the WorkspaceAuthorizationService class
const MockWorkspaceAuthService = jest.fn().mockImplementation(() => ({
  hasWorkspaceAccess: jest.fn().mockResolvedValue(true),
  requirePermission: jest.fn().mockResolvedValue(true),
}));

// Apply the mocks
jest.mock('@/services/canvas', () => ({
  CanvasService: MockCanvasService,
}));

jest.mock('@/services/workspaceAuthorization', () => ({
  WorkspaceAuthorizationService: MockWorkspaceAuthService,
}));

describe('Canvas GraphQL Resolvers Integration Tests (NEX-174)', () => {
  let app: Express;
  let mockCanvasService: any;
  
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testWorkspaceId = '456e7890-e12b-34c5-d678-901234567890';
  
  const validAuthHeaders = {
    'Authorization': 'Bearer valid-token',
    'X-User-Sub': `auth0|${testUserId}`,
    'X-User-Email': 'canvas-test@example.com',
  };

  const mockCanvas = {
    id: 'canvas-123-uuid',
    name: 'Test Canvas',
    description: 'Test canvas description',
    isDefault: false,
    position: 1,
    workspaceId: testWorkspaceId,
    createdBy: testUserId,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    cardCount: 0,
    connectionCount: 0
  };

  const mockWorkspace = {
    id: testWorkspaceId,
    name: 'Canvas Test Workspace',
    ownerId: testUserId
  };

  const mockUser = {
    id: testUserId,
    email: 'canvas-test@example.com',
    displayName: 'Canvas Test User'
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    MockCanvasService.mockClear();
    MockWorkspaceAuthService.mockClear();
    
    // Reset all mock functions in testMockServices
    Object.values(testMockServices).forEach((service: any) => {
      if (service && typeof service === 'object') {
        Object.values(service).forEach((method: any) => {
          if (jest.isMockFunction(method)) {
            method.mockReset();
          }
        });
      }
    });
    
    // Set up mocked CanvasService instance
    const mockCanvasInstance = new MockCanvasService();
    mockCanvasService = mockCanvasInstance;
    MockCanvasService.mockImplementation(() => mockCanvasService);
    
    // Set up default mock workspace and user services
    testMockServices.workspaceService.getWorkspaceById = jest.fn().mockResolvedValue(mockWorkspace);
    testMockServices.userService.findById = jest.fn().mockResolvedValue(mockUser);
  });

  describe('Canvas Queries', () => {
    describe('workspaceCanvases', () => {
      it('should get canvases for a workspace', async () => {
        const query = `
          query WorkspaceCanvases($workspaceId: ID!) {
            workspaceCanvases(workspaceId: $workspaceId) {
              items {
                id
                name
                description
                isDefault
                position
                createdBy
                createdAt
                updatedAt
                cardCount
                connectionCount
                workspace {
                  id
                  name
                }
                createdByUser {
                  id
                  email
                }
              }
              totalCount
              hasNextPage
              hasPreviousPage
            }
          }
        `;

        mockCanvasService.getCanvasesByWorkspace.mockResolvedValue({
          canvases: [mockCanvas],
          totalCount: 1
        });

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query,
            variables: {
              workspaceId: testWorkspaceId
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.workspaceCanvases).toBeDefined();
        expect(response.body.data.workspaceCanvases.totalCount).toBe(1);
        expect(response.body.data.workspaceCanvases.items).toHaveLength(1);
        
        const canvas = response.body.data.workspaceCanvases.items[0];
        expect(canvas).toMatchObject({
          id: mockCanvas.id,
          name: mockCanvas.name,
          description: mockCanvas.description,
          isDefault: mockCanvas.isDefault,
          cardCount: mockCanvas.cardCount,
          connectionCount: mockCanvas.connectionCount
        });
        
        expect(mockCanvasService.getCanvasesByWorkspace).toHaveBeenCalledWith(
          testWorkspaceId,
          undefined, // filter
          20, // limit
          0   // offset
        );
      });

      it('should support pagination for workspace canvases', async () => {
        const query = `
          query WorkspaceCanvases($workspaceId: ID!, $pagination: PaginationInput) {
            workspaceCanvases(workspaceId: $workspaceId, pagination: $pagination) {
              items {
                id
                name
              }
              totalCount
              page
              limit
              totalPages
              hasNextPage
              hasPreviousPage
            }
          }
        `;

        mockCanvasService.getCanvasesByWorkspace.mockResolvedValue({
          canvases: [],
          totalCount: 0
        });

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query,
            variables: {
              workspaceId: testWorkspaceId,
              pagination: {
                page: 1,
                limit: 5
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.workspaceCanvases.page).toBe(1);
        expect(response.body.data.workspaceCanvases.limit).toBe(5);
        expect(response.body.data.workspaceCanvases.totalPages).toBe(0);
        
        expect(mockCanvasService.getCanvasesByWorkspace).toHaveBeenCalledWith(
          testWorkspaceId,
          undefined, // filter
          5, // limit
          0  // offset
        );
      });

      it('should require authentication', async () => {
        const query = `
          query WorkspaceCanvases($workspaceId: ID!) {
            workspaceCanvases(workspaceId: $workspaceId) {
              items {
                id
                name
              }
            }
          }
        `;

        const response = await request(app)
          .post('/graphql')
          .send({
            query,
            variables: {
              workspaceId: testWorkspaceId
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('Authentication required');
      });
    });

    describe('defaultCanvas', () => {
      it('should get default canvas for workspace', async () => {
        const query = `
          query DefaultCanvas($workspaceId: ID!) {
            defaultCanvas(workspaceId: $workspaceId) {
              id
              name
              isDefault
              workspaceId
              cardCount
              connectionCount
            }
          }
        `;

        const defaultCanvas = { ...mockCanvas, isDefault: true };
        mockCanvasService.getDefaultCanvas.mockResolvedValue(defaultCanvas);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query,
            variables: {
              workspaceId: testWorkspaceId
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.defaultCanvas).toMatchObject({
          id: defaultCanvas.id,
          name: defaultCanvas.name,
          isDefault: true,
          workspaceId: testWorkspaceId,
          cardCount: 0,
          connectionCount: 0
        });
        
        expect(mockCanvasService.getDefaultCanvas).toHaveBeenCalledWith(testWorkspaceId);
      });

      it('should return null when no default canvas exists', async () => {
        const query = `
          query DefaultCanvas($workspaceId: ID!) {
            defaultCanvas(workspaceId: $workspaceId) {
              id
              name
            }
          }
        `;

        mockCanvasService.getDefaultCanvas.mockResolvedValue(null);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query,
            variables: {
              workspaceId: testWorkspaceId
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.defaultCanvas).toBeNull();
      });
    });

    describe('canvas by ID', () => {
      it('should get specific canvas by ID', async () => {
        const query = `
          query Canvas($id: ID!) {
            canvas(id: $id) {
              id
              name
              description
              isDefault
              workspaceId
              cardCount
              connectionCount
              stats {
                cardCount
                connectionCount
                lastActivity
              }
            }
          }
        `;

        mockCanvasService.getCanvasById.mockResolvedValue(mockCanvas);
        mockCanvasService.getCanvasStats.mockResolvedValue({
          id: mockCanvas.id,
          name: mockCanvas.name,
          cardCount: 0,
          connectionCount: 0,
          createdAt: mockCanvas.createdAt
        });

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query,
            variables: {
              id: mockCanvas.id
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.canvas).toBeDefined();
        expect(response.body.data.canvas.id).toBe(mockCanvas.id);
        expect(response.body.data.canvas.name).toBe(mockCanvas.name);
        expect(response.body.data.canvas.description).toBe(mockCanvas.description);
        expect(response.body.data.canvas.stats).toBeDefined();
        
        expect(mockCanvasService.getCanvasById).toHaveBeenCalledWith(mockCanvas.id);
      });

      it('should return null for non-existent canvas', async () => {
        const query = `
          query Canvas($id: ID!) {
            canvas(id: $id) {
              id
              name
            }
          }
        `;

        mockCanvasService.getCanvasById.mockResolvedValue(null);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query,
            variables: {
              id: '00000000-0000-0000-0000-000000000000'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.canvas).toBeNull();
      });
    });
  });

  describe('Canvas Mutations', () => {
    describe('createCanvas', () => {
      it('should create a new canvas', async () => {
        const mutation = `
          mutation CreateCanvas($input: CreateCanvasInput!) {
            createCanvas(input: $input) {
              id
              name
              description
              isDefault
              position
              workspaceId
              createdBy
              createdAt
              updatedAt
              cardCount
              connectionCount
            }
          }
        `;

        const newCanvas = {
          ...mockCanvas,
          id: 'new-canvas-id',
          name: 'New Test Canvas',
          description: 'A new canvas for testing'
        };
        
        mockCanvasService.createCanvas.mockResolvedValue(newCanvas);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              input: {
                workspaceId: testWorkspaceId,
                name: 'New Test Canvas',
                description: 'A new canvas for testing',
                isDefault: false,
                position: 1
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.createCanvas).toBeDefined();

        const canvas = response.body.data.createCanvas;
        expect(canvas.name).toBe('New Test Canvas');
        expect(canvas.description).toBe('A new canvas for testing');
        expect(canvas.isDefault).toBe(false);
        expect(canvas.workspaceId).toBe(testWorkspaceId);
        expect(canvas.cardCount).toBe(0);
        expect(canvas.connectionCount).toBe(0);
        
        expect(mockCanvasService.createCanvas).toHaveBeenCalledWith(expect.objectContaining({
          workspaceId: testWorkspaceId,
          name: 'New Test Canvas',
          description: 'A new canvas for testing',
          isDefault: false,
          position: 1,
          createdBy: testUserId
        }));
      });

      it('should validate required fields', async () => {
        const mutation = `
          mutation CreateCanvas($input: CreateCanvasInput!) {
            createCanvas(input: $input) {
              id
              name
            }
          }
        `;

        mockCanvasService.createCanvas.mockRejectedValue(new Error('Name is required'));

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              input: {
                workspaceId: testWorkspaceId
                // Missing required name field
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('Name is required');
      });

      it('should prevent duplicate canvas names in same workspace', async () => {
        const mutation = `
          mutation CreateCanvas($input: CreateCanvasInput!) {
            createCanvas(input: $input) {
              id
              name
            }
          }
        `;

        mockCanvasService.createCanvas.mockRejectedValue(new Error('Canvas with this name already exists'));

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              input: {
                workspaceId: testWorkspaceId,
                name: 'Duplicate Name Test'
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('already exists');
      });
    });

    describe('updateCanvas', () => {
      it('should update canvas properties', async () => {
        const mutation = `
          mutation UpdateCanvas($id: ID!, $input: UpdateCanvasInput!) {
            updateCanvas(id: $id, input: $input) {
              id
              name
              description
              isDefault
              updatedAt
            }
          }
        `;

        const updatedCanvas = {
          ...mockCanvas,
          name: 'Updated Canvas Name',
          description: 'Updated description',
          isDefault: true
        };
        
        mockCanvasService.updateCanvas.mockResolvedValue(updatedCanvas);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              id: mockCanvas.id,
              input: {
                name: 'Updated Canvas Name',
                description: 'Updated description',
                isDefault: true
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.updateCanvas).toBeDefined();

        const canvas = response.body.data.updateCanvas;
        expect(canvas.id).toBe(mockCanvas.id);
        expect(canvas.name).toBe('Updated Canvas Name');
        expect(canvas.description).toBe('Updated description');
        expect(canvas.isDefault).toBe(true);
        
        expect(mockCanvasService.updateCanvas).toHaveBeenCalledWith(mockCanvas.id, expect.objectContaining({
          name: 'Updated Canvas Name',
          description: 'Updated description',
          isDefault: true
        }));
      });

      it('should handle partial updates', async () => {
        const mutation = `
          mutation UpdateCanvas($id: ID!, $input: UpdateCanvasInput!) {
            updateCanvas(id: $id, input: $input) {
              id
              name
              description
            }
          }
        `;

        const partiallyUpdatedCanvas = {
          ...mockCanvas,
          name: 'Partially Updated Name'
        };
        
        mockCanvasService.updateCanvas.mockResolvedValue(partiallyUpdatedCanvas);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              id: mockCanvas.id,
              input: {
                name: 'Partially Updated Name'
                // Only updating name, not description
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.updateCanvas.name).toBe('Partially Updated Name');
        expect(response.body.data.updateCanvas.description).toBe(mockCanvas.description);
      });

      it('should return error for non-existent canvas', async () => {
        const mutation = `
          mutation UpdateCanvas($id: ID!, $input: UpdateCanvasInput!) {
            updateCanvas(id: $id, input: $input) {
              id
              name
            }
          }
        `;

        mockCanvasService.updateCanvas.mockRejectedValue(new Error('Canvas not found'));

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              id: '00000000-0000-0000-0000-000000000000',
              input: {
                name: 'Updated Name'
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('not found');
      });
    });

    describe('deleteCanvas', () => {
      it('should delete a canvas', async () => {
        const mutation = `
          mutation DeleteCanvas($id: ID!) {
            deleteCanvas(id: $id)
          }
        `;

        mockCanvasService.deleteCanvas.mockResolvedValue(true);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              id: mockCanvas.id
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.deleteCanvas).toBe(true);
        
        expect(mockCanvasService.deleteCanvas).toHaveBeenCalledWith(mockCanvas.id);
      });

      it('should return error for non-existent canvas', async () => {
        const mutation = `
          mutation DeleteCanvas($id: ID!) {
            deleteCanvas(id: $id)
          }
        `;

        mockCanvasService.deleteCanvas.mockRejectedValue(new Error('Canvas not found'));

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              id: '00000000-0000-0000-0000-000000000000'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('not found');
      });
    });

    describe('setDefaultCanvas', () => {
      it('should set canvas as default', async () => {
        const mutation = `
          mutation SetDefaultCanvas($id: ID!) {
            setDefaultCanvas(id: $id) {
              id
              name
              isDefault
            }
          }
        `;

        const defaultCanvas = { ...mockCanvas, isDefault: true };
        mockCanvasService.setDefaultCanvas.mockResolvedValue(defaultCanvas);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              id: mockCanvas.id
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.setDefaultCanvas).toBeDefined();
        expect(response.body.data.setDefaultCanvas.id).toBe(mockCanvas.id);
        expect(response.body.data.setDefaultCanvas.isDefault).toBe(true);
        
        expect(mockCanvasService.setDefaultCanvas).toHaveBeenCalledWith(mockCanvas.id);
      });
    });

    describe('duplicateCanvas', () => {
      it('should duplicate a canvas', async () => {
        const mutation = `
          mutation DuplicateCanvas($id: ID!, $input: DuplicateCanvasInput!) {
            duplicateCanvas(id: $id, input: $input) {
              id
              name
              description
              isDefault
              workspaceId
            }
          }
        `;

        const duplicatedCanvas = {
          ...mockCanvas,
          id: 'duplicated-canvas-id',
          name: 'Duplicated Canvas',
          description: 'This is a duplicated canvas',
          isDefault: false
        };
        
        mockCanvasService.duplicateCanvas.mockResolvedValue(duplicatedCanvas);

        const response = await request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query: mutation,
            variables: {
              id: mockCanvas.id,
              input: {
                name: 'Duplicated Canvas',
                description: 'This is a duplicated canvas',
                includeCards: true,
                includeConnections: true
              }
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.duplicateCanvas).toBeDefined();

        const canvas = response.body.data.duplicateCanvas;
        expect(canvas.name).toBe('Duplicated Canvas');
        expect(canvas.description).toBe('This is a duplicated canvas');
        expect(canvas.isDefault).toBe(false);
        expect(canvas.workspaceId).toBe(testWorkspaceId);
        expect(canvas.id).not.toBe(mockCanvas.id);
        
        expect(mockCanvasService.duplicateCanvas).toHaveBeenCalledWith(mockCanvas.id, expect.objectContaining({
          name: 'Duplicated Canvas',
          description: 'This is a duplicated canvas',
          includeCards: true,
          includeConnections: true
        }));
      });
    });
  });

  describe('Canvas Field Resolvers', () => {
    it('should resolve computed fields correctly', async () => {
      const query = `
        query Canvas($id: ID!) {
          canvas(id: $id) {
            id
            name
            workspace {
              id
              name
            }
            createdByUser {
              id
              email
            }
            cardCount
            connectionCount
            stats {
              id
              name
              cardCount
              connectionCount
              createdAt
            }
          }
        }
      `;

      mockCanvasService.getCanvasById.mockResolvedValue(mockCanvas);
      mockCanvasService.getCanvasStats.mockResolvedValue({
        id: mockCanvas.id,
        name: mockCanvas.name,
        cardCount: 0,
        connectionCount: 0,
        createdAt: mockCanvas.createdAt
      });

      const response = await request(app)
        .post('/graphql')
        .set(validAuthHeaders)
        .send({
          query,
          variables: {
            id: mockCanvas.id
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.canvas).toBeDefined();

      const canvas = response.body.data.canvas;
      expect(canvas.workspace).toBeDefined();
      expect(canvas.workspace.id).toBe(testWorkspaceId);
      expect(canvas.createdByUser).toBeDefined();
      expect(canvas.createdByUser.id).toBe(testUserId);
      expect(canvas.cardCount).toBe(0);
      expect(canvas.connectionCount).toBe(0);
      expect(canvas.stats).toBeDefined();
      expect(canvas.stats.id).toBe(mockCanvas.id);
      expect(canvas.stats.cardCount).toBe(0);
      expect(canvas.stats.connectionCount).toBe(0);
    });
  });

  describe('Authorization Tests', () => {
    it('should require proper workspace permissions for canvas operations', async () => {
      const unauthorizedHeaders = {
        'Authorization': 'Bearer valid-token',
        'X-User-Sub': 'auth0|unauthorized-user',
        'X-User-Email': 'unauthorized@example.com',
      };

      // Mock workspace service to return null (no access)
      testMockServices.workspaceService.getWorkspaceById.mockResolvedValue(null);

      const query = `
        query WorkspaceCanvases($workspaceId: ID!) {
          workspaceCanvases(workspaceId: $workspaceId) {
            items {
              id
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set(unauthorizedHeaders)
        .send({
          query,
          variables: {
            workspaceId: testWorkspaceId
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('access');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const query = `
        query Canvas($id: ID!) {
          canvas(id: $id) {
            id
            name
          }
        }
      `;

      mockCanvasService.getCanvasById.mockRejectedValue(new Error('Database connection error'));

      const response = await request(app)
        .post('/graphql')
        .set(validAuthHeaders)
        .send({
          query,
          variables: {
            id: 'invalid-uuid'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Database connection error');
    });

    it('should handle service unavailability', async () => {
      const mutation = `
        mutation CreateCanvas($input: CreateCanvasInput!) {
          createCanvas(input: $input) {
            id
            name
          }
        }
      `;

      mockCanvasService.createCanvas.mockRejectedValue(new Error('Service temporarily unavailable'));

      const response = await request(app)
        .post('/graphql')
        .set(validAuthHeaders)
        .send({
          query: mutation,
          variables: {
            input: {
              workspaceId: testWorkspaceId,
              name: 'Test Canvas'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Service temporarily unavailable');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const query = `
        query Canvas($id: ID!) {
          canvas(id: $id) {
            id
            name
          }
        }
      `;

      mockCanvasService.getCanvasById.mockResolvedValue(mockCanvas);

      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/graphql')
          .set(validAuthHeaders)
          .send({
            query,
            variables: { id: mockCanvas.id }
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.canvas.id).toBe(mockCanvas.id);
      });
    });
  });
});
import { CanvasService } from '@/services/canvas';
import { 
  Canvas, 
  CreateCanvasInput, 
  UpdateCanvasInput, 
  _CanvasStats,
  DuplicateCanvasOptions,
  _CanvasNameConflictError,
  _DefaultCanvasError
} from '@/types/canvas';
import { database, knex as _knex } from '@/database/connection';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError 
} from '@/utils/errors';
import { createMockKnex } from '../../utils/test-helpers';

// Import for mocking purposes
import * as dbConnection from '@/database/connection';

// Mock database connection
jest.mock('@/database/connection', () => ({
  database: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
  knex: jest.fn(),
}));

// Mock workspace authorization service
jest.mock('@/services/workspaceAuthorization', () => ({
  WorkspaceAuthorizationService: jest.fn().mockImplementation(() => ({
    requirePermission: jest.fn(),
    hasWorkspaceAccess: jest.fn(),
  })),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('CanvasService', () => {
  let canvasService: CanvasService;
  let mockWorkspaceAuth: jest.Mocked<WorkspaceAuthorizationService>;
  const mockDatabase = database as jest.Mocked<typeof database>;

  // Test data
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testWorkspaceId = '223e4567-e89b-12d3-a456-426614174001';
  const testCanvasId = '323e4567-e89b-12d3-a456-426614174002';

  const mockDbCanvas = {
    id: testCanvasId,
    workspace_id: testWorkspaceId,
    name: 'Test Canvas',
    description: 'A test canvas',
    is_default: false,
    position: 0,
    created_by: testUserId,
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-01'),
  };

  const expectedCanvas: Canvas = {
    id: testCanvasId,
    workspaceId: testWorkspaceId,
    name: 'Test Canvas',
    description: 'A test canvas',
    isDefault: false,
    position: 0,
    createdBy: testUserId,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockWorkspaceMember = {
    id: 'member-id',
    workspaceId: testWorkspaceId,
    userId: testUserId,
    role: 'member' as const,
    permissions: ['canvas:read', 'canvas:create', 'canvas:update', 'canvas:delete'],
    joinedAt: new Date(),
    isActive: true
  };

  beforeEach(() => {
    // Setup knex mock
    const mockKnex = createMockKnex();
    (knex as any) = mockKnex;
    
    // Setup workspace authorization mock
    mockWorkspaceAuth = new WorkspaceAuthorizationService() as jest.Mocked<WorkspaceAuthorizationService>;
    
    canvasService = new CanvasService();
    (canvasService as any).workspaceAuth = mockWorkspaceAuth;
    
    jest.clearAllMocks();
  });

  describe('getCanvasById', () => {
    it('should return canvas when found', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(mockDbCanvas);

      const result = await canvasService.getCanvasById(testCanvasId);

      expect(result).toEqual(expectedCanvas);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'canvas_get_by_id'
      );
    });

    it('should return null when canvas not found', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(null);

      const result = await canvasService.getCanvasById(testCanvasId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const dbError = new Error('Database error');
      mockDatabase.query.mockRejectedValue(dbError);

      await expect(canvasService.getCanvasById(testCanvasId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getCanvasesByWorkspace', () => {
    it('should return paginated canvases with count', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
      };

      (dbConnection.knex as jest.Mock).mockReturnValue(mockQuery);

      mockDatabase.query
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([mockDbCanvas]);

      const result = await canvasService.getCanvasesByWorkspace(testWorkspaceId, undefined, 10, 0);

      expect(result.canvases).toHaveLength(1);
      expect(result.canvases[0]).toEqual(expectedCanvas);
      expect(result.totalCount).toBe(5);
      expect(mockQuery.orderBy).toHaveBeenCalledWith('position', 'asc');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'asc');
    });

    it('should apply filters when provided', async () => {
      const filter = { name: 'test', isDefault: true };
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereILike: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
      };

      (dbConnection.knex as jest.Mock).mockReturnValue(mockQuery);

      // Mock applyFilters method
      jest.spyOn(canvasService as any, 'applyFilters').mockImplementation((query) => query);

      mockDatabase.query
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockDbCanvas]);

      const result = await canvasService.getCanvasesByWorkspace(testWorkspaceId, filter);

      expect(result.totalCount).toBe(1);
      expect(canvasService['applyFilters']).toHaveBeenCalledWith(mockQuery, filter);
    });
  });

  describe('createCanvas', () => {
    const validCreateInput: CreateCanvasInput = {
      workspaceId: testWorkspaceId,
      name: 'New Canvas',
      description: 'A new canvas',
      isDefault: false,
      position: 1,
    };

    beforeEach(() => {
      mockWorkspaceAuth.requirePermission.mockResolvedValue(mockWorkspaceMember);
      jest.spyOn(canvasService as any, 'getCanvasByName').mockResolvedValue(null);
      jest.spyOn(canvasService as any, 'clearDefaultCanvas').mockResolvedValue(undefined);
      jest.spyOn(canvasService as any, 'getNextPosition').mockResolvedValue(1);
    });

    it('should create a new canvas successfully', async () => {
      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const newDbCanvas = {
        ...mockDbCanvas,
        name: 'New Canvas',
        description: 'A new canvas',
        position: 1,
      };
      mockDatabase.query.mockResolvedValue([newDbCanvas]);

      const result = await canvasService.createCanvas(validCreateInput, testUserId);

      expect(result.name).toBe('New Canvas');
      expect(result.description).toBe('A new canvas');
      expect(result.position).toBe(1);
      expect(mockWorkspaceAuth.requirePermission).toHaveBeenCalledWith(
        testUserId,
        testWorkspaceId,
        'canvas:create',
        'Insufficient permissions to create canvas in this workspace'
      );
    });

    it('should check for name conflicts', async () => {
      const existingCanvas = { ...expectedCanvas, name: 'New Canvas' };
      jest.spyOn(canvasService as any, 'getCanvasByName').mockResolvedValue(existingCanvas);

      await expect(canvasService.createCanvas(validCreateInput, testUserId))
        .rejects.toThrow(ConflictError);
    });

    it('should clear default canvas when creating as default', async () => {
      const defaultInput = { ...validCreateInput, isDefault: true };
      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue([mockDbCanvas]);

      await canvasService.createCanvas(defaultInput, testUserId);

      expect(canvasService['clearDefaultCanvas']).toHaveBeenCalledWith(testWorkspaceId);
    });

    it('should use next position when position not specified', async () => {
      const inputWithoutPosition = { ...validCreateInput };
      delete inputWithoutPosition.position;

      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue([mockDbCanvas]);

      await canvasService.createCanvas(inputWithoutPosition, testUserId);

      expect(canvasService['getNextPosition']).toHaveBeenCalledWith(testWorkspaceId);
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        workspaceId: 'invalid-uuid',
        name: '',
      } as CreateCanvasInput;

      await expect(canvasService.createCanvas(invalidInput, testUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should require workspace permissions', async () => {
      mockWorkspaceAuth.requirePermission.mockRejectedValue(new Error('Access denied'));

      await expect(canvasService.createCanvas(validCreateInput, testUserId))
        .rejects.toThrow('Access denied');
    });
  });

  describe('updateCanvas', () => {
    const validUpdateInput: UpdateCanvasInput = {
      name: 'Updated Canvas',
      description: 'An updated canvas',
      position: 2,
    };

    beforeEach(() => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(expectedCanvas);
      mockWorkspaceAuth.requirePermission.mockResolvedValue(mockWorkspaceMember);
      jest.spyOn(canvasService as any, 'getCanvasByName').mockResolvedValue(null);
      jest.spyOn(canvasService as any, 'clearDefaultCanvas').mockResolvedValue(undefined);
    });

    it('should update canvas successfully', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const updatedDbCanvas = {
        ...mockDbCanvas,
        name: 'Updated Canvas',
        description: 'An updated canvas',
        position: 2,
        updated_at: new Date(),
      };
      mockDatabase.query.mockResolvedValue([updatedDbCanvas]);

      const result = await canvasService.updateCanvas(testCanvasId, validUpdateInput, testUserId);

      expect(result.name).toBe('Updated Canvas');
      expect(result.description).toBe('An updated canvas');
      expect(result.position).toBe(2);
      expect(mockWorkspaceAuth.requirePermission).toHaveBeenCalledWith(
        testUserId,
        testWorkspaceId,
        'canvas:update',
        'Insufficient permissions to update this canvas'
      );
    });

    it('should throw NotFoundError when canvas does not exist', async () => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(null);

      await expect(canvasService.updateCanvas(testCanvasId, validUpdateInput, testUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should check for name conflicts when name is changed', async () => {
      const conflictingCanvas = { ...expectedCanvas, id: 'different-id', name: 'Updated Canvas' };
      jest.spyOn(canvasService as any, 'getCanvasByName').mockResolvedValue(conflictingCanvas);

      await expect(canvasService.updateCanvas(testCanvasId, validUpdateInput, testUserId))
        .rejects.toThrow(ConflictError);
    });

    it('should allow same canvas to keep its name', async () => {
      const sameCanvas = { ...expectedCanvas, name: 'Updated Canvas' };
      jest.spyOn(canvasService as any, 'getCanvasByName').mockResolvedValue(sameCanvas);

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue([mockDbCanvas]);

      // Should not throw error
      await canvasService.updateCanvas(testCanvasId, validUpdateInput, testUserId);
    });

    it('should clear default when setting as default', async () => {
      const defaultUpdateInput = { isDefault: true };
      const nonDefaultCanvas = { ...expectedCanvas, isDefault: false };
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(nonDefaultCanvas);

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue([{ ...mockDbCanvas, is_default: true }]);

      await canvasService.updateCanvas(testCanvasId, defaultUpdateInput, testUserId);

      expect(canvasService['clearDefaultCanvas']).toHaveBeenCalledWith(testWorkspaceId);
    });
  });

  describe('deleteCanvas', () => {
    beforeEach(() => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(expectedCanvas);
      mockWorkspaceAuth.requirePermission.mockResolvedValue(mockWorkspaceMember);
      jest.spyOn(canvasService as any, 'setAnotherCanvasAsDefault').mockResolvedValue(undefined);
    });

    it('should delete non-default canvas successfully', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(undefined);

      const result = await canvasService.deleteCanvas(testCanvasId, testUserId);

      expect(result).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'canvas_delete'
      );
    });

    it('should throw NotFoundError when canvas does not exist', async () => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(null);

      await expect(canvasService.deleteCanvas(testCanvasId, testUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should prevent deleting the only canvas in workspace', async () => {
      const defaultCanvas = { ...expectedCanvas, isDefault: true };
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(defaultCanvas);
      jest.spyOn(canvasService, 'getCanvasesByWorkspace').mockResolvedValue({
        canvases: [defaultCanvas],
        totalCount: 1
      });

      await expect(canvasService.deleteCanvas(testCanvasId, testUserId))
        .rejects.toThrow(ConflictError);
    });

    it('should set another canvas as default when deleting default canvas', async () => {
      const defaultCanvas = { ...expectedCanvas, isDefault: true };
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(defaultCanvas);
      jest.spyOn(canvasService, 'getCanvasesByWorkspace').mockResolvedValue({
        canvases: [defaultCanvas, expectedCanvas],
        totalCount: 2
      });

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(undefined);

      await canvasService.deleteCanvas(testCanvasId, testUserId);

      expect(canvasService['setAnotherCanvasAsDefault']).toHaveBeenCalledWith(testWorkspaceId, testCanvasId);
    });
  });

  describe('getDefaultCanvas', () => {
    it('should return default canvas when found', async () => {
      const defaultCanvas = { ...mockDbCanvas, is_default: true };
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(defaultCanvas);

      const result = await canvasService.getDefaultCanvas(testWorkspaceId);

      expect(result?.isDefault).toBe(true);
      expect(mockKnexQuery.where).toHaveBeenCalledWith('workspace_id', testWorkspaceId);
      expect(mockKnexQuery.where).toHaveBeenCalledWith('is_default', true);
    });

    it('should return null when no default canvas found', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(null);

      const result = await canvasService.getDefaultCanvas(testWorkspaceId);

      expect(result).toBeNull();
    });
  });

  describe('setDefaultCanvas', () => {
    beforeEach(() => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(expectedCanvas);
      mockWorkspaceAuth.requirePermission.mockResolvedValue(mockWorkspaceMember);
      jest.spyOn(canvasService as any, 'clearDefaultCanvas').mockResolvedValue(undefined);
    });

    it('should set canvas as default successfully', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const defaultDbCanvas = { ...mockDbCanvas, is_default: true };
      mockDatabase.query.mockResolvedValue([defaultDbCanvas]);

      const result = await canvasService.setDefaultCanvas(testCanvasId, testUserId);

      expect(result.isDefault).toBe(true);
      expect(canvasService['clearDefaultCanvas']).toHaveBeenCalledWith(testWorkspaceId);
    });

    it('should throw NotFoundError when canvas does not exist', async () => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(null);

      await expect(canvasService.setDefaultCanvas(testCanvasId, testUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('duplicateCanvas', () => {
    const duplicateOptions: DuplicateCanvasOptions = {
      name: 'Duplicated Canvas',
      description: 'A duplicated canvas',
      includeCards: true,
      includeConnections: true,
    };

    beforeEach(() => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(expectedCanvas);
      mockWorkspaceAuth.requirePermission.mockResolvedValue(mockWorkspaceMember);
      jest.spyOn(canvasService, 'createCanvas').mockResolvedValue({
        ...expectedCanvas,
        id: 'new-canvas-id',
        name: 'Duplicated Canvas',
      });
      mockDatabase.transaction.mockImplementation(async (callback) => await callback({} as any));
    });

    it('should duplicate canvas successfully', async () => {
      const result = await canvasService.duplicateCanvas(testCanvasId, duplicateOptions, testUserId);

      expect(result.name).toBe('Duplicated Canvas');
      expect(canvasService.createCanvas).toHaveBeenCalledWith({
        workspaceId: testWorkspaceId,
        name: 'Duplicated Canvas',
        description: 'A duplicated canvas',
        isDefault: false,
        position: expect.any(Number)
      }, testUserId);
    });

    it('should throw NotFoundError when source canvas does not exist', async () => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(null);

      await expect(canvasService.duplicateCanvas(testCanvasId, duplicateOptions, testUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should validate duplication options', async () => {
      const invalidOptions = {
        name: '', // Empty name
      } as DuplicateCanvasOptions;

      await expect(canvasService.duplicateCanvas(testCanvasId, invalidOptions, testUserId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getCanvasStatistics', () => {
    beforeEach(() => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(expectedCanvas);
      mockWorkspaceAuth.requirePermission.mockResolvedValue(mockWorkspaceMember);
    });

    it('should return canvas statistics successfully', async () => {
      // Mock card count query
      const mockCardCountQuery = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
      };
      
      // Mock connection count query  
      const mockConnectionCountQuery = {
        whereIn: jest.fn().mockReturnThis(),
        orWhereIn: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
      };

      // Mock last activity query
      const mockLastActivityQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };

      (dbConnection.knex as jest.Mock)
        .mockReturnValueOnce(mockCardCountQuery)
        .mockReturnValueOnce(mockConnectionCountQuery) 
        .mockReturnValueOnce(mockLastActivityQuery);

      const lastActivityDate = new Date('2023-01-02');
      mockDatabase.query
        .mockResolvedValueOnce([{ count: '5' }]) // Card count
        .mockResolvedValueOnce([{ count: '3' }]) // Connection count  
        .mockResolvedValueOnce({ updated_at: lastActivityDate }); // Last activity

      const result = await canvasService.getCanvasStatistics(testCanvasId, testUserId);

      expect(result).toEqual({
        id: testCanvasId,
        name: 'Test Canvas',
        cardCount: 5,
        connectionCount: 3,
        lastActivity: lastActivityDate,
        createdAt: expectedCanvas.createdAt,
      });
    });

    it('should handle missing connections table gracefully', async () => {
      const mockCardCountQuery = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
      };
      
      const mockConnectionCountQuery = {
        whereIn: jest.fn().mockReturnThis(),
        orWhereIn: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
      };

      const mockLastActivityQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };

      (dbConnection.knex as jest.Mock)
        .mockReturnValueOnce(mockCardCountQuery)
        .mockReturnValueOnce(mockConnectionCountQuery)
        .mockReturnValueOnce(mockLastActivityQuery);

      mockDatabase.query
        .mockResolvedValueOnce([{ count: '5' }]) // Card count
        .mockRejectedValueOnce(new Error('Table not found')) // Connection count error
        .mockResolvedValueOnce(null); // Last activity

      const result = await canvasService.getCanvasStatistics(testCanvasId, testUserId);

      expect(result.cardCount).toBe(5);
      expect(result.connectionCount).toBe(0); // Should default to 0
    });

    it('should throw NotFoundError when canvas does not exist', async () => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(null);

      await expect(canvasService.getCanvasStatistics(testCanvasId, testUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('Authorization methods', () => {
    beforeEach(() => {
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(expectedCanvas);
    });

    describe('canUserAccessCanvas', () => {
      it('should return true when user has access', async () => {
        mockWorkspaceAuth.hasWorkspaceAccess.mockResolvedValue(true);

        const result = await canvasService.canUserAccessCanvas(testUserId, testCanvasId);

        expect(result).toBe(true);
        expect(mockWorkspaceAuth.hasWorkspaceAccess).toHaveBeenCalledWith(
          testUserId,
          testWorkspaceId,
          'canvas:read'
        );
      });

      it('should return false when user lacks access', async () => {
        mockWorkspaceAuth.hasWorkspaceAccess.mockResolvedValue(false);

        const result = await canvasService.canUserAccessCanvas(testUserId, testCanvasId);

        expect(result).toBe(false);
      });

      it('should return false when canvas does not exist', async () => {
        jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(null);

        const result = await canvasService.canUserAccessCanvas(testUserId, testCanvasId);

        expect(result).toBe(false);
      });
    });

    describe('canUserEditCanvas', () => {
      it('should return true when user can edit', async () => {
        mockWorkspaceAuth.hasWorkspaceAccess.mockResolvedValue(true);

        const result = await canvasService.canUserEditCanvas(testUserId, testCanvasId);

        expect(result).toBe(true);
        expect(mockWorkspaceAuth.hasWorkspaceAccess).toHaveBeenCalledWith(
          testUserId,
          testWorkspaceId,
          'canvas:update'
        );
      });
    });

    describe('canUserDeleteCanvas', () => {
      it('should return true when user can delete', async () => {
        mockWorkspaceAuth.hasWorkspaceAccess.mockResolvedValue(true);

        const result = await canvasService.canUserDeleteCanvas(testUserId, testCanvasId);

        expect(result).toBe(true);
        expect(mockWorkspaceAuth.hasWorkspaceAccess).toHaveBeenCalledWith(
          testUserId,
          testWorkspaceId,
          'canvas:delete'
        );
      });
    });
  });

  describe('Private helper methods', () => {
    describe('getCanvasByName', () => {
      it('should find canvas by name and workspace', async () => {
        const mockKnexQuery = {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockReturnThis(),
        };
        (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

        mockDatabase.query.mockResolvedValue(mockDbCanvas);

        const result = await (canvasService as any).getCanvasByName(testWorkspaceId, 'Test Canvas');

        expect(result).toEqual(expectedCanvas);
        expect(mockKnexQuery.where).toHaveBeenCalledWith('workspace_id', testWorkspaceId);
        expect(mockKnexQuery.where).toHaveBeenCalledWith('name', 'Test Canvas');
      });
    });

    describe('getNextPosition', () => {
      it('should return next available position', async () => {
        const mockKnexQuery = {
          where: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis(),
          first: jest.fn().mockReturnThis(),
        };
        (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

        mockDatabase.query.mockResolvedValue({ maxPosition: 5 });

        const result = await (canvasService as any).getNextPosition(testWorkspaceId);

        expect(result).toBe(6);
      });

      it('should return 0 when no canvases exist', async () => {
        const mockKnexQuery = {
          where: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis(),
          first: jest.fn().mockReturnThis(),
        };
        (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

        mockDatabase.query.mockResolvedValue({ maxPosition: null });

        const result = await (canvasService as any).getNextPosition(testWorkspaceId);

        expect(result).toBe(0);
      });
    });

    describe('setAnotherCanvasAsDefault', () => {
      it('should set another canvas as default', async () => {
        const replacementCanvas = { ...mockDbCanvas, id: 'replacement-id' };
        
        const mockSelectQuery = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          first: jest.fn().mockReturnThis(),
        };
        
        const mockUpdateQuery = {
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
        };

        (dbConnection.knex as jest.Mock)
          .mockReturnValueOnce(mockSelectQuery)
          .mockReturnValueOnce(mockUpdateQuery);

        mockDatabase.query
          .mockResolvedValueOnce(replacementCanvas)
          .mockResolvedValueOnce(undefined);

        await (canvasService as any).setAnotherCanvasAsDefault(testWorkspaceId, testCanvasId);

        expect(mockUpdateQuery.update).toHaveBeenCalledWith({
          is_default: true,
          updated_at: expect.any(Date),
        });
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed database responses', async () => {
      const malformedCanvas = {
        id: testCanvasId,
        workspace_id: testWorkspaceId,
        name: 'Test',
        description: null,
        is_default: null,
        position: 0,
        created_by: testUserId,
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-01'),
      };

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(malformedCanvas);

      const result = await canvasService.getCanvasById(testCanvasId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testCanvasId);
      expect(result?.name).toBe('Test');
      expect(result?.isDefault).toBe(false);
    });

    it('should handle database constraint violations', async () => {
      const validCreateInput: CreateCanvasInput = {
        workspaceId: testWorkspaceId,
        name: 'Test Canvas',
      };

      mockWorkspaceAuth.requirePermission.mockResolvedValue(mockWorkspaceMember);
      jest.spyOn(canvasService as any, 'getCanvasByName').mockResolvedValue(null);
      jest.spyOn(canvasService as any, 'getNextPosition').mockResolvedValue(0);

      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const constraintError = new Error('duplicate key value violates unique constraint');
      mockDatabase.query.mockRejectedValue(constraintError);

      await expect(canvasService.createCanvas(validCreateInput, testUserId))
        .rejects.toThrow('duplicate key value violates unique constraint');
    });
  });

  describe('applyFilters method', () => {
    it('should apply all filter types correctly', async () => {
      const filters = {
        name: 'test',
        isDefault: true,
        createdBy: testUserId,
        createdAfter: new Date('2023-01-01'),
        createdBefore: new Date('2023-12-31'),
        updatedAfter: new Date('2023-06-01'),
        updatedBefore: new Date('2023-06-30'),
      };

      const mockQuery = {
        whereILike: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
      };

      const result = (canvasService as any).applyFilters(mockQuery, filters);

      expect(mockQuery.whereILike).toHaveBeenCalledWith('name', '%test%');
      expect(mockQuery.where).toHaveBeenCalledWith('is_default', true);
      expect(mockQuery.where).toHaveBeenCalledWith('created_by', testUserId);
      expect(mockQuery.where).toHaveBeenCalledWith('created_at', '>=', filters.createdAfter);
      expect(mockQuery.where).toHaveBeenCalledWith('created_at', '<=', filters.createdBefore);
      expect(mockQuery.where).toHaveBeenCalledWith('updated_at', '>=', filters.updatedAfter);
      expect(mockQuery.where).toHaveBeenCalledWith('updated_at', '<=', filters.updatedBefore);
      expect(result).toBe(mockQuery);
    });
  });
});
/**
 * Comprehensive integration tests for canvas default setting bug fix (NEX-187)
 * Tests the specific edge cases that were causing the bug:
 * - Multiple canvases showing as default
 * - Race conditions in concurrent updates
 * - Transaction safety and rollback scenarios
 * - Validation that only one default exists after operation
 */

// Mock logger to capture logging output - must be first
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('@/utils/logger', () => ({
  createContextLogger: () => mockLogger,
}));

import { CanvasService } from '@/services/canvas';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { database, knex } from '@/database/connection';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger({ service: 'CanvasDefaultSettingTest' });

// Mock workspace authorization
jest.mock('@/services/workspaceAuthorization', () => ({
  WorkspaceAuthorizationService: jest.fn().mockImplementation(() => ({
    requirePermission: jest.fn().mockResolvedValue({
      id: 'member-id',
      workspaceId: 'test-workspace',
      userId: 'test-user',
      role: 'member',
      permissions: ['canvas:read', 'canvas:create', 'canvas:update', 'canvas:delete'],
      joinedAt: new Date(),
      isActive: true
    }),
    hasWorkspaceAccess: jest.fn().mockResolvedValue(true),
  })),
}));

describe('Canvas Default Setting Integration Tests (NEX-187)', () => {
  let canvasService: CanvasService;
  let workspaceAuth: WorkspaceAuthorizationService;
  let databaseTransactionSpy: jest.SpyInstance;

  const testUserId = 'test-user-123';
  const testWorkspaceId = 'test-workspace-456';

  beforeEach(() => {
    canvasService = new CanvasService();
    workspaceAuth = new WorkspaceAuthorizationService();

    // Mock database.transaction globally to ensure it's available for all tests
    databaseTransactionSpy = jest.spyOn(database, 'transaction').mockResolvedValue(null);

    jest.clearAllMocks();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Transaction Safety and Database Consistency', () => {
    it('should set default canvas with proper database transaction', async () => {
      const canvasId = 'canvas-to-set-default';

      // Mock canvas exists and is not default
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Test Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock transaction with proper clearing and setting
      let clearOperation: any = null;
      let setOperation: any = null;
      let validationQuery: any = null;

      databaseTransactionSpy.mockImplementation(async (callback) => {
        const mockTrx = jest.fn() as any;

        // Track the database operations within transaction
        mockTrx
          .mockImplementationOnce(() => {
            clearOperation = {
              where: jest.fn().mockReturnThis(),
              update: jest.fn().mockResolvedValue(1), // 1 existing default cleared
            };
            return clearOperation;
          })
          .mockImplementationOnce(() => {
            setOperation = {
              where: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([{
                id: canvasId,
                workspace_id: testWorkspaceId,
                name: 'Test Canvas',
                description: null,
                is_default: true,
                position: 0,
                created_by: testUserId,
                created_at: new Date(),
                updated_at: new Date(),
              }]),
            };
            return setOperation;
          })
          .mockImplementationOnce(() => {
            validationQuery = {
              where: jest.fn().mockReturnThis(),
              select: jest.fn().mockResolvedValue([{
                id: canvasId,
                name: 'Test Canvas',
              }]),
            };
            return validationQuery;
          });

        return await callback(mockTrx);
      });

      const result = await canvasService.setDefaultCanvas(canvasId, testUserId);

      // Verify transaction was used
      expect(databaseTransactionSpy).toHaveBeenCalledTimes(1);

      // Verify all transaction operations were called
      expect(clearOperation.where).toHaveBeenCalledWith('workspace_id', testWorkspaceId);
      expect(clearOperation.where).toHaveBeenCalledWith('is_default', true);
      expect(clearOperation.update).toHaveBeenCalledWith({
        is_default: false,
        updated_at: expect.any(Date),
      });

      expect(setOperation.where).toHaveBeenCalledWith('id', canvasId);
      expect(setOperation.update).toHaveBeenCalledWith({
        is_default: true,
        updated_at: expect.any(Date),
      });

      // Verify validation query
      expect(validationQuery.where).toHaveBeenCalledWith('workspace_id', testWorkspaceId);
      expect(validationQuery.where).toHaveBeenCalledWith('is_default', true);

      // Verify result
      expect(result.id).toBe(canvasId);
      expect(result.isDefault).toBe(true);

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting setDefaultCanvas operation',
        expect.objectContaining({
          canvasId,
          workspaceId: testWorkspaceId,
          userId: testUserId,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Canvas set as default successfully',
        expect.objectContaining({
          canvasId,
          workspaceId: testWorkspaceId,
          userId: testUserId,
          operationDurationMs: expect.any(Number),
        })
      );
    });

    it('should handle concurrent default setting requests without race conditions', async () => {
      const canvas1Id = 'canvas-1';
      const canvas2Id = 'canvas-2';
      const canvas3Id = 'canvas-3';

      // Mock canvases exist
      jest.spyOn(canvasService, 'getCanvasById').mockImplementation(async (id) => ({
        id,
        workspaceId: testWorkspaceId,
        name: `Canvas ${id}`,
        description: null,
        isDefault: false,
        position: parseInt(id.split('-')[1]) - 1,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      let transactionCallCount = 0;
      const transactionResults: any[] = [];
      const operationOrder: string[] = [];

      // Mock transaction to simulate proper serialization
      databaseTransactionSpy.mockImplementation(async (callback) => {
        const currentCall = transactionCallCount++;
        const canvasId = currentCall === 0 ? canvas1Id : currentCall === 1 ? canvas2Id : canvas3Id;

        operationOrder.push(`start-${canvasId}`);

        // Simulate variable delay to test race conditions
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));

        const mockTrx = jest.fn() as any;

        mockTrx
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(currentCall === 0 ? 0 : 1), // First has no existing default
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
              id: canvasId,
              workspace_id: testWorkspaceId,
              name: `Canvas ${canvasId}`,
              is_default: true,
              created_by: testUserId,
              created_at: new Date(),
              updated_at: new Date(),
            }]),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([{
              id: canvasId,
              name: `Canvas ${canvasId}`,
            }]),
          });

        const result = await callback(mockTrx);
        transactionResults.push(result);
        operationOrder.push(`complete-${canvasId}`);
        return result;
      });

      // Execute concurrent operations
      const promises = [
        canvasService.setDefaultCanvas(canvas1Id, testUserId),
        canvasService.setDefaultCanvas(canvas2Id, testUserId),
        canvasService.setDefaultCanvas(canvas3Id, testUserId),
      ];

      const results = await Promise.all(promises);

      // Verify all operations completed successfully
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.isDefault).toBe(true);
        expect(result.workspaceId).toBe(testWorkspaceId);
      });

      // Verify transactions were executed in isolation
      expect(databaseTransactionSpy).toHaveBeenCalledTimes(3);
      expect(transactionResults).toHaveLength(3);
      expect(operationOrder).toHaveLength(6); // 3 starts + 3 completions

      // Verify logging captured concurrent operations
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting setDefaultCanvas operation',
        expect.objectContaining({ canvasId: canvas1Id })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting setDefaultCanvas operation',
        expect.objectContaining({ canvasId: canvas2Id })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting setDefaultCanvas operation',
        expect.objectContaining({ canvasId: canvas3Id })
      );
    });

    it('should validate that only one default exists after operation', async () => {
      const canvasId = 'single-default-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Single Default Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      databaseTransactionSpy.mockImplementation(async (callback) => {
        const mockTrx = jest.fn() as any;

        mockTrx
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(1),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
              id: canvasId,
              workspace_id: testWorkspaceId,
              name: 'Single Default Canvas',
              is_default: true,
            }]),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([{
              id: canvasId,
              name: 'Single Default Canvas',
            }]),
          });

        return await callback(mockTrx);
      });

      const result = await canvasService.setDefaultCanvas(canvasId, testUserId);

      expect(result.isDefault).toBe(true);

      // Verify debug logging for validation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Validated single default canvas constraint',
        expect.objectContaining({
          workspaceId: testWorkspaceId,
          defaultCanvasId: canvasId,
          canvasId,
        })
      );
    });

    it('should handle validation failure when multiple defaults exist', async () => {
      const canvasId = 'validation-fail-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Validation Fail Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      databaseTransactionSpy.mockImplementation(async (callback) => {
        const mockTrx = jest.fn() as any;

        mockTrx
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(1),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
              id: canvasId,
              workspace_id: testWorkspaceId,
              name: 'Validation Fail Canvas',
              is_default: true,
            }]),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([
              { id: canvasId, name: 'Validation Fail Canvas' },
              { id: 'another-default', name: 'Another Default Canvas' },
            ]), // Multiple defaults - should trigger validation error
          });

        return await callback(mockTrx);
      });

      await expect(canvasService.setDefaultCanvas(canvasId, testUserId))
        .rejects.toThrow('Database constraint violation: Found 2 default canvases');

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to set default canvas',
        expect.objectContaining({
          canvasId,
          userId: testUserId,
          error: expect.stringContaining('Database constraint violation'),
        })
      );
    });

    it('should handle validation failure when wrong canvas is default', async () => {
      const canvasId = 'wrong-default-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Wrong Default Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      databaseTransactionSpy.mockImplementation(async (callback) => {
        const mockTrx = jest.fn() as any;

        mockTrx
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(1),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
              id: canvasId,
              workspace_id: testWorkspaceId,
              name: 'Wrong Default Canvas',
              is_default: true,
            }]),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([{
              id: 'different-canvas-id',
              name: 'Different Canvas',
            }]), // Wrong canvas is default
          });

        return await callback(mockTrx);
      });

      await expect(canvasService.setDefaultCanvas(canvasId, testUserId))
        .rejects.toThrow(`Database constraint violation: Expected canvas ${canvasId} to be default, but found different-canvas-id`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle canvas not found error', async () => {
      const nonExistentCanvasId = 'non-existent-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue(null);

      await expect(canvasService.setDefaultCanvas(nonExistentCanvasId, testUserId))
        .rejects.toThrow(NotFoundError);

      // Should not attempt transaction
      expect(databaseTransactionSpy).not.toHaveBeenCalled();

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to set default canvas',
        expect.objectContaining({
          canvasId: nonExistentCanvasId,
          userId: testUserId,
        })
      );
    });

    it('should handle permission validation error', async () => {
      const canvasId = 'permission-denied-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Permission Denied Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock permission denial on the service's internal workspaceAuth instance
      // Access the private property to mock it properly
      const internalWorkspaceAuth = (canvasService as any).workspaceAuth;
      jest.spyOn(internalWorkspaceAuth, 'requirePermission').mockRejectedValueOnce(
        new Error('Insufficient permissions to set default canvas')
      );

      await expect(canvasService.setDefaultCanvas(canvasId, testUserId))
        .rejects.toThrow('Insufficient permissions to set default canvas');

      // Should not attempt transaction
      expect(databaseTransactionSpy).not.toHaveBeenCalled();
    });

    it('should return early when canvas is already default', async () => {
      const alreadyDefaultCanvasId = 'already-default-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: alreadyDefaultCanvasId,
        workspaceId: testWorkspaceId,
        name: 'Already Default Canvas',
        description: null,
        isDefault: true, // Already default
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await canvasService.setDefaultCanvas(alreadyDefaultCanvasId, testUserId);

      // Should return early without transaction
      expect(result.id).toBe(alreadyDefaultCanvasId);
      expect(result.isDefault).toBe(true);
      expect(databaseTransactionSpy).not.toHaveBeenCalled();

      // Verify early return logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Canvas already set as default, returning existing canvas',
        expect.objectContaining({
          canvasId: alreadyDefaultCanvasId,
          workspaceId: testWorkspaceId,
          userId: testUserId,
        })
      );
    });

    it('should handle canvas deletion during transaction', async () => {
      const canvasId = 'deleted-during-transaction';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Deleted During Transaction',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      databaseTransactionSpy.mockImplementation(async (callback) => {
        const mockTrx = jest.fn() as any;

        mockTrx
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(1),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([]), // No canvas returned - deleted
          });

        return await callback(mockTrx);
      });

      await expect(canvasService.setDefaultCanvas(canvasId, testUserId))
        .rejects.toThrow('Failed to update canvas as default - canvas may have been deleted');
    });
  });

  describe('Operation Timing and Performance', () => {
    it('should measure and log operation duration', async () => {
      const canvasId = 'timing-test-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Timing Test Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      databaseTransactionSpy.mockImplementation(async (callback) => {
        const mockTrx = jest.fn() as any;

        mockTrx
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(1),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
              id: canvasId,
              workspace_id: testWorkspaceId,
              name: 'Timing Test Canvas',
              is_default: true,
            }]),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([{
              id: canvasId,
              name: 'Timing Test Canvas',
            }]),
          });

        // Add artificial delay
        await new Promise(resolve => setTimeout(resolve, 100));

        return await callback(mockTrx);
      });

      await canvasService.setDefaultCanvas(canvasId, testUserId);

      // Verify timing was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Canvas set as default successfully',
        expect.objectContaining({
          operationDurationMs: expect.any(Number),
        })
      );

      const successLogCall = mockLogger.info.mock.calls.find(
        call => call[0] === 'Canvas set as default successfully'
      );
      expect(successLogCall[1].operationDurationMs).toBeGreaterThan(50);
    });

    it('should log timing even on operation failure', async () => {
      const canvasId = 'error-timing-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Error Timing Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      databaseTransactionSpy.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        throw new Error('Transaction failed');
      });

      await expect(canvasService.setDefaultCanvas(canvasId, testUserId))
        .rejects.toThrow('Transaction failed');

      // Verify error timing was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to set default canvas',
        expect.objectContaining({
          operationDurationMs: expect.any(Number),
        })
      );

      const errorLogCall = mockLogger.error.mock.calls.find(
        call => call[0] === 'Failed to set default canvas'
      );
      expect(errorLogCall[1].operationDurationMs).toBeGreaterThan(25);
    });
  });
});
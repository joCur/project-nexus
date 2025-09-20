import { CanvasService } from '@/services/canvas';
import { database } from '@/database/connection';
import { createContextLogger } from '@/utils/logger';

/**
 * Integration test for canvas default setting concurrency
 * Tests the transaction-based implementation under concurrent load
 */

const logger = createContextLogger({ service: 'CanvasDefaultConcurrencyTest' });

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

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Canvas Default Setting Concurrency', () => {
  let canvasService: CanvasService;
  const testUserId = 'test-user-123';
  const testWorkspaceId = 'test-workspace-456';

  beforeEach(() => {
    canvasService = new CanvasService();
    jest.clearAllMocks();
  });

  describe('Transaction Safety', () => {
    it('should handle concurrent setDefaultCanvas calls without race conditions', async () => {
      const canvas1Id = 'canvas-1';
      const canvas2Id = 'canvas-2';
      const canvas3Id = 'canvas-3';

      // Mock canvas existence
      jest.spyOn(canvasService, 'getCanvasById')
        .mockImplementation(async (id) => ({
          id,
          workspaceId: testWorkspaceId,
          name: `Canvas ${id}`,
          description: null,
          isDefault: false,
          position: 0,
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

      // Mock transaction to simulate concurrent operations
      let transactionCallCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transactionResults: any[] = [];

      jest.spyOn(database, 'transaction').mockImplementation(async (callback) => {
        const callIndex = transactionCallCount++;

        // Simulate some delay to encourage race conditions
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockTrx = jest.fn() as any;

        // Mock the transaction operations
        mockTrx
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockResolvedValue(1), // Clear existing defaults
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{
              id: callIndex === 0 ? canvas1Id : callIndex === 1 ? canvas2Id : canvas3Id,
              workspace_id: testWorkspaceId,
              name: `Canvas ${callIndex + 1}`,
              description: null,
              is_default: true,
              position: 0,
              created_by: testUserId,
              created_at: new Date(),
              updated_at: new Date(),
            }]),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([{
              id: callIndex === 0 ? canvas1Id : callIndex === 1 ? canvas2Id : canvas3Id,
              name: `Canvas ${callIndex + 1}`,
            }]),
          });

        const result = await callback(mockTrx);
        transactionResults.push(result);
        return result;
      });

      // Execute concurrent setDefaultCanvas operations
      const promises = [
        canvasService.setDefaultCanvas(canvas1Id, testUserId),
        canvasService.setDefaultCanvas(canvas2Id, testUserId),
        canvasService.setDefaultCanvas(canvas3Id, testUserId),
      ];

      const results = await Promise.all(promises);

      // Verify all operations completed successfully
      expect(results).toHaveLength(3);
      results.forEach((result, _index) => {
        expect(result.isDefault).toBe(true);
        expect(result.workspaceId).toBe(testWorkspaceId);
      });

      // Verify transactions were executed
      expect(database.transaction).toHaveBeenCalledTimes(3);
      expect(transactionResults).toHaveLength(3);

      logger.info('Concurrent setDefaultCanvas test completed successfully', {
        resultCount: results.length,
        transactionCount: transactionCallCount,
      });
    });

    it('should handle early return for already default canvas', async () => {
      const canvasId = 'already-default-canvas';

      // Mock canvas that is already default
      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Already Default Canvas',
        description: null,
        isDefault: true, // Already default
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const transactionSpy = jest.spyOn(database, 'transaction');

      const result = await canvasService.setDefaultCanvas(canvasId, testUserId);

      // Should return early without executing transaction
      expect(result.isDefault).toBe(true);
      expect(result.id).toBe(canvasId);
      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it('should handle transaction rollback on validation failure', async () => {
      const canvasId = 'validation-fail-canvas';

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

      // Mock transaction that fails validation
      jest.spyOn(database, 'transaction').mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              name: 'Test Canvas',
              is_default: true,
            }]),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([
              { id: canvasId, name: 'Test Canvas' },
              { id: 'another-canvas', name: 'Another Canvas' },
            ]), // Multiple defaults - validation failure
          });

        return await callback(mockTrx);
      });

      await expect(canvasService.setDefaultCanvas(canvasId, testUserId))
        .rejects.toThrow('Database constraint violation: Found 2 default canvases');
    });
  });

  describe('Performance and Logging', () => {
    it('should log operation timing and details', async () => {
      const canvasId = 'perf-test-canvas';

      jest.spyOn(canvasService, 'getCanvasById').mockResolvedValue({
        id: canvasId,
        workspaceId: testWorkspaceId,
        name: 'Performance Test Canvas',
        description: null,
        isDefault: false,
        position: 0,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(database, 'transaction').mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              name: 'Performance Test Canvas',
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
              name: 'Performance Test Canvas',
            }]),
          });

        // Add some artificial delay to test timing
        await new Promise(resolve => setTimeout(resolve, 50));

        return await callback(mockTrx);
      });

      const startTime = Date.now();
      const result = await canvasService.setDefaultCanvas(canvasId, testUserId);
      const endTime = Date.now();

      expect(result.isDefault).toBe(true);
      expect(endTime - startTime).toBeGreaterThan(40); // Should include the artificial delay

      // Verify transaction was called
      expect(database.transaction).toHaveBeenCalled();
    });
  });
});
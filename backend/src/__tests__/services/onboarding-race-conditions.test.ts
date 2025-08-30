import { OnboardingService, OnboardingProgress } from '@/services/onboarding';
import { database } from '@/database/connection';
import { ValidationError } from '@/utils/errors';
import { Knex } from 'knex';

// Mock database connection with transaction support
jest.mock('@/database/connection', () => ({
  database: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
  knex: jest.fn(),
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

describe('OnboardingService - Race Condition Prevention (NEX-178)', () => {
  let onboardingService: OnboardingService;
  const mockDatabase = database as jest.Mocked<typeof database>;

  // Helper to create a proper transaction mock
  const createMockTransaction = (): any => {
    const mockTrx = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      // Add essential transaction properties
      isCompleted: false,
      query: jest.fn(),
      raw: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      commit: jest.fn(),
      rollback: jest.fn(),
      savepoint: jest.fn(),
      executionPromise: Promise.resolve([]),
    };
    return mockTrx;
  };

  // Test data
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testUser2Id = '123e4567-e89b-12d3-a456-426614174001';

  const mockDbOnboarding = {
    id: 'onboarding-id-1',
    user_id: testUserId,
    completed: false,
    completed_at: null,
    current_step: 1,
    final_step: null,
    tutorial_progress: { profileSetup: false },
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
  };

  const completedDbOnboarding = {
    ...mockDbOnboarding,
    id: 'onboarding-id-completed',
    completed: true,
    completed_at: new Date('2024-01-01T12:00:00Z'),
    current_step: 3,
    final_step: 3,
    tutorial_progress: {
      profileSetup: true,
      workspaceIntro: true,
      firstCard: true,
    },
  };

  beforeEach(() => {
    onboardingService = new OnboardingService();
    jest.clearAllMocks();
  });

  describe('Transaction-Based Race Condition Prevention', () => {
    it('should use transactions with row locking for updateProgress', async () => {
      const mockTrx = createMockTransaction();

      // Mock transaction callback
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock that record exists
        mockTrx.first.mockResolvedValue(mockDbOnboarding);
        mockTrx.update.mockReturnThis();
        mockTrx.returning.mockResolvedValue([{ ...mockDbOnboarding, current_step: 2 }]);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      };

      const result = await onboardingService.updateProgress(input);

      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(mockTrx.forUpdate).toHaveBeenCalled(); // Row locking
      expect(result.currentStep).toBe(2);
    });

    it('should create new record within transaction if none exists', async () => {
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock that no record exists
        mockTrx.first.mockResolvedValue(null);
        mockTrx.insert.mockReturnThis();
        mockTrx.returning.mockResolvedValue([{ ...mockDbOnboarding, current_step: 1 }]);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        currentStep: 1,
        tutorialProgress: { profileSetup: false },
      };

      const result = await onboardingService.updateProgress(input);

      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(mockTrx.forUpdate).toHaveBeenCalled();
      expect(mockTrx.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: testUserId,
        current_step: 1,
        completed: false,
      }));
      expect(result.currentStep).toBe(1);
    });

    it('should use transactions with row locking for completeOnboarding', async () => {
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock incomplete record exists
        mockTrx.first.mockResolvedValue(mockDbOnboarding);
        mockTrx.update.mockReturnThis();
        mockTrx.returning.mockResolvedValue([completedDbOnboarding]);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        tutorialProgress: {
          profileSetup: true,
          workspaceIntro: true,
          firstCard: true,
        },
      };

      const result = await onboardingService.completeOnboarding(input);

      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(mockTrx.forUpdate).toHaveBeenCalled();
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeDefined();
    });

    it('should prevent double completion within transaction', async () => {
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock already completed record
        mockTrx.first.mockResolvedValue(completedDbOnboarding);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        tutorialProgress: { additional: true },
      };

      const result = await onboardingService.completeOnboarding(input);

      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(mockTrx.forUpdate).toHaveBeenCalled();
      // Should return existing completed onboarding without modification
      expect(result.completed).toBe(true);
    });

    it('should handle transaction rollback on errors', async () => {
      const transactionError = new Error('Transaction failed');

      mockDatabase.transaction.mockImplementation(async (callback) => {
        const mockTrx = createMockTransaction();

        // Simulate transaction failure
        mockTrx.first!.mockRejectedValue(transactionError);
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      };

      await expect(onboardingService.updateProgress(input))
        .rejects.toThrow('Transaction failed');
    });
  });

  describe('Concurrent Modification Scenarios', () => {
    it('should handle concurrent updateProgress calls correctly', async () => {
      let transactionCount = 0;
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        transactionCount++;
        const currentStep = transactionCount === 1 ? 1 : 2; // Simulate progression
        
        mockTrx.first.mockResolvedValue({
          ...mockDbOnboarding,
          current_step: currentStep,
        });
        mockTrx.update.mockReturnThis();
        mockTrx.returning.mockResolvedValue([{
          ...mockDbOnboarding,
          current_step: currentStep + 1,
        }]);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input1 = {
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      };

      const input2 = {
        userId: testUserId,
        currentStep: 3,
        tutorialProgress: { workspaceIntro: true },
      };

      // Execute concurrent updates
      const [result1, result2] = await Promise.all([
        onboardingService.updateProgress(input1),
        onboardingService.updateProgress(input2),
      ]);

      expect(mockDatabase.transaction).toHaveBeenCalledTimes(2);
      expect(mockTrx.forUpdate).toHaveBeenCalledTimes(2);
      expect(result1.currentStep).toBeGreaterThan(0);
      expect(result2.currentStep).toBeGreaterThan(0);
    });

    it('should handle concurrent completion attempts', async () => {
      let completionCount = 0;
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        completionCount++;
        
        if (completionCount === 1) {
          // First completion - record is not yet completed
          mockTrx.first.mockResolvedValue(mockDbOnboarding);
          mockTrx.update.mockReturnThis();
          mockTrx.returning.mockResolvedValue([completedDbOnboarding]);
        } else {
          // Second completion - record is already completed
          mockTrx.first.mockResolvedValue(completedDbOnboarding);
        }
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        tutorialProgress: { finalStep: true },
      };

      // Execute concurrent completions
      const [result1, result2] = await Promise.all([
        onboardingService.completeOnboarding(input),
        onboardingService.completeOnboarding(input),
      ]);

      expect(mockDatabase.transaction).toHaveBeenCalledTimes(2);
      expect(result1.completed).toBe(true);
      expect(result2.completed).toBe(true);
      // Both should return the same completion state
      expect(result1.completedAt).toEqual(result2.completedAt);
    });

    it('should handle mixed concurrent operations (update and complete)', async () => {
      let operationCount = 0;
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        operationCount++;
        
        if (operationCount === 1) {
          // Update operation - record at step 2
          mockTrx.first.mockResolvedValue({ ...mockDbOnboarding, current_step: 2 });
          mockTrx.update.mockReturnThis();
          mockTrx.returning.mockResolvedValue([{ ...mockDbOnboarding, current_step: 3 }]);
        } else {
          // Complete operation - record is at step 3, ready to complete
          mockTrx.first.mockResolvedValue({ ...mockDbOnboarding, current_step: 3 });
          mockTrx.update.mockReturnThis();
          mockTrx.returning.mockResolvedValue([completedDbOnboarding]);
        }
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const updateInput = {
        userId: testUserId,
        currentStep: 3,
        tutorialProgress: { workspaceIntro: true },
      };

      const completeInput = {
        userId: testUserId,
        tutorialProgress: { finalStep: true },
      };

      // Execute concurrent update and complete
      const [updateResult, completeResult] = await Promise.all([
        onboardingService.updateProgress(updateInput),
        onboardingService.completeOnboarding(completeInput),
      ]);

      expect(mockDatabase.transaction).toHaveBeenCalledTimes(2);
      expect(updateResult.currentStep).toBe(3);
      expect(completeResult.completed).toBe(true);
    });
  });

  describe('Enhanced Error Handling and Logging', () => {
    it('should log detailed information for transaction operations', async () => {
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        mockTrx.first.mockResolvedValue(mockDbOnboarding);
        mockTrx.update.mockReturnThis();
        mockTrx.returning.mockResolvedValue([{ ...mockDbOnboarding, current_step: 2 }]);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      };

      await onboardingService.updateProgress(input);

      // Verify logging calls were made
      const { createContextLogger } = require('@/utils/logger');
      const logger = createContextLogger();
      
      expect(logger.info).toHaveBeenCalledWith(
        'Starting onboarding progress update',
        expect.objectContaining({
          userId: testUserId,
          currentStep: 2,
          requestId: expect.any(String),
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Onboarding progress update completed successfully',
        expect.objectContaining({
          userId: testUserId,
          currentStep: 2,
          completed: false,
          requestId: expect.any(String),
        })
      );
    });

    it('should handle validation errors with proper logging', async () => {
      const invalidInput = {
        userId: 'invalid-uuid-format',
        currentStep: 2,
        tutorialProgress: {},
      };

      await expect(onboardingService.updateProgress(invalidInput))
        .rejects.toThrow(ValidationError);

      const { createContextLogger } = require('@/utils/logger');
      const logger = createContextLogger();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Validation error in onboarding update',
        expect.objectContaining({
          userId: 'invalid-uuid-format',
          validationErrors: expect.any(Array),
          requestId: expect.any(String),
        })
      );
    });

    it('should log transaction-specific operations', async () => {
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        mockTrx.first.mockResolvedValue(mockDbOnboarding);
        mockTrx.update.mockReturnThis();
        mockTrx.returning.mockResolvedValue([completedDbOnboarding]);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const input = {
        userId: testUserId,
        tutorialProgress: { completed: true },
      };

      await onboardingService.completeOnboarding(input);

      const { createContextLogger } = require('@/utils/logger');
      const logger = createContextLogger();
      
      expect(logger.debug).toHaveBeenCalledWith(
        'Existing record check for completion',
        expect.objectContaining({
          userId: testUserId,
          hasExisting: true,
          existingCompleted: false,
          requestId: expect.any(String),
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Onboarding completed (updated existing record)',
        expect.objectContaining({
          userId: testUserId,
          finalStep: expect.any(Number),
          requestId: expect.any(String),
        })
      );
    });

    it('should handle database transaction failures gracefully', async () => {
      const transactionError = new Error('Deadlock detected');
      
      mockDatabase.transaction.mockRejectedValue(transactionError);

      const input = {
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      };

      await expect(onboardingService.updateProgress(input))
        .rejects.toThrow('Deadlock detected');

      const { createContextLogger } = require('@/utils/logger');
      const logger = createContextLogger();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update onboarding progress',
        expect.objectContaining({
          userId: testUserId,
          error: 'Deadlock detected',
          stack: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });
  });

  describe('Onboarding Status Consistency', () => {
    it('should maintain consistent state during rapid status changes', async () => {
      let callCount = 0;
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        callCount++;
        const currentStep = Math.min(callCount, 3);
        
        mockTrx.first.mockResolvedValue({
          ...mockDbOnboarding,
          current_step: currentStep - 1 || 1,
        });
        mockTrx.update.mockReturnThis();
        mockTrx.returning.mockResolvedValue([{
          ...mockDbOnboarding,
          current_step: currentStep,
          completed: currentStep === 3,
          completed_at: currentStep === 3 ? new Date() : null,
        }]);
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      // Simulate rapid progression through steps
      const updates = [
        { currentStep: 1, tutorialProgress: { profileSetup: false } },
        { currentStep: 2, tutorialProgress: { profileSetup: true } },
        { currentStep: 3, tutorialProgress: { workspaceIntro: true } },
      ].map(update => ({ ...update, userId: testUserId }));

      const results = await Promise.all(
        updates.map(input => onboardingService.updateProgress(input))
      );

      // All operations should complete successfully
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.currentStep).toBe(index + 1);
      });

      // Last result should be completed if it reached step 3
      if (results[2].currentStep === 3) {
        expect(results[2].completed).toBe(true);
      }
    });

    it('should handle user switching scenarios correctly', async () => {
      let userOperations: { [key: string]: number } = {};
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        // Track operations per user
        const userId = (mockTrx.where as jest.Mock).mock.calls[0]?.[1] || testUserId;
        userOperations[userId] = (userOperations[userId] || 0) + 1;
        
        mockTrx.first.mockResolvedValue({
          ...mockDbOnboarding,
          user_id: userId,
          current_step: userOperations[userId],
        });
        mockTrx.update.mockReturnThis();
        mockTrx.returning.mockResolvedValue([{
          ...mockDbOnboarding,
          user_id: userId,
          current_step: userOperations[userId] + 1,
        }]);
        
        return await callback(mockTrx);
      });

      // Create concurrent operations for different users
      const user1Operation = onboardingService.updateProgress({
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      });

      const user2Operation = onboardingService.updateProgress({
        userId: testUser2Id,
        currentStep: 1,
        tutorialProgress: { profileSetup: false },
      });

      const [result1, result2] = await Promise.all([user1Operation, user2Operation]);

      expect(result1.userId).toBe(testUserId);
      expect(result2.userId).toBe(testUser2Id);
      expect(mockDatabase.transaction).toHaveBeenCalledTimes(2);
    });

    it('should prevent completion state corruption during concurrent operations', async () => {
      let completionAttempts = 0;
      const mockTrx = createMockTransaction();

      mockDatabase.transaction.mockImplementation(async (callback) => {
        completionAttempts++;
        
        if (completionAttempts === 1) {
          // First completion succeeds
          mockTrx.first.mockResolvedValue({ ...mockDbOnboarding, current_step: 3 });
          mockTrx.update.mockReturnThis();
          mockTrx.returning.mockResolvedValue([completedDbOnboarding]);
        } else {
          // Subsequent attempts see already completed state
          mockTrx.first.mockResolvedValue(completedDbOnboarding);
        }
        
        require('@/database/connection').knex.mockReturnValue(mockTrx);
        
        return await callback(mockTrx);
      });

      const completeInput = {
        userId: testUserId,
        tutorialProgress: { finalStep: true },
      };

      // Try to complete multiple times concurrently
      const completionPromises = Array(3).fill(null).map(() => 
        onboardingService.completeOnboarding(completeInput)
      );

      const results = await Promise.all(completionPromises);

      // All should return completed state
      results.forEach(result => {
        expect(result.completed).toBe(true);
        expect(result.completedAt).toBeDefined();
      });

      expect(mockDatabase.transaction).toHaveBeenCalledTimes(3);
    });
  });
});
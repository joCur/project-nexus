import { OnboardingService, OnboardingProgress } from '@/services/onboarding';
import { database } from '@/database/connection';

// Import mocked knex for type casting
const mockKnexDb = jest.requireMock('@/database/connection');
import { ValidationError } from '@/utils/errors';

// Mock database connection
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

describe('OnboardingService', () => {
  let onboardingService: OnboardingService;
  const mockDatabase = database as jest.Mocked<typeof database>;

  // Test data
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockDbOnboarding = {
    id: 'onboarding-id',
    user_id: testUserId,
    completed: false,
    completed_at: null,
    current_step: 1,
    final_step: null,
    tutorial_progress: { profileSetup: false },
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-01'),
  };

  const expectedOnboarding: OnboardingProgress = {
    id: 'onboarding-id',
    userId: testUserId,
    completed: false,
    completedAt: undefined,
    currentStep: 1,
    finalStep: undefined,
    tutorialProgress: { profileSetup: false },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  beforeEach(() => {
    onboardingService = new OnboardingService();
    jest.clearAllMocks();
    
    // Reset all mock implementations
    mockDatabase.query.mockClear();
    mockDatabase.transaction.mockClear();
    mockKnexDb.knex.mockClear();
  });

  describe('getProgress', () => {
    it('should return onboarding progress when found', async () => {
      // Mock knex query builder
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(mockDbOnboarding);

      const result = await onboardingService.getProgress(testUserId);

      expect(result).toEqual(expectedOnboarding);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'onboarding_get_progress'
      );
    });

    it('should return null when onboarding not found', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(null);

      const result = await onboardingService.getProgress(testUserId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      const dbError = new Error('Database connection failed');
      mockDatabase.query.mockRejectedValue(dbError);

      await expect(onboardingService.getProgress(testUserId))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('updateProgress', () => {
    const validInput = {
      userId: testUserId,
      currentStep: 2,
      tutorialProgress: { profileSetup: true },
    };

    it('should update existing onboarding progress', async () => {
      // Create a chainable mock query builder using recursive mocking
      const mockQueryBuilder = {
        where: jest.fn(),
        first: jest.fn(), 
        forUpdate: jest.fn(),
        update: jest.fn(),
        returning: jest.fn(),
        insert: jest.fn(),
      };
      
      // Make all the chainable methods return the same object
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.first.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.forUpdate.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
      
      // Mock the transaction function that returns the query builder  
      const mockTrx = jest.fn(() => mockQueryBuilder);
      
      // Mock knex to return query builder for non-transaction queries
      const mockKnexQuery = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      });
      mockKnexDb.knex.mockImplementation(mockKnexQuery);

      const updatedMockDb = { ...mockDbOnboarding, current_step: 2 };
      
      // Mock the transaction callback execution
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock finding existing record - forUpdate should also be chainable
        mockQueryBuilder.forUpdate.mockResolvedValue(mockDbOnboarding);
        // Mock update returning updated record  
        mockQueryBuilder.returning.mockResolvedValue([updatedMockDb]);
        
        return callback(mockTrx as any);
      });

      const result = await onboardingService.updateProgress(validInput);

      expect(result.currentStep).toBe(2);
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });

    it('should create new onboarding progress when none exists', async () => {
      // Create a chainable mock query builder using recursive mocking
      const mockQueryBuilder = {
        where: jest.fn(),
        first: jest.fn(), 
        forUpdate: jest.fn(),
        update: jest.fn(),
        returning: jest.fn(),
        insert: jest.fn(),
      };
      
      // Make all the chainable methods return the same object
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.first.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.forUpdate.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
      
      // Mock the transaction function that returns the query builder  
      const mockTrx = jest.fn(() => mockQueryBuilder);
      
      // Mock knex to return query builder for non-transaction queries
      const mockKnexQuery = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      });
      mockKnexDb.knex.mockImplementation(mockKnexQuery);

      const newMockDb = { ...mockDbOnboarding, current_step: 2 };
      
      // Mock the transaction callback execution
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock finding no existing record - forUpdate should also be chainable
        mockQueryBuilder.forUpdate.mockResolvedValue(undefined);
        // Mock insert returning new record
        mockQueryBuilder.returning.mockResolvedValue([newMockDb]);
        
        return callback(mockTrx as any);
      });

      const result = await onboardingService.updateProgress(validInput);

      expect(result.currentStep).toBe(2);
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        userId: 'invalid-uuid',
        currentStep: 0, // Below minimum
        tutorialProgress: {},
      };

      await expect(onboardingService.updateProgress(invalidInput))
        .rejects.toThrow(ValidationError);
    });

    it('should handle step number validation', async () => {
      const invalidStepInput = {
        userId: testUserId,
        currentStep: 15, // Above maximum
        tutorialProgress: {},
      };

      await expect(onboardingService.updateProgress(invalidStepInput))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('completeOnboarding', () => {
    const validCompleteInput = {
      userId: testUserId,
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: true,
        firstCard: true,
      },
    };

    it('should complete existing onboarding', async () => {
      // Create a chainable mock query builder using recursive mocking
      const mockQueryBuilder = {
        where: jest.fn(),
        first: jest.fn(), 
        forUpdate: jest.fn(),
        update: jest.fn(),
        returning: jest.fn(),
        insert: jest.fn(),
      };
      
      // Make all the chainable methods return the same object
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.first.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.forUpdate.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
      
      // Mock the transaction function that returns the query builder  
      const mockTrx = jest.fn(() => mockQueryBuilder);
      
      // Mock knex to return query builder for non-transaction queries
      const mockKnexQuery = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      });
      mockKnexDb.knex.mockImplementation(mockKnexQuery);

      const completedMockDb = {
        ...mockDbOnboarding,
        completed: true,
        completed_at: new Date(),
        final_step: 1,
      };
      
      // Mock the transaction callback execution
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock finding existing record - forUpdate should also be chainable
        mockQueryBuilder.forUpdate.mockResolvedValue(mockDbOnboarding);
        // Mock update returning completed record
        mockQueryBuilder.returning.mockResolvedValue([completedMockDb]);
        
        return callback(mockTrx as any);
      });

      const result = await onboardingService.completeOnboarding(validCompleteInput);

      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeDefined();
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });

    it('should create and complete new onboarding when none exists', async () => {
      // Create a chainable mock query builder using recursive mocking
      const mockQueryBuilder = {
        where: jest.fn(),
        first: jest.fn(), 
        forUpdate: jest.fn(),
        update: jest.fn(),
        returning: jest.fn(),
        insert: jest.fn(),
      };
      
      // Make all the chainable methods return the same object
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.first.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.forUpdate.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
      
      // Mock the transaction function that returns the query builder  
      const mockTrx = jest.fn(() => mockQueryBuilder);
      
      // Mock knex to return query builder for non-transaction queries
      const mockKnexQuery = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      });
      mockKnexDb.knex.mockImplementation(mockKnexQuery);

      const completedMockDb = {
        ...mockDbOnboarding,
        current_step: 3,
        completed: true,
        completed_at: new Date(),
        final_step: 3,
      };
      
      // Mock the transaction callback execution
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock finding no existing record - forUpdate should also be chainable
        mockQueryBuilder.forUpdate.mockResolvedValue(undefined);
        // Mock insert returning completed record
        mockQueryBuilder.returning.mockResolvedValue([completedMockDb]);
        
        return callback(mockTrx as any);
      });

      const result = await onboardingService.completeOnboarding(validCompleteInput);

      expect(result.completed).toBe(true);
      expect(result.currentStep).toBe(3);
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });

    it('should merge tutorial progress with existing progress', async () => {
      // Create a chainable mock query builder using recursive mocking
      const mockQueryBuilder = {
        where: jest.fn(),
        first: jest.fn(), 
        forUpdate: jest.fn(),
        update: jest.fn(),
        returning: jest.fn(),
        insert: jest.fn(),
      };
      
      // Make all the chainable methods return the same object
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.first.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.forUpdate.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
      
      // Mock the transaction function that returns the query builder  
      const mockTrx = jest.fn(() => mockQueryBuilder);
      
      // Mock knex to return query builder for non-transaction queries
      const mockKnexQuery = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      });
      mockKnexDb.knex.mockImplementation(mockKnexQuery);

      const existingDbRecord = {
        ...mockDbOnboarding,
        tutorial_progress: { profileSetup: true, workspaceIntro: false },
      };

      const completedMockDb = {
        ...mockDbOnboarding,
        completed: true,
        tutorial_progress: {
          profileSetup: true,
          workspaceIntro: true,
          firstCard: true,
        },
      };
      
      // Mock the transaction callback execution
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock finding existing record with partial progress - forUpdate should also be chainable
        mockQueryBuilder.forUpdate.mockResolvedValue(existingDbRecord);
        // Mock update returning completed record with merged progress
        mockQueryBuilder.returning.mockResolvedValue([completedMockDb]);
        
        return callback(mockTrx as any);
      });

      const result = await onboardingService.completeOnboarding(validCompleteInput);

      expect(result.tutorialProgress).toEqual({
        profileSetup: true,
        workspaceIntro: true,
        firstCard: true,
      });
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        userId: 'invalid-uuid',
        tutorialProgress: {},
      };

      await expect(onboardingService.completeOnboarding(invalidInput))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('isOnboardingComplete', () => {
    it('should return true when onboarding is completed', async () => {
      const completedOnboarding = { ...expectedOnboarding, completed: true };
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(completedOnboarding);

      const result = await onboardingService.isOnboardingComplete(testUserId);

      expect(result).toBe(true);
    });

    it('should return false when onboarding is not completed', async () => {
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(expectedOnboarding);

      const result = await onboardingService.isOnboardingComplete(testUserId);

      expect(result).toBe(false);
    });

    it('should return false when onboarding not found', async () => {
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(null);

      const result = await onboardingService.isOnboardingComplete(testUserId);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully and return false', async () => {
      jest.spyOn(onboardingService, 'getProgress').mockRejectedValue(new Error('DB Error'));

      const result = await onboardingService.isOnboardingComplete(testUserId);

      expect(result).toBe(false);
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding progress', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(undefined);

      await onboardingService.resetOnboarding(testUserId);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'onboarding_reset'
      );
      expect(mockKnexQuery.update).toHaveBeenCalledWith({
        completed: false,
        completed_at: null,
        current_step: 1,
        final_step: null,
        tutorial_progress: {},
        updated_at: expect.any(Date),
      });
    });

    it('should handle database errors during reset', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      const dbError = new Error('Reset failed');
      mockDatabase.query.mockRejectedValue(dbError);

      await expect(onboardingService.resetOnboarding(testUserId))
        .rejects.toThrow('Reset failed');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed database responses', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      mockKnexDb.knex.mockReturnValue(mockKnexQuery);

      // Return malformed data without required fields (missing user_id)
      const malformedDb = {
        id: 'test',
        // Missing user_id and other required fields
      };
      mockDatabase.query.mockResolvedValue(malformedDb);

      // The service now throws an error for malformed records
      await expect(onboardingService.getProgress(testUserId))
        .rejects.toThrow('Invalid database record: missing required fields');
    });

    it('should handle empty tutorial progress gracefully', async () => {
      const validInput = {
        userId: testUserId,
        currentStep: 1,
        // No tutorialProgress provided
      };

      // Create a chainable mock query builder using recursive mocking
      const mockQueryBuilder = {
        where: jest.fn(),
        first: jest.fn(), 
        forUpdate: jest.fn(),
        update: jest.fn(),
        returning: jest.fn(),
        insert: jest.fn(),
      };
      
      // Make all the chainable methods return the same object
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.first.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.forUpdate.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
      
      // Mock the transaction function that returns the query builder  
      const mockTrx = jest.fn(() => mockQueryBuilder);
      
      // Mock knex to return query builder for non-transaction queries
      const mockKnexQuery = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      });
      mockKnexDb.knex.mockImplementation(mockKnexQuery);

      const newMockDb = { ...mockDbOnboarding, tutorial_progress: {} };
      
      // Mock the transaction callback execution
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock finding no existing record - forUpdate should also be chainable
        mockQueryBuilder.forUpdate.mockResolvedValue(undefined);
        // Mock insert returning new record with empty progress
        mockQueryBuilder.returning.mockResolvedValue([newMockDb]);
        
        return callback(mockTrx as any);
      });

      const result = await onboardingService.updateProgress(validInput);

      expect(result.tutorialProgress).toEqual({});
    });

    it('should handle concurrent modification scenarios', async () => {
      // Create a chainable mock query builder using recursive mocking
      const mockQueryBuilder = {
        where: jest.fn(),
        first: jest.fn(), 
        forUpdate: jest.fn(),
        update: jest.fn(),
        returning: jest.fn(),
        insert: jest.fn(),
      };
      
      // Make all the chainable methods return the same object
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.first.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.forUpdate.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
      
      // Mock the transaction function that returns the query builder  
      const mockTrx = jest.fn(() => mockQueryBuilder);
      
      // Mock knex to return query builder for non-transaction queries
      const mockKnexQuery = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      });
      mockKnexDb.knex.mockImplementation(mockKnexQuery);

      // Mock the transaction callback execution to simulate finding an existing record
      mockDatabase.transaction.mockImplementation(async (callback) => {
        // Mock finding existing record (concurrent creation scenario) - forUpdate should also be chainable
        mockQueryBuilder.forUpdate.mockResolvedValue(mockDbOnboarding);
        // Mock update returning record
        mockQueryBuilder.returning.mockResolvedValue([{ ...mockDbOnboarding, current_step: 2 }]);
        
        return callback(mockTrx as any);
      });

      const validInput = {
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      };

      const result = await onboardingService.updateProgress(validInput);

      expect(result).toBeDefined();
      expect(result.userId).toBe(testUserId);
    });
  });
});
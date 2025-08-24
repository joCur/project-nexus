import { OnboardingService, OnboardingProgress } from '@/services/onboarding';
import { database } from '@/database/connection';

// Import for mocking purposes
import * as dbConnection from '@/database/connection';
import { ValidationError as _ValidationError } from '@/utils/errors';

// Mock database connection
jest.mock('@/database/connection', () => ({
  database: {
    query: jest.fn(),
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
    finalStep: null,
    tutorialProgress: { profileSetup: false },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  beforeEach(() => {
    onboardingService = new OnboardingService();
    jest.clearAllMocks();
  });

  describe('getProgress', () => {
    it('should return onboarding progress when found', async () => {
      // Mock knex query builder
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

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
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue(null);

      const result = await onboardingService.getProgress(testUserId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

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
      // Mock getProgress to return existing onboarding
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(expectedOnboarding);

      // Mock knex update query
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const updatedMockDb = { ...mockDbOnboarding, current_step: 2 };
      mockDatabase.query.mockResolvedValue([updatedMockDb]);

      const result = await onboardingService.updateProgress(validInput);

      expect(result.currentStep).toBe(2);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'onboarding_update_progress'
      );
    });

    it('should create new onboarding progress when none exists', async () => {
      // Mock getProgress to return null
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(null);

      // Mock knex insert query
      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const newMockDb = { ...mockDbOnboarding, current_step: 2 };
      mockDatabase.query.mockResolvedValue([newMockDb]);

      const result = await onboardingService.updateProgress(validInput);

      expect(result.currentStep).toBe(2);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'onboarding_create_progress'
      );
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
      // Mock getProgress to return existing onboarding
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(expectedOnboarding);

      // Mock knex update query
      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const completedMockDb = {
        ...mockDbOnboarding,
        completed: true,
        completed_at: new Date(),
        final_step: 1,
      };
      mockDatabase.query.mockResolvedValue([completedMockDb]);

      const result = await onboardingService.completeOnboarding(validCompleteInput);

      expect(result.completed).toBe(true);
      expect(result.completedAt).toBeDefined();
      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'onboarding_complete'
      );
    });

    it('should create and complete new onboarding when none exists', async () => {
      // Mock getProgress to return null
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(null);

      // Mock knex insert query
      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const completedMockDb = {
        ...mockDbOnboarding,
        current_step: 3,
        completed: true,
        completed_at: new Date(),
        final_step: 3,
      };
      mockDatabase.query.mockResolvedValue([completedMockDb]);

      const result = await onboardingService.completeOnboarding(validCompleteInput);

      expect(result.completed).toBe(true);
      expect(result.currentStep).toBe(3);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        mockKnexQuery,
        'onboarding_complete_new'
      );
    });

    it('should merge tutorial progress with existing progress', async () => {
      const existingOnboarding = {
        ...expectedOnboarding,
        tutorialProgress: { profileSetup: true, workspaceIntro: false },
      };
      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(existingOnboarding);

      const mockKnexQuery = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const completedMockDb = {
        ...mockDbOnboarding,
        completed: true,
        tutorial_progress: {
          profileSetup: true,
          workspaceIntro: true,
          firstCard: true,
        },
      };
      mockDatabase.query.mockResolvedValue([completedMockDb]);

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
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

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
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

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
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      // Return malformed data without required fields
      const malformedDb = {
        id: 'test',
        // Missing required fields
      };
      mockDatabase.query.mockResolvedValue(malformedDb);

      const result = await onboardingService.getProgress(testUserId);

      expect(result).toBeDefined();
      expect(result?.id).toBe('test');
      expect(result?.tutorialProgress).toEqual({});
    });

    it('should handle empty tutorial progress gracefully', async () => {
      const validInput = {
        userId: testUserId,
        currentStep: 1,
        // No tutorialProgress provided
      };

      jest.spyOn(onboardingService, 'getProgress').mockResolvedValue(null);

      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      const newMockDb = { ...mockDbOnboarding, tutorial_progress: {} };
      mockDatabase.query.mockResolvedValue([newMockDb]);

      const result = await onboardingService.updateProgress(validInput);

      expect(result.tutorialProgress).toEqual({});
    });

    it('should handle concurrent modification scenarios', async () => {
      // Simulate a scenario where onboarding gets created between getProgress and update
      let callCount = 0;
      jest.spyOn(onboardingService, 'getProgress').mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? null : expectedOnboarding;
      });

      const mockKnexQuery = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
      };
      (dbConnection.knex as jest.Mock).mockReturnValue(mockKnexQuery);

      mockDatabase.query.mockResolvedValue([mockDbOnboarding]);

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
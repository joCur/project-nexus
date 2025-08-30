import { GraphQLContext } from '@/types';
import { onboardingResolvers } from '@/resolvers/onboarding';
import { OnboardingService } from '@/services/onboarding';
import { AuthenticationError, AuthorizationError, ValidationError } from '@/utils/errors';

// Mock services
jest.mock('@/services/onboarding');
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Onboarding GraphQL Resolvers', () => {
  let mockOnboardingService: jest.Mocked<OnboardingService>;
  let mockContext: GraphQLContext;

  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testOtherUserId = '987e6543-e21a-98d7-b654-321098765432';
  
  const mockOnboardingProgress = {
    id: 'onboarding-id',
    userId: testUserId,
    completed: false,
    completedAt: undefined,
    currentStep: 2,
    finalStep: null,
    tutorialProgress: {
      profileSetup: true,
      workspaceIntro: false,
      firstCard: false,
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  beforeEach(() => {
    mockOnboardingService = new OnboardingService() as jest.Mocked<OnboardingService>;
    
    // Create mock context with authenticated user
    mockContext = {
      isAuthenticated: true,
      user: {
        id: testUserId,
        email: 'test@example.com',
        auth0UserId: 'auth0|test-user',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: ['user'],
        permissions: ['user:read', 'user:update'],
        metadataSyncedAt: new Date(),
      },
      permissions: ['user:read', 'user:update'],
      dataSources: {
        userService: {} as any,
        auth0Service: {} as any,
        cacheService: {} as any,
        userProfileService: {} as any,
        onboardingService: mockOnboardingService,
        workspaceService: {} as any,
        workspaceAuthorizationService: {
          getUserPermissionsForContext: jest.fn().mockResolvedValue({}),
        } as any,
      },
      req: {} as any,
      res: {} as any,
    };

    jest.clearAllMocks();
  });

  describe('Query: onboardingProgress', () => {
    it('should return onboarding progress for own user', async () => {
      mockOnboardingService.getProgress.mockResolvedValue(mockOnboardingProgress);

      const result = await onboardingResolvers.Query.onboardingProgress(
        {},
        { userId: testUserId },
        mockContext
      );

      expect(result).toEqual(mockOnboardingProgress);
      expect(mockOnboardingService.getProgress).toHaveBeenCalledWith(testUserId);
    });

    it('should return onboarding progress for other user with admin permissions', async () => {
      mockContext.permissions = ['admin:user_management'];
      // Mock the workspaceAuthorizationService to return admin permissions
      (mockContext.dataSources.workspaceAuthorizationService.getUserPermissionsForContext as jest.Mock)
        .mockResolvedValue({ 'workspace-1': ['admin:user_management'] });
      mockOnboardingService.getProgress.mockResolvedValue(mockOnboardingProgress);

      const result = await onboardingResolvers.Query.onboardingProgress(
        {},
        { userId: testOtherUserId },
        mockContext
      );

      expect(result).toEqual(mockOnboardingProgress);
      expect(mockOnboardingService.getProgress).toHaveBeenCalledWith(testOtherUserId);
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      mockContext.isAuthenticated = false;

      await expect(
        onboardingResolvers.Query.onboardingProgress(
          {},
          { userId: testUserId },
          mockContext
        )
      ).rejects.toThrow(AuthenticationError);

      expect(mockOnboardingService.getProgress).not.toHaveBeenCalled();
    });

    it('should throw AuthorizationError when accessing other user without admin permissions', async () => {
      await expect(
        onboardingResolvers.Query.onboardingProgress(
          {},
          { userId: testOtherUserId },
          mockContext
        )
      ).rejects.toThrow(AuthorizationError);

      expect(mockOnboardingService.getProgress).not.toHaveBeenCalled();
    });
  });

  describe('Query: myOnboardingProgress', () => {
    it('should return current user onboarding progress', async () => {
      mockOnboardingService.getProgress.mockResolvedValue(mockOnboardingProgress);

      const result = await onboardingResolvers.Query.myOnboardingProgress(
        {},
        {},
        mockContext
      );

      expect(result).toEqual(mockOnboardingProgress);
      expect(mockOnboardingService.getProgress).toHaveBeenCalledWith(testUserId);
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      mockContext.isAuthenticated = false;

      await expect(
        onboardingResolvers.Query.myOnboardingProgress({}, {}, mockContext)
      ).rejects.toThrow(AuthenticationError);

      expect(mockOnboardingService.getProgress).not.toHaveBeenCalled();
    });

    it('should return null when no onboarding progress exists', async () => {
      mockOnboardingService.getProgress.mockResolvedValue(null);

      const result = await onboardingResolvers.Query.myOnboardingProgress(
        {},
        {},
        mockContext
      );

      expect(result).toBeNull();
      expect(mockOnboardingService.getProgress).toHaveBeenCalledWith(testUserId);
    });
  });

  describe('Query: isOnboardingComplete', () => {
    it('should return completion status for own user', async () => {
      mockOnboardingService.isOnboardingComplete.mockResolvedValue(true);

      const result = await onboardingResolvers.Query.isOnboardingComplete(
        {},
        { userId: testUserId },
        mockContext
      );

      expect(result).toBe(true);
      expect(mockOnboardingService.isOnboardingComplete).toHaveBeenCalledWith(testUserId);
    });

    it('should return completion status for other user with admin permissions', async () => {
      mockContext.permissions = ['admin:user_management'];
      // Mock the workspaceAuthorizationService to return admin permissions
      (mockContext.dataSources.workspaceAuthorizationService.getUserPermissionsForContext as jest.Mock)
        .mockResolvedValue({ 'workspace-1': ['admin:user_management'] });
      mockOnboardingService.isOnboardingComplete.mockResolvedValue(false);

      const result = await onboardingResolvers.Query.isOnboardingComplete(
        {},
        { userId: testOtherUserId },
        mockContext
      );

      expect(result).toBe(false);
      expect(mockOnboardingService.isOnboardingComplete).toHaveBeenCalledWith(testOtherUserId);
    });

    it('should throw AuthorizationError when accessing other user without admin permissions', async () => {
      await expect(
        onboardingResolvers.Query.isOnboardingComplete(
          {},
          { userId: testOtherUserId },
          mockContext
        )
      ).rejects.toThrow(AuthorizationError);

      expect(mockOnboardingService.isOnboardingComplete).not.toHaveBeenCalled();
    });
  });

  describe('Mutation: updateOnboardingProgress', () => {
    const validInput = {
      currentStep: 3,
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: true,
        firstCard: false,
      },
    };

    it('should update onboarding progress for authenticated user', async () => {
      const updatedProgress = { ...mockOnboardingProgress, currentStep: 3 };
      mockOnboardingService.updateProgress.mockResolvedValue(updatedProgress);

      const result = await onboardingResolvers.Mutation.updateOnboardingProgress(
        {},
        { input: validInput },
        mockContext
      );

      expect(result).toEqual(updatedProgress);
      expect(mockOnboardingService.updateProgress).toHaveBeenCalledWith({
        ...validInput,
        userId: testUserId,
      });
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      mockContext.isAuthenticated = false;

      await expect(
        onboardingResolvers.Mutation.updateOnboardingProgress(
          {},
          { input: validInput },
          mockContext
        )
      ).rejects.toThrow(AuthenticationError);

      expect(mockOnboardingService.updateProgress).not.toHaveBeenCalled();
    });

    it('should handle validation errors from service', async () => {
      const validationError = new ValidationError('Invalid step number');
      mockOnboardingService.updateProgress.mockRejectedValue(validationError);

      await expect(
        onboardingResolvers.Mutation.updateOnboardingProgress(
          {},
          { input: validInput },
          mockContext
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Database connection failed');
      mockOnboardingService.updateProgress.mockRejectedValue(serviceError);

      await expect(
        onboardingResolvers.Mutation.updateOnboardingProgress(
          {},
          { input: validInput },
          mockContext
        )
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Mutation: completeOnboarding', () => {
    const validCompleteInput = {
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: true,
        firstCard: true,
      },
    };

    it('should complete onboarding for authenticated user', async () => {
      const completedProgress = {
        ...mockOnboardingProgress,
        completed: true,
        completedAt: new Date(),
        finalStep: 3,
      };
      mockOnboardingService.completeOnboarding.mockResolvedValue(completedProgress);

      const result = await onboardingResolvers.Mutation.completeOnboarding(
        {},
        { input: validCompleteInput },
        mockContext
      );

      expect(result).toEqual(completedProgress);
      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledWith({
        ...validCompleteInput,
        userId: testUserId,
      });
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      mockContext.isAuthenticated = false;

      await expect(
        onboardingResolvers.Mutation.completeOnboarding(
          {},
          { input: validCompleteInput },
          mockContext
        )
      ).rejects.toThrow(AuthenticationError);

      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('should handle empty tutorial progress', async () => {
      const emptyInput = {};
      const completedProgress = { ...mockOnboardingProgress, completed: true };
      mockOnboardingService.completeOnboarding.mockResolvedValue(completedProgress);

      const result = await onboardingResolvers.Mutation.completeOnboarding(
        {},
        { input: emptyInput },
        mockContext
      );

      expect(result).toEqual(completedProgress);
      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledWith({
        ...emptyInput,
        userId: testUserId,
      });
    });
  });

  describe('Mutation: resetOnboarding', () => {
    it('should reset onboarding for own user', async () => {
      mockOnboardingService.resetOnboarding.mockResolvedValue(undefined);

      const result = await onboardingResolvers.Mutation.resetOnboarding(
        {},
        { userId: testUserId },
        mockContext
      );

      expect(result).toBe(true);
      expect(mockOnboardingService.resetOnboarding).toHaveBeenCalledWith(testUserId);
    });

    it('should reset onboarding for other user with admin permissions', async () => {
      mockContext.permissions = ['admin:user_management'];
      // Mock the workspaceAuthorizationService to return admin permissions
      (mockContext.dataSources.workspaceAuthorizationService.getUserPermissionsForContext as jest.Mock)
        .mockResolvedValue({ 'workspace-1': ['admin:user_management'] });
      mockOnboardingService.resetOnboarding.mockResolvedValue(undefined);

      const result = await onboardingResolvers.Mutation.resetOnboarding(
        {},
        { userId: testOtherUserId },
        mockContext
      );

      expect(result).toBe(true);
      expect(mockOnboardingService.resetOnboarding).toHaveBeenCalledWith(testOtherUserId);
    });

    it('should throw AuthorizationError when resetting other user without admin permissions', async () => {
      await expect(
        onboardingResolvers.Mutation.resetOnboarding(
          {},
          { userId: testOtherUserId },
          mockContext
        )
      ).rejects.toThrow(AuthorizationError);

      expect(mockOnboardingService.resetOnboarding).not.toHaveBeenCalled();
    });

    it('should return false when reset fails', async () => {
      const resetError = new Error('Reset failed');
      mockOnboardingService.resetOnboarding.mockRejectedValue(resetError);

      const result = await onboardingResolvers.Mutation.resetOnboarding(
        {},
        { userId: testUserId },
        mockContext
      );

      expect(result).toBe(false);
      expect(mockOnboardingService.resetOnboarding).toHaveBeenCalledWith(testUserId);
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      mockContext.isAuthenticated = false;

      await expect(
        onboardingResolvers.Mutation.resetOnboarding(
          {},
          { userId: testUserId },
          mockContext
        )
      ).rejects.toThrow(AuthenticationError);

      expect(mockOnboardingService.resetOnboarding).not.toHaveBeenCalled();
    });
  });

  describe('User field resolver: onboarding', () => {
    it('should resolve onboarding progress for user', async () => {
      const user = { id: testUserId, email: 'test@example.com' };
      mockOnboardingService.getProgress.mockResolvedValue(mockOnboardingProgress);

      const result = await onboardingResolvers.User.onboarding(user, {}, mockContext);

      expect(result).toEqual(mockOnboardingProgress);
      expect(mockOnboardingService.getProgress).toHaveBeenCalledWith(testUserId);
    });

    it('should return null when no onboarding progress exists for user', async () => {
      const user = { id: testUserId, email: 'test@example.com' };
      mockOnboardingService.getProgress.mockResolvedValue(null);

      const result = await onboardingResolvers.User.onboarding(user, {}, mockContext);

      expect(result).toBeNull();
      expect(mockOnboardingService.getProgress).toHaveBeenCalledWith(testUserId);
    });

    it('should handle service errors in field resolver', async () => {
      const user = { id: testUserId, email: 'test@example.com' };
      const serviceError = new Error('Database error');
      mockOnboardingService.getProgress.mockRejectedValue(serviceError);

      await expect(
        onboardingResolvers.User.onboarding(user, {}, mockContext)
      ).rejects.toThrow('Database error');
    });
  });

  describe('Permission and authorization edge cases', () => {
    it('should handle missing user context gracefully', async () => {
      mockContext.user = null;

      await expect(
        onboardingResolvers.Query.myOnboardingProgress({}, {}, mockContext)
      ).rejects.toThrow();
    });

    it('should validate admin permissions correctly', async () => {
      // Test with insufficient admin permissions
      mockContext.permissions = ['admin:read_only'];

      await expect(
        onboardingResolvers.Query.onboardingProgress(
          {},
          { userId: testOtherUserId },
          mockContext
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('should handle multiple admin permissions', async () => {
      mockContext.permissions = ['admin:user_management', 'admin:system'];
      // Mock the workspaceAuthorizationService to return admin permissions
      (mockContext.dataSources.workspaceAuthorizationService.getUserPermissionsForContext as jest.Mock)
        .mockResolvedValue({ 'workspace-1': ['admin:user_management', 'admin:system'] });
      mockOnboardingService.getProgress.mockResolvedValue(mockOnboardingProgress);

      const result = await onboardingResolvers.Query.onboardingProgress(
        {},
        { userId: testOtherUserId },
        mockContext
      );

      expect(result).toEqual(mockOnboardingProgress);
    });
  });

  describe('Input validation and sanitization', () => {
    it('should handle invalid step numbers', async () => {
      const invalidInput = {
        currentStep: -1, // Invalid step
        tutorialProgress: {},
      };

      const validationError = new ValidationError('Invalid step number');
      mockOnboardingService.updateProgress.mockRejectedValue(validationError);

      await expect(
        onboardingResolvers.Mutation.updateOnboardingProgress(
          {},
          { input: invalidInput },
          mockContext
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should handle malformed tutorial progress', async () => {
      const malformedInput = {
        currentStep: 2,
        tutorialProgress: null, // Invalid progress
      };

      const validationError = new ValidationError('Invalid tutorial progress');
      mockOnboardingService.updateProgress.mockRejectedValue(validationError);

      await expect(
        onboardingResolvers.Mutation.updateOnboardingProgress(
          {},
          { input: malformedInput },
          mockContext
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should handle very large step numbers', async () => {
      const invalidInput = {
        currentStep: 999999, // Extremely large step
        tutorialProgress: {},
      };

      const validationError = new ValidationError('Step number out of range');
      mockOnboardingService.updateProgress.mockRejectedValue(validationError);

      await expect(
        onboardingResolvers.Mutation.updateOnboardingProgress(
          {},
          { input: invalidInput },
          mockContext
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Concurrent access scenarios', () => {
    it('should handle concurrent onboarding completion attempts', async () => {
      const input = {
        tutorialProgress: {
          profileSetup: true,
          workspaceIntro: true,
          firstCard: true,
        },
      };

      // First call succeeds
      const completedProgress = { ...mockOnboardingProgress, completed: true };
      mockOnboardingService.completeOnboarding.mockResolvedValueOnce(completedProgress);

      // Second call should also handle gracefully (already completed)
      mockOnboardingService.completeOnboarding.mockResolvedValueOnce(completedProgress);

      const result1 = await onboardingResolvers.Mutation.completeOnboarding(
        {},
        { input },
        mockContext
      );
      const result2 = await onboardingResolvers.Mutation.completeOnboarding(
        {},
        { input },
        mockContext
      );

      expect(result1.completed).toBe(true);
      expect(result2.completed).toBe(true);
    });
  });
});
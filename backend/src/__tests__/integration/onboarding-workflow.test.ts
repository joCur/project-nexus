import { OnboardingWorkflowService } from '@/services/onboardingWorkflow';
import { UserProfileService } from '@/services/userProfile';
import { OnboardingService } from '@/services/onboarding';
import { WorkspaceService } from '@/services/workspace';
import { TransactionError } from '@/utils/errors';

// Mock services
jest.mock('@/services/userProfile');
jest.mock('@/services/onboarding');
jest.mock('@/services/workspace');
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('OnboardingWorkflowService Integration', () => {
  let onboardingWorkflowService: OnboardingWorkflowService;
  let mockUserProfileService: jest.Mocked<UserProfileService>;
  let mockOnboardingService: jest.Mocked<OnboardingService>;
  let mockWorkspaceService: jest.Mocked<WorkspaceService>;

  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  
  const validCompleteOnboardingInput = {
    userId: testUserId,
    userProfile: {
      fullName: 'John Doe',
      displayName: 'Johnny',
      timezone: 'UTC',
      role: 'CREATIVE' as const,
      preferences: {
        workspaceName: 'Creative Workspace',
        privacy: 'PRIVATE' as const,
        notifications: true,
      },
    },
    tutorialProgress: {
      profileSetup: true,
      workspaceIntro: true,
      firstCard: true,
    },
  };

  const mockProfile = {
    id: 'profile-id',
    userId: testUserId,
    fullName: 'John Doe',
    displayName: 'Johnny',
    timezone: 'UTC',
    role: 'CREATIVE' as const,
    preferences: {
      workspaceName: 'Creative Workspace',
      privacy: 'PRIVATE',
      notifications: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkspace = {
    id: 'workspace-id',
    name: 'Creative Workspace',
    ownerId: testUserId,
    privacy: 'PRIVATE' as const,
    settings: {
      onboardingCompleted: true,
      createdDuringOnboarding: true,
    },
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOnboarding = {
    id: 'onboarding-id',
    userId: testUserId,
    completed: true,
    completedAt: new Date(),
    currentStep: 3,
    finalStep: 3,
    tutorialProgress: {
      profileSetup: true,
      workspaceIntro: true,
      firstCard: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserProfileService = new UserProfileService() as jest.Mocked<UserProfileService>;
    mockOnboardingService = new OnboardingService() as jest.Mocked<OnboardingService>;
    mockWorkspaceService = new WorkspaceService() as jest.Mocked<WorkspaceService>;
    
    onboardingWorkflowService = new OnboardingWorkflowService(
      mockUserProfileService,
      mockOnboardingService,
      mockWorkspaceService
    );

    jest.clearAllMocks();
  });

  describe('completeOnboarding', () => {
    it('should complete the entire onboarding process successfully', async () => {
      // Mock successful service calls
      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValue(mockOnboarding);

      const result = await onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput);

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockProfile);
      expect(result.workspace).toEqual(mockWorkspace);
      expect(result.onboarding).toEqual(mockOnboarding);

      // Verify service calls
      expect(mockUserProfileService.upsertProfile).toHaveBeenCalledWith({
        userId: testUserId,
        fullName: 'John Doe',
        displayName: 'Johnny',
        timezone: 'UTC',
        role: 'creative' as const,
        preferences: {
          workspaceName: 'Creative Workspace',
          privacy: 'PRIVATE',
          notifications: true,
        },
      });

      expect(mockWorkspaceService.createDefaultWorkspace).toHaveBeenCalledWith(
        testUserId,
        'Creative Workspace'
      );

      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledWith({
        userId: testUserId,
        tutorialProgress: {
          profileSetup: true,
          workspaceIntro: true,
          firstCard: true,
        },
      });
    });

    it('should handle minimal input with defaults', async () => {
      const minimalInput = {
        userId: testUserId,
        userProfile: {
          fullName: 'Jane Doe',
          preferences: {
            workspaceName: 'My Workspace',
          },
        },
      };

      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValue(mockOnboarding);

      const result = await onboardingWorkflowService.completeOnboarding(minimalInput);

      expect(result.success).toBe(true);
      expect(mockUserProfileService.upsertProfile).toHaveBeenCalledWith({
        userId: testUserId,
        fullName: 'Jane Doe',
        displayName: undefined,
        timezone: undefined,
        role: undefined,
        preferences: {
          workspaceName: 'My Workspace',
          privacy: 'PRIVATE',
          notifications: true,
        },
      });
    });

    it('should update workspace privacy when specified', async () => {
      const inputWithTeamPrivacy = {
        ...validCompleteOnboardingInput,
        userProfile: {
          ...validCompleteOnboardingInput.userProfile,
          preferences: {
            workspaceName: 'Team Workspace',
            privacy: 'TEAM' as const,
          },
        },
      };

      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockWorkspaceService.updateWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValue(mockOnboarding);

      const result = await onboardingWorkflowService.completeOnboarding(inputWithTeamPrivacy);

      expect(result.success).toBe(true);
      expect(mockWorkspaceService.updateWorkspace).toHaveBeenCalledWith(
        mockWorkspace.id,
        { privacy: 'team' }
      );
    });

    it('should not update workspace privacy for default private setting', async () => {
      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValue(mockOnboarding);

      await onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput);

      expect(mockWorkspaceService.updateWorkspace).not.toHaveBeenCalled();
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        userId: 'invalid-uuid',
        userProfile: {
          fullName: '', // Empty name
          preferences: {
            workspaceName: '', // Empty workspace name
          },
        },
      };

      await expect(onboardingWorkflowService.completeOnboarding(invalidInput))
        .rejects.toThrow(TransactionError);

      expect(mockUserProfileService.upsertProfile).not.toHaveBeenCalled();
    });

    it('should handle profile creation failure', async () => {
      const profileError = new Error('Profile creation failed');
      mockUserProfileService.upsertProfile.mockRejectedValue(profileError);

      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow(TransactionError);
      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow('Onboarding process failed: Profile creation failed');

      expect(mockWorkspaceService.createDefaultWorkspace).not.toHaveBeenCalled();
      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('should handle workspace creation failure', async () => {
      const workspaceError = new Error('Workspace creation failed');
      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockRejectedValue(workspaceError);

      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow(TransactionError);
      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow('Onboarding process failed: Workspace creation failed');

      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('should handle onboarding completion failure', async () => {
      const onboardingError = new Error('Onboarding completion failed');
      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockRejectedValue(onboardingError);

      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow(TransactionError);
      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow('Onboarding process failed: Onboarding completion failed');
    });
  });

  describe('updateOnboardingStep', () => {
    it('should update onboarding step successfully', async () => {
      const updatedProgress = { ...mockOnboarding, currentStep: 2 };
      mockOnboardingService.updateProgress.mockResolvedValue(updatedProgress);

      const result = await onboardingWorkflowService.updateOnboardingStep(
        testUserId,
        2,
        { profileSetup: true }
      );

      expect(result).toEqual(updatedProgress);
      expect(mockOnboardingService.updateProgress).toHaveBeenCalledWith({
        userId: testUserId,
        currentStep: 2,
        tutorialProgress: { profileSetup: true },
      });
    });

    it('should handle empty tutorial progress', async () => {
      mockOnboardingService.updateProgress.mockResolvedValue(mockOnboarding);

      const result = await onboardingWorkflowService.updateOnboardingStep(testUserId, 1);

      expect(result).toEqual(mockOnboarding);
      expect(mockOnboardingService.updateProgress).toHaveBeenCalledWith({
        userId: testUserId,
        currentStep: 1,
        tutorialProgress: {},
      });
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Update failed');
      mockOnboardingService.updateProgress.mockRejectedValue(serviceError);

      await expect(onboardingWorkflowService.updateOnboardingStep(testUserId, 2))
        .rejects.toThrow('Update failed');
    });
  });

  describe('getOnboardingStatus', () => {
    it('should return complete onboarding status', async () => {
      mockUserProfileService.getProfileByUserId.mockResolvedValue(mockProfile);
      mockOnboardingService.getProgress.mockResolvedValue(mockOnboarding);
      mockWorkspaceService.getDefaultWorkspace.mockResolvedValue(mockWorkspace);

      const result = await onboardingWorkflowService.getOnboardingStatus(testUserId);

      expect(result).toEqual({
        profile: mockProfile,
        onboarding: mockOnboarding,
        defaultWorkspace: mockWorkspace,
        isComplete: true,
      });

      expect(mockUserProfileService.getProfileByUserId).toHaveBeenCalledWith(testUserId);
      expect(mockOnboardingService.getProgress).toHaveBeenCalledWith(testUserId);
      expect(mockWorkspaceService.getDefaultWorkspace).toHaveBeenCalledWith(testUserId);
    });

    it('should handle incomplete onboarding status', async () => {
      const incompleteOnboarding = { ...mockOnboarding, completed: false };
      
      mockUserProfileService.getProfileByUserId.mockResolvedValue(null);
      mockOnboardingService.getProgress.mockResolvedValue(incompleteOnboarding);
      mockWorkspaceService.getDefaultWorkspace.mockResolvedValue(null);

      const result = await onboardingWorkflowService.getOnboardingStatus(testUserId);

      expect(result).toEqual({
        profile: null,
        onboarding: incompleteOnboarding,
        defaultWorkspace: null,
        isComplete: false,
      });
    });

    it('should handle missing onboarding progress', async () => {
      mockUserProfileService.getProfileByUserId.mockResolvedValue(mockProfile);
      mockOnboardingService.getProgress.mockResolvedValue(null);
      mockWorkspaceService.getDefaultWorkspace.mockResolvedValue(mockWorkspace);

      const result = await onboardingWorkflowService.getOnboardingStatus(testUserId);

      expect(result).toEqual({
        profile: mockProfile,
        onboarding: null,
        defaultWorkspace: mockWorkspace,
        isComplete: false,
      });
    });

    it('should handle service errors in parallel calls', async () => {
      const serviceError = new Error('Service unavailable');
      mockUserProfileService.getProfileByUserId.mockRejectedValue(serviceError);
      mockOnboardingService.getProgress.mockResolvedValue(mockOnboarding);
      mockWorkspaceService.getDefaultWorkspace.mockResolvedValue(mockWorkspace);

      await expect(onboardingWorkflowService.getOnboardingStatus(testUserId))
        .rejects.toThrow('Service unavailable');
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding state successfully', async () => {
      mockOnboardingService.resetOnboarding.mockResolvedValue(undefined);

      await onboardingWorkflowService.resetOnboarding(testUserId);

      expect(mockOnboardingService.resetOnboarding).toHaveBeenCalledWith(testUserId);
    });

    it('should handle reset failure', async () => {
      const resetError = new Error('Reset failed');
      mockOnboardingService.resetOnboarding.mockRejectedValue(resetError);

      await expect(onboardingWorkflowService.resetOnboarding(testUserId))
        .rejects.toThrow('Reset failed');
    });
  });

  describe('Enum case conversion and validation', () => {
    it('should convert role enum from uppercase to lowercase for profile service', async () => {
      const inputWithUppercaseRole = {
        ...validCompleteOnboardingInput,
        userProfile: {
          ...validCompleteOnboardingInput.userProfile,
          role: 'RESEARCHER' as const,
        },
      };

      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValue(mockOnboarding);

      await onboardingWorkflowService.completeOnboarding(inputWithUppercaseRole);

      expect(mockUserProfileService.upsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'researcher', // Converted to lowercase
        })
      );
    });

    it('should convert privacy enum from uppercase to lowercase for workspace service', async () => {
      const inputWithPublicPrivacy = {
        ...validCompleteOnboardingInput,
        userProfile: {
          ...validCompleteOnboardingInput.userProfile,
          preferences: {
            workspaceName: 'Public Workspace',
            privacy: 'PUBLIC' as const,
          },
        },
      };

      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockWorkspaceService.updateWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValue(mockOnboarding);

      await onboardingWorkflowService.completeOnboarding(inputWithPublicPrivacy);

      expect(mockWorkspaceService.updateWorkspace).toHaveBeenCalledWith(
        mockWorkspace.id,
        { privacy: 'public' } // Converted to lowercase
      );
    });

    it('should validate role enum values', async () => {
      const inputWithInvalidRole = {
        ...validCompleteOnboardingInput,
        userProfile: {
          ...validCompleteOnboardingInput.userProfile,
          role: 'INVALID_ROLE' as any,
        },
      };

      await expect(onboardingWorkflowService.completeOnboarding(inputWithInvalidRole))
        .rejects.toThrow(TransactionError);
    });

    it('should validate privacy enum values', async () => {
      const inputWithInvalidPrivacy = {
        ...validCompleteOnboardingInput,
        userProfile: {
          ...validCompleteOnboardingInput.userProfile,
          preferences: {
            workspaceName: 'Test Workspace',
            privacy: 'INVALID_PRIVACY' as any,
          },
        },
      };

      await expect(onboardingWorkflowService.completeOnboarding(inputWithInvalidPrivacy))
        .rejects.toThrow(TransactionError);
    });
  });

  describe('Transaction-like behavior and error recovery', () => {
    it('should stop execution on first error and not proceed to subsequent steps', async () => {
      const profileError = new Error('Profile creation failed');
      mockUserProfileService.upsertProfile.mockRejectedValue(profileError);

      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow(TransactionError);

      // Subsequent services should not be called
      expect(mockWorkspaceService.createDefaultWorkspace).not.toHaveBeenCalled();
      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('should maintain data consistency when workspace creation fails after profile creation', async () => {
      const workspaceError = new Error('Workspace creation failed');
      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockRejectedValue(workspaceError);

      await expect(onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput))
        .rejects.toThrow(TransactionError);

      // Profile was created but onboarding should not be marked complete
      expect(mockUserProfileService.upsertProfile).toHaveBeenCalled();
      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('should handle workspace privacy update failure gracefully', async () => {
      const inputWithTeamPrivacy = {
        ...validCompleteOnboardingInput,
        userProfile: {
          ...validCompleteOnboardingInput.userProfile,
          preferences: {
            workspaceName: 'Team Workspace',
            privacy: 'TEAM' as const,
          },
        },
      };

      const privacyUpdateError = new Error('Privacy update failed');
      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockWorkspaceService.updateWorkspace.mockRejectedValue(privacyUpdateError);

      await expect(onboardingWorkflowService.completeOnboarding(inputWithTeamPrivacy))
        .rejects.toThrow(TransactionError);

      // Onboarding completion should not be called
      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });
  });

  describe('Complex scenarios and edge cases', () => {
    it('should handle concurrent onboarding completion attempts', async () => {
      // First call succeeds
      mockUserProfileService.upsertProfile.mockResolvedValueOnce(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValueOnce(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValueOnce(mockOnboarding);

      // Second call should handle existing data gracefully
      mockUserProfileService.upsertProfile.mockResolvedValueOnce(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValueOnce(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValueOnce(mockOnboarding);

      const [result1, result2] = await Promise.all([
        onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput),
        onboardingWorkflowService.completeOnboarding(validCompleteOnboardingInput),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle very long workspace names and truncate appropriately', async () => {
      const inputWithLongWorkspaceName = {
        ...validCompleteOnboardingInput,
        userProfile: {
          ...validCompleteOnboardingInput.userProfile,
          preferences: {
            workspaceName: 'A'.repeat(150), // Very long name
            privacy: 'PRIVATE' as const,
          },
        },
      };

      await expect(onboardingWorkflowService.completeOnboarding(inputWithLongWorkspaceName))
        .rejects.toThrow(TransactionError);
    });

    it('should handle special characters in user input', async () => {
      const inputWithSpecialChars = {
        ...validCompleteOnboardingInput,
        userProfile: {
          fullName: 'José María O\'Connor-Smith',
          displayName: 'José',
          preferences: {
            workspaceName: 'José\'s Creative 🎨 Workspace',
            privacy: 'PRIVATE' as const,
          },
        },
      };

      mockUserProfileService.upsertProfile.mockResolvedValue(mockProfile);
      mockWorkspaceService.createDefaultWorkspace.mockResolvedValue(mockWorkspace);
      mockOnboardingService.completeOnboarding.mockResolvedValue(mockOnboarding);

      const result = await onboardingWorkflowService.completeOnboarding(inputWithSpecialChars);

      expect(result.success).toBe(true);
      expect(mockUserProfileService.upsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'José María O\'Connor-Smith',
          displayName: 'José',
        })
      );
    });
  });
});
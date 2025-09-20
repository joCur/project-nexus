import { 
  ValidationError as _ValidationError,
  TransactionError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { z } from 'zod';

import { UserProfileService } from './userProfile';
import { OnboardingService } from './onboarding';
import { WorkspaceService } from './workspace';

/**
 * Onboarding Workflow Service - Orchestrates the complete onboarding process
 * Handles user profile creation, workspace setup, and progress tracking
 */

const logger = createContextLogger({ service: 'OnboardingWorkflowService' });

// Validation schemas
const completeOnboardingSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  userProfile: z.object({
    fullName: z.string().min(1, 'Full name is required').max(255),
    displayName: z.string().min(1).max(100).optional(),
    timezone: z.string().max(100).optional(),
    role: z.enum(['STUDENT', 'RESEARCHER', 'CREATIVE', 'BUSINESS', 'OTHER']).optional(),
    preferences: z.object({
      workspaceName: z.string().min(1, 'Workspace name is required').max(100),
      privacy: z.enum(['PRIVATE', 'TEAM', 'PUBLIC']).optional().default('PRIVATE'),
      notifications: z.boolean().optional().default(true),
    }).loose().optional(),
  }),
  tutorialProgress: z.record(z.string(), z.boolean()).optional().default({}),
});

// Types
interface CompleteOnboardingInput {
  userId: string;
  userProfile: {
    fullName: string;
    displayName?: string;
    timezone?: string;
    role?: 'STUDENT' | 'RESEARCHER' | 'CREATIVE' | 'BUSINESS' | 'OTHER';
    preferences?: {
      workspaceName: string;
      privacy?: 'PRIVATE' | 'TEAM' | 'PUBLIC';
      notifications?: boolean;
      [key: string]: any;
    };
  };
  tutorialProgress?: Record<string, boolean>;
}

interface OnboardingResult {
  profile: any;
  onboarding: any;
  workspace: any;
  success: boolean;
}

export class OnboardingWorkflowService {
  private userProfileService: UserProfileService;
  private onboardingService: OnboardingService;
  private workspaceService: WorkspaceService;

  constructor(
    userProfileService: UserProfileService,
    onboardingService: OnboardingService,
    workspaceService: WorkspaceService
  ) {
    this.userProfileService = userProfileService;
    this.onboardingService = onboardingService;
    this.workspaceService = workspaceService;
  }

  /**
   * Complete the entire onboarding process in a coordinated transaction
   */
  async completeOnboarding(input: CompleteOnboardingInput): Promise<OnboardingResult> {
    try {
      // Validate input
      const validatedInput = completeOnboardingSchema.parse(input);

      logger.info('Starting complete onboarding process', {
        userId: validatedInput.userId,
        fullName: validatedInput.userProfile.fullName,
        workspaceName: validatedInput.userProfile.preferences?.workspaceName,
      });

      // Step 1: Create or update user profile
      const profile = await this.createOrUpdateUserProfile(validatedInput);

      // Step 2: Create default workspace
      const workspace = await this.createDefaultWorkspace(validatedInput);

      // Step 3: Complete onboarding tracking
      const onboarding = await this.completeOnboardingTracking(validatedInput);

      logger.info('Onboarding process completed successfully', {
        userId: validatedInput.userId,
        profileId: profile.id,
        workspaceId: workspace.id,
        onboardingId: onboarding.id,
      });

      return {
        profile,
        onboarding,
        workspace,
        success: true,
      };

    } catch (error) {
      logger.error('Failed to complete onboarding process', {
        userId: input.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // If we've started the process but failed, we should clean up partially created data
      // For now, we'll let the individual services handle their own rollback
      // In a production system, you might want to implement proper transaction management

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TransactionError(`Onboarding process failed: ${errorMessage}`);
    }
  }

  /**
   * Update onboarding progress for a specific step
   */
  async updateOnboardingStep(
    userId: string,
    currentStep: number,
    tutorialProgress?: Record<string, boolean>
  ): Promise<any> {
    try {
      logger.info('Updating onboarding step', {
        userId,
        currentStep,
        tutorialProgress,
      });

      const progress = await this.onboardingService.updateProgress({
        userId,
        currentStep,
        tutorialProgress: tutorialProgress || {},
      });

      return progress;

    } catch (error) {
      logger.error('Failed to update onboarding step', {
        userId,
        currentStep,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get complete onboarding status for a user
   */
  async getOnboardingStatus(userId: string): Promise<{
    profile: any;
    onboarding: any;
    defaultWorkspace: any;
    isComplete: boolean;
  }> {
    try {
      logger.info('Fetching onboarding status from services', {
        userId,
        userIdType: typeof userId,
        userIdLength: userId?.length,
      });

      // Get all onboarding-related data
      const [profile, onboarding, defaultWorkspace] = await Promise.all([
        this.userProfileService.getProfileByUserId(userId),
        this.onboardingService.getProgress(userId),
        this.workspaceService.getDefaultWorkspace(userId),
      ]);

      const isComplete = onboarding?.completed || false;

      logger.info('Onboarding status fetched from services', {
        userId,
        hasProfile: !!profile,
        hasOnboarding: !!onboarding,
        hasDefaultWorkspace: !!defaultWorkspace,
        isComplete,
        onboardingCompleted: onboarding?.completed,
        onboardingId: onboarding?.id,
        profileId: profile?.id,
      });

      return {
        profile,
        onboarding,
        defaultWorkspace,
        isComplete,
      };

    } catch (error) {
      logger.error('Failed to get onboarding status', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create or update user profile
   */
  private async createOrUpdateUserProfile(input: z.infer<typeof completeOnboardingSchema>): Promise<any> {
    const profileInput = {
      userId: input.userId,
      fullName: input.userProfile.fullName,
      displayName: input.userProfile.displayName,
      timezone: input.userProfile.timezone,
      role: input.userProfile.role?.toLowerCase() as any,
      preferences: input.userProfile.preferences || {},
    };

    // Use upsert to handle both create and update cases
    const profile = await this.userProfileService.upsertProfile(profileInput);

    logger.info('User profile created/updated during onboarding', {
      userId: input.userId,
      profileId: profile.id,
      fullName: profile.fullName,
    });

    return profile;
  }

  /**
   * Create default workspace for the user
   */
  private async createDefaultWorkspace(input: z.infer<typeof completeOnboardingSchema>): Promise<any> {
    const workspaceName = input.userProfile.preferences?.workspaceName || 'My Workspace';
    const privacy = (input.userProfile.preferences?.privacy || 'PRIVATE').toLowerCase();

    const workspace = await this.workspaceService.createDefaultWorkspace(
      input.userId,
      workspaceName
    );

    // Update workspace privacy if specified
    if (privacy !== 'private') {
      await this.workspaceService.updateWorkspace(workspace.id, {
        privacy: privacy as 'private' | 'team' | 'public',
      });
    }

    logger.info('Default workspace created during onboarding', {
      userId: input.userId,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      privacy,
    });

    return workspace;
  }

  /**
   * Complete onboarding tracking
   */
  private async completeOnboardingTracking(input: z.infer<typeof completeOnboardingSchema>): Promise<any> {
    const onboarding = await this.onboardingService.completeOnboarding({
      userId: input.userId,
      tutorialProgress: input.tutorialProgress || {},
    });

    logger.info('Onboarding tracking completed', {
      userId: input.userId,
      onboardingId: onboarding.id,
      finalStep: onboarding.finalStep,
    });

    return onboarding;
  }

  /**
   * Reset entire onboarding state (for admin use or testing)
   */
  async resetOnboarding(userId: string): Promise<void> {
    try {
      logger.info('Resetting complete onboarding state', { userId });

      // Reset onboarding progress
      await this.onboardingService.resetOnboarding(userId);

      // Note: We don't delete profile or workspace as they may have user data
      // This just resets the onboarding tracking

      logger.info('Onboarding state reset successfully', { userId });

    } catch (error) {
      logger.error('Failed to reset onboarding state', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}



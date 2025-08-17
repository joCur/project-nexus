import { 
  AuthenticationError, 
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { OnboardingWorkflowService } from '@/services/onboardingWorkflow';

/**
 * GraphQL resolvers for complete onboarding workflow operations
 */

const logger = createContextLogger({ service: 'OnboardingWorkflowResolvers' });

export const onboardingWorkflowResolvers = {
  Query: {
    /**
     * Get complete onboarding status for current user
     */
    myOnboardingStatus: async (
      _: any,
      __: any,
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workflowService = new OnboardingWorkflowService(
        context.dataSources.userProfileService,
        context.dataSources.onboardingService,
        context.dataSources.workspaceService
      );

      try {
        const status = await workflowService.getOnboardingStatus(context.user!.id);

        return {
          profile: status.profile,
          onboarding: status.onboarding,
          defaultWorkspace: status.defaultWorkspace,
          isComplete: status.isComplete,
        };

      } catch (error) {
        logger.error('Failed to get onboarding status via GraphQL', {
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  Mutation: {
    /**
     * Complete the entire onboarding process
     */
    completeOnboardingWorkflow: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workflowService = new OnboardingWorkflowService(
        context.dataSources.userProfileService,
        context.dataSources.onboardingService,
        context.dataSources.workspaceService
      );

      try {
        // Add current user's ID to the input
        const workflowInput = {
          ...input,
          userId: context.user!.id,
        };

        const result = await workflowService.completeOnboarding(workflowInput);

        logger.info('Onboarding workflow completed via GraphQL', {
          userId: context.user!.id,
          profileId: result.profile.id,
          workspaceId: result.workspace.id,
          onboardingId: result.onboarding.id,
        });

        return {
          success: result.success,
          profile: result.profile,
          onboarding: result.onboarding,
          workspace: result.workspace,
        };

      } catch (error) {
        logger.error('Failed to complete onboarding workflow via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update onboarding step progress
     */
    updateOnboardingStep: async (
      _: any,
      { currentStep, tutorialProgress }: { currentStep: number; tutorialProgress?: Record<string, boolean> },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workflowService = new OnboardingWorkflowService(
        context.dataSources.userProfileService,
        context.dataSources.onboardingService,
        context.dataSources.workspaceService
      );

      try {
        const progress = await workflowService.updateOnboardingStep(
          context.user!.id,
          currentStep,
          tutorialProgress
        );

        logger.info('Onboarding step updated via GraphQL', {
          userId: context.user!.id,
          currentStep,
          tutorialProgress,
        });

        return progress;

      } catch (error) {
        logger.error('Failed to update onboarding step via GraphQL', {
          userId: context.user!.id,
          currentStep,
          tutorialProgress,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },
};
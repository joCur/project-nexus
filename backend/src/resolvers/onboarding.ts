import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError as _NotFoundError,
  ValidationError as _ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';

/**
 * GraphQL resolvers for onboarding operations
 */

const logger = createContextLogger({ service: 'OnboardingResolvers' });

export const onboardingResolvers = {
  Query: {
    /**
     * Get onboarding progress by user ID (admin or self only)
     */
    onboardingProgress: async (
      _: any,
      { userId }: { userId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only view their own onboarding unless they have admin permissions
      if (context.user?.id !== userId && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Cannot access other user onboarding progress',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const onboardingService = context.dataSources.onboardingService;
      return await onboardingService.getProgress(userId);
    },

    /**
     * Get current user's onboarding progress
     */
    myOnboardingProgress: async (
      _: any,
      __: any,
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const onboardingService = context.dataSources.onboardingService;
      return await onboardingService.getProgress(context.user!.id);
    },

    /**
     * Check if onboarding is complete for user
     */
    isOnboardingComplete: async (
      _: any,
      { userId }: { userId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only check their own onboarding unless they have admin permissions
      if (context.user?.id !== userId && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          undefined, // Use default "Insufficient permissions" message
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const onboardingService = context.dataSources.onboardingService;
      return await onboardingService.isOnboardingComplete(userId);
    },
  },

  Mutation: {
    /**
     * Update onboarding progress
     */
    updateOnboardingProgress: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const onboardingService = context.dataSources.onboardingService;

      try {
        // Add current user's ID to the input
        const progressInput = {
          ...input,
          userId: context.user!.id,
        };

        const progress = await onboardingService.updateProgress(progressInput);

        logger.info('Onboarding progress updated via GraphQL', {
          userId: context.user!.id,
          currentStep: input.currentStep,
        });

        return progress;

      } catch (error) {
        logger.error('Failed to update onboarding progress via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Complete onboarding process
     */
    completeOnboarding: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const onboardingService = context.dataSources.onboardingService;

      try {
        // Add current user's ID to the input
        const completeInput = {
          ...input,
          userId: context.user!.id,
        };

        const progress = await onboardingService.completeOnboarding(completeInput);

        logger.info('Onboarding completed via GraphQL', {
          userId: context.user!.id,
          finalStep: progress.finalStep,
        });

        return progress;

      } catch (error) {
        logger.error('Failed to complete onboarding via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Reset onboarding progress (admin only or self)
     */
    resetOnboarding: async (
      _: any,
      { userId }: { userId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only reset their own onboarding unless they have admin permissions
      if (context.user?.id !== userId && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          undefined, // Use default "Insufficient permissions" message
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const onboardingService = context.dataSources.onboardingService;

      try {
        await onboardingService.resetOnboarding(userId);

        logger.info('Onboarding reset via GraphQL', {
          userId,
          resetByUserId: context.user?.id,
        });

        return true;

      } catch (error) {
        logger.error('Failed to reset onboarding via GraphQL', {
          userId,
          resetByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },
  },

  // Field resolvers
  User: {
    /**
     * Resolve onboarding progress for User type
     */
    onboarding: async (user: any, _: any, context: GraphQLContext) => {
      const onboardingService = context.dataSources.onboardingService;
      return await onboardingService.getProgress(user.id);
    },
  },
};
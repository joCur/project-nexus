import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
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
        logger.warn('Unauthenticated request to myOnboardingProgress');
        throw new AuthenticationError();
      }

      const userId = context.user!.id;
      logger.info('Fetching onboarding progress', { userId });
      
      const onboardingService = context.dataSources.onboardingService;
      
      try {
        const progress = await onboardingService.getProgress(userId);
        
        logger.info('Successfully retrieved onboarding progress', {
          userId,
          hasProgress: !!progress,
          completed: progress?.completed,
          currentStep: progress?.currentStep
        });
        
        return progress;
      } catch (error) {
        logger.error('Failed to get onboarding progress', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
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
        logger.warn('Unauthenticated request to isOnboardingComplete', { requestedUserId: userId });
        throw new AuthenticationError();
      }

      // Users can only check their own onboarding unless they have admin permissions
      if (context.user?.id !== userId && !context.permissions.includes('admin:user_management')) {
        logger.warn('Unauthorized access attempt to onboarding completion check', {
          requestingUserId: context.user?.id,
          targetUserId: userId,
          permissions: context.permissions
        });
        throw new AuthorizationError(
          undefined, // Use default "Insufficient permissions" message
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      logger.info('Checking onboarding completion status', {
        userId,
        requestingUserId: context.user?.id
      });
      
      const onboardingService = context.dataSources.onboardingService;
      
      try {
        const isComplete = await onboardingService.isOnboardingComplete(userId);
        
        logger.info('Onboarding completion check result', {
          userId,
          isComplete,
          requestingUserId: context.user?.id
        });
        
        return isComplete;
      } catch (error) {
        logger.error('Failed to check onboarding completion', {
          userId,
          requestingUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
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
        logger.warn('Unauthenticated request to updateOnboardingProgress');
        throw new AuthenticationError();
      }

      const userId = context.user!.id;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Starting onboarding progress update', {
        requestId,
        userId,
        currentStep: input.currentStep,
        tutorialProgress: input.tutorialProgress,
        timestamp: new Date().toISOString()
      });

      const onboardingService = context.dataSources.onboardingService;

      try {
        // Add current user's ID to the input
        const progressInput = {
          ...input,
          userId,
        };

        // Check if there's already an onboarding record for race condition debugging
        const existingProgress = await onboardingService.getProgress(userId);
        logger.info('Existing progress state before update', {
          requestId,
          userId,
          existingProgress: existingProgress ? {
            completed: existingProgress.completed,
            currentStep: existingProgress.currentStep,
            updatedAt: existingProgress.updatedAt
          } : null
        });

        const startTime = Date.now();
        const progress = await onboardingService.updateProgress(progressInput);
        const duration = Date.now() - startTime;

        logger.info('Onboarding progress updated successfully via GraphQL', {
          requestId,
          userId,
          currentStep: input.currentStep,
          newCurrentStep: progress.currentStep,
          completed: progress.completed,
          duration,
          timestamp: new Date().toISOString()
        });

        return progress;

      } catch (error) {
        logger.error('Failed to update onboarding progress via GraphQL', {
          requestId,
          input,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
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
        logger.warn('Unauthenticated request to completeOnboarding');
        throw new AuthenticationError();
      }

      const userId = context.user!.id;
      const requestId = `complete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Starting onboarding completion', {
        requestId,
        userId,
        tutorialProgress: input.tutorialProgress,
        timestamp: new Date().toISOString()
      });

      const onboardingService = context.dataSources.onboardingService;

      try {
        // Check current state before completion
        const existingProgress = await onboardingService.getProgress(userId);
        logger.info('Current progress state before completion', {
          requestId,
          userId,
          existingProgress: existingProgress ? {
            completed: existingProgress.completed,
            currentStep: existingProgress.currentStep,
            updatedAt: existingProgress.updatedAt
          } : null
        });

        // Add current user's ID to the input
        const completeInput = {
          ...input,
          userId,
        };

        const startTime = Date.now();
        const progress = await onboardingService.completeOnboarding(completeInput);
        const duration = Date.now() - startTime;

        logger.info('Onboarding completed successfully via GraphQL', {
          requestId,
          userId,
          finalStep: progress.finalStep,
          completed: progress.completed,
          completedAt: progress.completedAt,
          duration,
          timestamp: new Date().toISOString()
        });

        return progress;

      } catch (error) {
        logger.error('Failed to complete onboarding via GraphQL', {
          requestId,
          input,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
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
      logger.debug('Resolving onboarding progress for User field', {
        userId: user.id,
        requestingUserId: context.user?.id
      });
      
      const onboardingService = context.dataSources.onboardingService;
      
      try {
        const progress = await onboardingService.getProgress(user.id);
        
        logger.debug('User.onboarding field resolved successfully', {
          userId: user.id,
          hasProgress: !!progress,
          completed: progress?.completed
        });
        
        return progress;
      } catch (error) {
        logger.error('Failed to resolve User.onboarding field', {
          userId: user.id,
          requestingUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    },
  },
};
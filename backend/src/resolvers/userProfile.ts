import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError as _ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';

/**
 * GraphQL resolvers for user profile management operations
 */

const logger = createContextLogger({ service: 'UserProfileResolvers' });

export const userProfileResolvers = {
  Query: {
    /**
     * Get user profile by user ID (admin or self only)
     */
    userProfile: async (
      _: any,
      { userId }: { userId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only view their own profile unless they have admin permissions
      if (context.user?.id !== userId && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Cannot access other user profiles',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userProfileService = context.dataSources.userProfileService;
      const profile = await userProfileService.getProfileByUserId(userId);

      if (!profile) {
        throw new NotFoundError('User profile', userId);
      }

      return profile;
    },

    /**
     * Get current user's profile
     */
    myProfile: async (
      _: any,
      __: any,
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const userProfileService = context.dataSources.userProfileService;
      return await userProfileService.getProfileByUserId(context.user!.id);
    },
  },

  Mutation: {
    /**
     * Create user profile
     */
    createUserProfile: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const userProfileService = context.dataSources.userProfileService;

      try {
        // Add current user's ID to the input
        const profileInput = {
          ...input,
          userId: context.user!.id,
        };

        const profile = await userProfileService.createProfile(profileInput);

        logger.info('User profile created via GraphQL', {
          userId: context.user!.id,
          profileId: profile.id,
          fullName: profile.fullName,
        });

        return profile;

      } catch (error) {
        logger.error('Failed to create user profile via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update user profile (admin or self only)
     */
    updateUserProfile: async (
      _: any,
      { userId, input }: { userId: string; input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only update their own profile unless they have admin permissions
      if (context.user?.id !== userId && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Cannot update other user profiles',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userProfileService = context.dataSources.userProfileService;

      try {
        const profile = await userProfileService.updateProfile(userId, input);

        logger.info('User profile updated via GraphQL', {
          userId,
          profileId: profile.id,
          updatedByUserId: context.user?.id,
          updatedFields: Object.keys(input),
        });

        return profile;

      } catch (error) {
        logger.error('Failed to update user profile via GraphQL', {
          userId,
          input,
          updatedByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update current user's profile
     */
    updateMyProfile: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const userProfileService = context.dataSources.userProfileService;

      try {
        const profile = await userProfileService.upsertProfile({
          ...input,
          userId: context.user!.id,
        });

        logger.info('User profile updated (self) via GraphQL', {
          userId: context.user!.id,
          profileId: profile.id,
          updatedFields: Object.keys(input),
        });

        return profile;

      } catch (error) {
        logger.error('Failed to update own profile via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Delete user profile (admin only)
     */
    deleteUserProfile: async (
      _: any,
      { userId }: { userId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      if (!context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Insufficient permissions to delete user profiles',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userProfileService = context.dataSources.userProfileService;

      try {
        await userProfileService.deleteProfile(userId);

        logger.info('User profile deleted via GraphQL', {
          userId,
          deletedByUserId: context.user?.id,
        });

        return true;

      } catch (error) {
        logger.error('Failed to delete user profile via GraphQL', {
          userId,
          deletedByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },
  },

  // Field resolvers
  User: {
    /**
     * Resolve user profile for User type
     */
    profile: async (user: any, _: any, context: GraphQLContext) => {
      const userProfileService = context.dataSources.userProfileService;
      return await userProfileService.getProfileByUserId(user.id);
    },
  },
};
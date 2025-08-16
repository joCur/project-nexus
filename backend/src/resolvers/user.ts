import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';

/**
 * GraphQL resolvers for user management operations
 */

const logger = createContextLogger({ service: 'UserResolvers' });

export const userResolvers = {
  Query: {
    /**
     * Get user by ID
     */
    user: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only view their own profile unless they have admin permissions
      if (context.user?.id !== id && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Cannot access other user profiles',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userService = context.dataSources.userService;
      const user = await userService.findById(id);

      if (!user) {
        throw new NotFoundError('User', id);
      }

      return user;
    },

    /**
     * List users with pagination (admin only)
     */
    users: async (
      _: any,
      { pagination }: { pagination?: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      if (!context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Insufficient permissions to list users',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userService = context.dataSources.userService;
      return await userService.list(pagination);
    },

    /**
     * Search users by name or email (authenticated users only)
     */
    searchUsers: async (
      _: any,
      { query, limit }: { query: string; limit?: number },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      if (query.length < 2) {
        throw new ValidationError('Search query must be at least 2 characters');
      }

      const userService = context.dataSources.userService;
      return await userService.search(query, limit);
    },
  },

  Mutation: {
    /**
     * Create user (admin only)
     */
    createUser: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      if (!context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Insufficient permissions to create users',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userService = context.dataSources.userService;

      try {
        const user = await userService.create(input);

        logger.info('User created via GraphQL', {
          createdUserId: user.id,
          createdByUserId: context.user?.id,
          email: user.email,
        });

        return user;

      } catch (error) {
        logger.error('Failed to create user via GraphQL', {
          input,
          createdByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update user
     */
    updateUser: async (
      _: any,
      { id, input }: { id: string; input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only update their own profile unless they have admin permissions
      if (context.user?.id !== id && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Cannot update other user profiles',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userService = context.dataSources.userService;

      try {
        // If non-admin is updating, restrict what they can change
        let allowedInput = input;
        if (context.user?.id === id && !context.permissions.includes('admin:user_management')) {
          // Regular users can only update display name and avatar
          allowedInput = {
            displayName: input.displayName,
            avatarUrl: input.avatarUrl,
          };
        }

        const user = await userService.update(id, allowedInput);

        logger.info('User updated via GraphQL', {
          updatedUserId: id,
          updatedByUserId: context.user?.id,
          updatedFields: Object.keys(allowedInput),
        });

        return user;

      } catch (error) {
        logger.error('Failed to update user via GraphQL', {
          userId: id,
          input,
          updatedByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Delete user (admin only)
     */
    deleteUser: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      if (!context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Insufficient permissions to delete users',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      // Prevent self-deletion
      if (context.user?.id === id) {
        throw new ValidationError('Cannot delete your own account');
      }

      const userService = context.dataSources.userService;

      try {
        await userService.delete(id);

        logger.info('User deleted via GraphQL', {
          deletedUserId: id,
          deletedByUserId: context.user?.id,
        });

        return true;

      } catch (error) {
        logger.error('Failed to delete user via GraphQL', {
          userId: id,
          deletedByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update user's last login timestamp
     */
    updateLastLogin: async (
      _: any,
      { userId }: { userId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only update their own last login or admins can update any
      if (context.user?.id !== userId && !context.permissions.includes('admin:user_management')) {
        throw new AuthorizationError(
          'Cannot update other user login timestamps',
          'INSUFFICIENT_PERMISSIONS',
          'admin:user_management',
          context.permissions
        );
      }

      const userService = context.dataSources.userService;

      try {
        await userService.updateLastLogin(userId);
        return true;

      } catch (error) {
        logger.error('Failed to update last login via GraphQL', {
          userId,
          updatedByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },
  },
};
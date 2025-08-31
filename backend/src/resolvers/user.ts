import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { createAuthorizationHelper } from '@/utils/authorizationHelper';

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
      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireUserDataAccess(
        id,
        'Cannot access other user profiles',
        'user_profile',
        'read'
      );

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

      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireGlobalPermission(
        'admin:user_management',
        'Insufficient permissions to list users',
        'users',
        'list'
      );

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

      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireGlobalPermission(
        'admin:user_management',
        'Insufficient permissions to create users',
        'users',
        'create'
      );

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
      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireUserDataAccess(
        id,
        'Cannot update other user profiles',
        'user_profile',
        'update'
      );

      const userService = context.dataSources.userService;

      try {
        // If non-admin is updating, restrict what they can change
        let allowedInput = input;
        const hasAdminPermission = await authHelper.hasGlobalPermission('admin:user_management');
        if (context.user?.id === id && !hasAdminPermission) {
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

      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireGlobalPermission(
        'admin:user_management',
        'Insufficient permissions to delete users',
        'users',
        'delete'
      );

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
      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireUserDataAccess(
        userId,
        'Cannot update other user login timestamps',
        'user_login_timestamp',
        'update'
      );

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
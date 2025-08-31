import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError as _ValidationError 
} from '@/utils/errors';
import { securityLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { UserService as _UserService } from '@/services/user';
import { Auth0Service as _Auth0Service } from '@/services/auth0';
import { CacheService as _CacheService } from '@/services/cache';
import { createAuthorizationHelper, extendedSecurityLogger } from '@/utils/authorizationHelper';

/**
 * GraphQL resolvers for authentication operations
 * Implements Auth0 integration and session management
 */

export const authResolvers = {
  Query: {
    /**
     * Get current authenticated user
     */
    me: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.isAuthenticated || !context.user) {
        return null;
      }
      return context.user;
    },

    /**
     * Validate current session
     */
    validateSession: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.isAuthenticated || !context.user) {
        return false;
      }

      // Check session validity with Auth0 service
      const auth0Service = context.dataSources.auth0Service;
      const isValid = await auth0Service.validateSession(context.user.id);
      
      if (!isValid) {
        securityLogger.sessionEvent('expired', context.user.id, {
          reason: 'validation_failed',
        });
      }

      return isValid;
    },
  },

  Mutation: {
    /**
     * Sync user from Auth0 token and create session
     */
    syncUserFromAuth0: async (
      _: any,
      { auth0Token }: { auth0Token: string },
      context: GraphQLContext
    ) => {
      const auth0Service = context.dataSources.auth0Service;

      try {
        // Validate Auth0 token
        const auth0User = await auth0Service.validateAuth0Token(auth0Token);
        if (!auth0User) {
          throw new AuthenticationError('Invalid Auth0 token');
        }

        // Sync user to database
        const user = await auth0Service.syncUserFromAuth0(auth0User);

        // Create session
        const sessionId = await auth0Service.createSession(user, auth0User);

        // Calculate expiration time
        const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

        securityLogger.authSuccess(user.id, auth0User.sub, {
          sessionId,
          email: user.email,
          roles: user.roles,
        });

        // Get user permissions across all workspaces
        const permissions = await (async () => {
          try {
            const workspacePermissions = await context.dataSources.workspaceAuthorizationService.getUserPermissionsForContext(user.id);
            
            // Flatten permissions from all workspaces into a single array
            const allPermissions = Object.values(workspacePermissions || {}).flat();
            
            // Remove duplicates and return
            return [...new Set(allPermissions)];
          } catch (error) {
            securityLogger.authFailure('permission_resolution', {
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Return empty array on error to maintain functionality
            return [];
          }
        })();

        return {
          user,
          sessionId,
          expiresAt,
          permissions,
        };

      } catch (error) {
        securityLogger.authFailure('sync_from_auth0', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Refresh current session
     */
    refreshSession: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.isAuthenticated || !context.user) {
        throw new AuthenticationError();
      }

      const auth0Service = context.dataSources.auth0Service;
      const cacheService = context.dataSources.cacheService;

      try {
        // Validate current session
        const isValid = await auth0Service.validateSession(context.user.id);
        if (!isValid) {
          throw new AuthenticationError('Session expired');
        }

        // Get current session data
        const sessionData = await cacheService.get(`session:${context.user.id}`);
        if (!sessionData) {
          throw new AuthenticationError('Session not found');
        }

        const session = JSON.parse(sessionData);
        session.lastActivity = new Date();
        
        // Ensure dates are properly converted from strings to Date objects
        if (typeof session.expiresAt === 'string') {
          session.expiresAt = new Date(session.expiresAt);
        }
        if (typeof session.createdAt === 'string') {
          session.createdAt = new Date(session.createdAt);
        }

        // Update session in cache
        await cacheService.set(
          `session:${context.user.id}`,
          session,
          4 * 60 * 60 * 1000 // 4 hours
        );

        securityLogger.sessionEvent('refreshed', context.user.id);

        return session;

      } catch (error) {
        securityLogger.sessionEvent('expired', context.user.id, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Logout user and destroy session
     */
    logout: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.isAuthenticated || !context.user) {
        return true; // Already logged out
      }

      const auth0Service = context.dataSources.auth0Service;

      try {
        await auth0Service.destroySession(context.user.id);
        securityLogger.sessionEvent('destroyed', context.user.id, {
          reason: 'user_logout',
        });
        return true;

      } catch (error) {
        securityLogger.sessionEvent('destroyed', context.user.id, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },


    /**
     * Assign role to user (admin only)
     */
    assignRole: async (
      _: any,
      { userId, role }: { userId: string; role: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Check admin permission in user's context
      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireGlobalPermission(
        'admin:user_management',
        'Insufficient permissions to assign roles',
        'user_roles',
        'assign'
      );

      const userService = context.dataSources.userService;

      const user = await userService.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Add role if not already present
      const updatedRoles = user.roles.includes(role) 
        ? user.roles 
        : [...user.roles, role];

      const updatedUser = await userService.update(userId, {
        roles: updatedRoles,
      });

      extendedSecurityLogger.authorizationSuccess(context.user!.id, 'user_roles', 'assign', {
        targetUserId: userId,
        assignedRole: role,
      });

      return updatedUser;
    },

    /**
     * Remove role from user (admin only)
     */
    removeRole: async (
      _: any,
      { userId, role }: { userId: string; role: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Check admin permission in user's context
      const authHelper = createAuthorizationHelper(context);
      await authHelper.requireGlobalPermission(
        'admin:user_management',
        'Insufficient permissions to remove roles',
        'user_roles',
        'remove'
      );

      const userService = context.dataSources.userService;

      const user = await userService.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Remove role
      const updatedRoles = user.roles.filter(userRole => userRole !== role);

      const updatedUser = await userService.update(userId, {
        roles: updatedRoles,
      });

      extendedSecurityLogger.authorizationSuccess(context.user!.id, 'user_roles', 'remove', {
        targetUserId: userId,
        removedRole: role,
      });

      return updatedUser;
    },
  },

  // Custom scalar resolvers
  DateTime: {
    serialize: (value: Date) => value.toISOString(),
    parseValue: (value: string) => new Date(value),
    parseLiteral: (ast: any) => new Date(ast.value),
  },

  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => JSON.parse(ast.value),
  },

  // User field resolvers
  User: {
    workspaces: async (parent: any, _: any, context: GraphQLContext) => {
      const userService = context.dataSources.userService;
      return await userService.getUserWorkspaces(parent.id);
    },
    permissions: () => {
      // Return empty permissions array - will be resolved dynamically using WorkspaceAuthorizationService in NEX-182
      return [];
    },
  },
};
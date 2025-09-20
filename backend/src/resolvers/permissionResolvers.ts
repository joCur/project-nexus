/**
 * GraphQL resolvers for permission queries
 * 
 * Connects frontend permission checking to backend WorkspaceAuthorizationService
 * 
 * @see NEX-186 - Frontend permission integration with backend
 */

import { GraphQLContext } from '@/types';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { AuthenticationError, AuthorizationError, ValidationError } from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger({ service: 'PermissionResolvers' });

/**
 * Permission query resolvers
 * All resolvers require authentication and connect to WorkspaceAuthorizationService
 */
export const permissionResolvers = {
  Query: {
    /**
     * Get all permissions for a user in a specific workspace
     * 
     * @param userId - The user ID to get permissions for
     * @param workspaceId - The workspace ID to check permissions in
     * @returns Array of permission strings for the user in this workspace
     */
    getUserWorkspacePermissions: async (
      _: any,
      { userId, workspaceId }: { userId: string; workspaceId: string },
      context: GraphQLContext
    ): Promise<string[]> => {
      // Require authentication
      if (!context.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Validate inputs
      if (!userId || !workspaceId) {
        throw new ValidationError('Both userId and workspaceId are required');
      }

      try {
        const authService = new WorkspaceAuthorizationService();

        // Users can only query their own permissions unless they're admin/owner
        if (context.user.id !== userId) {
          // Check if current user has permission to view other users' permissions in this workspace
          const hasAdminAccess = await authService.hasPermissionInWorkspace(
            context.user.id,
            workspaceId,
            'workspace:manage_members'
          );

          if (!hasAdminAccess) {
            throw new AuthorizationError(
              'Insufficient permissions to view other users\' permissions',
              'PERMISSION_VIEW_DENIED',
              'workspace:manage_members',
              []
            );
          }
        }

        // Get permissions for the user in the workspace
        const permissions = await authService.getUserPermissionsInWorkspace(userId, workspaceId);

        logger.info('Retrieved user workspace permissions', {
          userId,
          workspaceId,
          permissionCount: permissions.length,
          requestedBy: context.user.id
        });

        return permissions;
      } catch (error) {
        logger.error('Failed to get user workspace permissions', {
          userId,
          workspaceId,
          requestedBy: context.user.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Check if a user has a specific permission in a workspace
     * 
     * @param userId - The user ID to check permission for
     * @param workspaceId - The workspace ID to check permission in
     * @param permission - The specific permission to check
     * @returns Boolean indicating if user has the permission
     */
    checkUserPermission: async (
      _: any,
      { userId, workspaceId, permission }: { userId: string; workspaceId: string; permission: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      // Require authentication
      if (!context.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Validate inputs
      if (!userId || !workspaceId || !permission) {
        throw new ValidationError('userId, workspaceId, and permission are all required');
      }

      try {
        const authService = new WorkspaceAuthorizationService();

        // Users can only check their own permissions unless they're admin/owner
        if (context.user.id !== userId) {
          // Check if current user has permission to check other users' permissions in this workspace
          const hasAdminAccess = await authService.hasPermissionInWorkspace(
            context.user.id,
            workspaceId,
            'workspace:manage_members'
          );

          if (!hasAdminAccess) {
            throw new AuthorizationError(
              'Insufficient permissions to check other users\' permissions',
              'PERMISSION_CHECK_DENIED',
              'workspace:manage_members',
              []
            );
          }
        }

        // Check if user has the specific permission in the workspace
        const hasPermission = await authService.hasPermissionInWorkspace(userId, workspaceId, permission);

        logger.debug('Checked user permission', {
          userId,
          workspaceId,
          permission,
          hasPermission,
          requestedBy: context.user.id
        });

        return hasPermission;
      } catch (error) {
        logger.error('Failed to check user permission', {
          userId,
          workspaceId,
          permission,
          requestedBy: context.user.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Get all permissions for a user across all their workspaces
     * Used for GraphQL context resolution and global permission checking
     * 
     * @param userId - The user ID to get permissions for
     * @returns Object mapping workspace IDs to permission arrays
     */
    getUserPermissionsForContext: async (
      _: any,
      _args: Record<string, never>,
      context: GraphQLContext
    ): Promise<{ [workspaceId: string]: string[] }> => {
      // Require authentication
      if (!context.user) {
        throw new AuthenticationError('Authentication required');
      }

      try {
        const authService = new WorkspaceAuthorizationService();

        // Get permissions across all workspaces for the authenticated user
        // This query only returns the current user's permissions context
        const permissionsContext = await authService.getUserPermissionsForContext(context.user.id);

        logger.info('Retrieved user permissions context', {
          userId: context.user.id,
          workspaceCount: Object.keys(permissionsContext).length,
        });

        return permissionsContext;
      } catch (error) {
        logger.error('Failed to get user permissions context', {
          userId: context.user.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  }
};

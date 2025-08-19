import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';

/**
 * GraphQL resolvers for workspace management operations
 */

const logger = createContextLogger({ service: 'WorkspaceResolvers' });

export const workspaceResolvers = {
  Query: {
    /**
     * Get workspace by ID
     */
    workspace: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workspaceService = context.dataSources.workspaceService;
      const workspace = await workspaceService.getWorkspaceById(id);

      if (!workspace) {
        throw new NotFoundError('Workspace', id);
      }

      // Users can only view their own workspaces unless they have admin permissions
      if (workspace.ownerId !== context.user?.id && !context.permissions.includes('admin:workspace_management')) {
        throw new AuthorizationError(
          'Cannot access other user workspaces',
          'INSUFFICIENT_PERMISSIONS',
          'admin:workspace_management',
          context.permissions
        );
      }

      return workspace;
    },

    /**
     * Get workspaces by owner ID (admin or self only)
     */
    workspaces: async (
      _: any,
      { ownerId }: { ownerId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only view their own workspaces unless they have admin permissions
      if (context.user?.id !== ownerId && !context.permissions.includes('admin:workspace_management')) {
        throw new AuthorizationError(
          'Cannot access other user workspaces',
          'INSUFFICIENT_PERMISSIONS',
          'admin:workspace_management',
          context.permissions
        );
      }

      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getWorkspacesByOwnerId(ownerId);
    },

    /**
     * Get current user's workspaces
     */
    myWorkspaces: async (
      _: any,
      __: any,
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getWorkspacesByOwnerId(context.user!.id);
    },

    /**
     * Get default workspace by owner ID (admin or self only)
     */
    defaultWorkspace: async (
      _: any,
      { ownerId }: { ownerId: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // Users can only view their own workspaces unless they have admin permissions
      if (context.user?.id !== ownerId && !context.permissions.includes('admin:workspace_management')) {
        throw new AuthorizationError(
          'Cannot access other user workspaces',
          'INSUFFICIENT_PERMISSIONS',
          'admin:workspace_management',
          context.permissions
        );
      }

      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getDefaultWorkspace(ownerId);
    },

    /**
     * Get current user's default workspace
     */
    myDefaultWorkspace: async (
      _: any,
      __: any,
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getDefaultWorkspace(context.user!.id);
    },
  },

  Mutation: {
    /**
     * Create workspace
     */
    createWorkspace: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workspaceService = context.dataSources.workspaceService;

      try {
        // Add current user's ID as owner
        const workspaceInput = {
          ...input,
          ownerId: context.user!.id,
        };

        const workspace = await workspaceService.createWorkspace(workspaceInput);

        logger.info('Workspace created via GraphQL', {
          ownerId: context.user!.id,
          workspaceId: workspace.id,
          name: workspace.name,
          isDefault: workspace.isDefault,
        });

        return workspace;

      } catch (error) {
        logger.error('Failed to create workspace via GraphQL', {
          input,
          ownerId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update workspace
     */
    updateWorkspace: async (
      _: any,
      { id, input }: { id: string; input: any },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workspaceService = context.dataSources.workspaceService;

      // Check if workspace exists and user has permission
      const existingWorkspace = await workspaceService.getWorkspaceById(id);
      if (!existingWorkspace) {
        throw new NotFoundError('Workspace', id);
      }

      // Users can only update their own workspaces unless they have admin permissions
      if (existingWorkspace.ownerId !== context.user?.id && !context.permissions.includes('admin:workspace_management')) {
        throw new AuthorizationError(
          'Cannot update other user workspaces',
          'INSUFFICIENT_PERMISSIONS',
          'admin:workspace_management',
          context.permissions
        );
      }

      try {
        const workspace = await workspaceService.updateWorkspace(id, input);

        logger.info('Workspace updated via GraphQL', {
          workspaceId: id,
          ownerId: existingWorkspace.ownerId,
          updatedByUserId: context.user?.id,
          updatedFields: Object.keys(input),
        });

        return workspace;

      } catch (error) {
        logger.error('Failed to update workspace via GraphQL', {
          workspaceId: id,
          input,
          updatedByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Delete workspace
     */
    deleteWorkspace: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workspaceService = context.dataSources.workspaceService;

      // Check if workspace exists and user has permission
      const existingWorkspace = await workspaceService.getWorkspaceById(id);
      if (!existingWorkspace) {
        throw new NotFoundError('Workspace', id);
      }

      // Users can only delete their own workspaces unless they have admin permissions
      if (existingWorkspace.ownerId !== context.user?.id && !context.permissions.includes('admin:workspace_management')) {
        throw new AuthorizationError(
          'Cannot delete other user workspaces',
          'INSUFFICIENT_PERMISSIONS',
          'admin:workspace_management',
          context.permissions
        );
      }

      try {
        await workspaceService.deleteWorkspace(id);

        logger.info('Workspace deleted via GraphQL', {
          workspaceId: id,
          ownerId: existingWorkspace.ownerId,
          deletedByUserId: context.user?.id,
        });

        return true;

      } catch (error) {
        logger.error('Failed to delete workspace via GraphQL', {
          workspaceId: id,
          deletedByUserId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },

    /**
     * Create default workspace for current user
     */
    createDefaultWorkspace: async (
      _: any,
      { workspaceName }: { workspaceName: string },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const workspaceService = context.dataSources.workspaceService;

      try {
        const workspace = await workspaceService.createDefaultWorkspace(
          context.user!.id,
          workspaceName
        );

        logger.info('Default workspace created via GraphQL', {
          ownerId: context.user!.id,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
        });

        return workspace;

      } catch (error) {
        logger.error('Failed to create default workspace via GraphQL', {
          ownerId: context.user!.id,
          workspaceName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  // Field resolvers
  Workspace: {
    /**
     * Resolve owner for Workspace type
     */
    owner: async (workspace: any, _: any, context: GraphQLContext) => {
      const userService = context.dataSources.userService;
      return await userService.findById(workspace.ownerId);
    },
  },
};
import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError as _ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';

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

      // Check if user has access to workspace (role-based)
      const workspaceAuthService = context.dataSources.workspaceAuthorizationService;
      const hasAccess = await workspaceAuthService.hasPermissionInWorkspace(
        context.user!.id,
        id,
        'workspace:read'
      );

      if (!hasAccess) {
        throw new AuthorizationError(
          'You do not have access to this workspace',
          'WORKSPACE_ACCESS_DENIED',
          'workspace:read',
          []
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
      if (context.user?.id !== ownerId) {
        const workspaceAuthService = context.dataSources.workspaceAuthorizationService;
        const userPermissionsByWorkspace = await workspaceAuthService.getUserPermissionsForContext(context.user!.id);
        const flatUserPermissions = Object.values(userPermissionsByWorkspace).flat();
        
        if (!flatUserPermissions.includes('admin:workspace_management')) {
          throw new AuthorizationError(
            'Cannot access other user workspaces',
            'INSUFFICIENT_PERMISSIONS',
            'admin:workspace_management',
            flatUserPermissions
          );
        }
      }

      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getWorkspacesByOwnerId(ownerId);
    },

    /**
     * Get current user's workspaces (including ones where user is a member)
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
      const workspaceAuthService = context.dataSources.workspaceAuthorizationService;

      // Get workspaces owned by user
      const ownedWorkspaces = await workspaceService.getWorkspacesByOwnerId(context.user!.id);

      // Get workspaces where user is a member (but not owner)
      // TODO: Implement method to get all workspaces where user is a member
      // const _memberWorkspaces = await workspaceAuthService.getUserWorkspaces(context.user!.id);
      
      // For now, just return owned workspaces
      // TODO: Implement method to get all workspaces where user is a member
      return ownedWorkspaces;
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
      if (context.user?.id !== ownerId) {
        const workspaceAuthService = context.dataSources.workspaceAuthorizationService;
        const userPermissionsByWorkspace = await workspaceAuthService.getUserPermissionsForContext(context.user!.id);
        const flatUserPermissions = Object.values(userPermissionsByWorkspace).flat();
        
        if (!flatUserPermissions.includes('admin:workspace_management')) {
          throw new AuthorizationError(
            'Cannot access other user workspaces',
            'INSUFFICIENT_PERMISSIONS',
            'admin:workspace_management',
            flatUserPermissions
          );
        }
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

      // Check if user has permission to update workspace
      const workspaceAuthService = context.dataSources.workspaceAuthorizationService;
      const hasUpdatePermission = await workspaceAuthService.hasPermissionInWorkspace(
        context.user!.id,
        id,
        'workspace:update'
      );
      
      if (!hasUpdatePermission) {
        const userPermissions = await workspaceAuthService.getUserPermissionsInWorkspace(context.user!.id, id);
        throw new AuthorizationError(
          'You do not have permission to update this workspace',
          'INSUFFICIENT_PERMISSIONS',
          'workspace:update',
          userPermissions
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

      // Check if user has permission to delete workspace
      const workspaceAuthService = context.dataSources.workspaceAuthorizationService;
      const hasDeletePermission = await workspaceAuthService.hasPermissionInWorkspace(
        context.user!.id,
        id,
        'workspace:delete'
      );
      
      if (!hasDeletePermission) {
        const userPermissions = await workspaceAuthService.getUserPermissionsInWorkspace(context.user!.id, id);
        throw new AuthorizationError(
          'You do not have permission to delete this workspace',
          'INSUFFICIENT_PERMISSIONS',
          'workspace:delete',
          userPermissions
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
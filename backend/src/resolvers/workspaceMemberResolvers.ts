import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError as _ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { WorkspaceAuthorizationService, WorkspaceMember } from '@/services/workspaceAuthorization';
import { WorkspaceInvitationService, WorkspaceInvite } from '@/services/workspaceInvitation';
import { WorkspaceRole } from '@/types/auth';

const logger = createContextLogger({ service: 'WorkspaceMemberResolvers' });

/**
 * GraphQL resolvers for workspace member management operations
 * Implements role-based access control and invitation system
 */
export const workspaceMemberResolvers = {
  Query: {
    /**
     * Get all members of a workspace
     */
    workspaceMembers: async (
      _: any,
      { workspaceId }: { workspaceId: string },
      context: GraphQLContext
    ): Promise<WorkspaceMember[]> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const authService = context.dataSources.workspaceAuthorizationService;
        
        // Check if user has access to view workspace members
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'workspace:read',
          'You do not have access to view this workspace'
        );

        const members = await authService.getWorkspaceMembers(workspaceId);

        logger.info('Retrieved workspace members', {
          workspaceId,
          requesterId: context.user!.id,
          memberCount: members.length
        });

        return members;
      } catch (error) {
        logger.error('Failed to get workspace members', {
          workspaceId,
          requesterId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Get specific workspace member
     */
    workspaceMember: async (
      _: any,
      { workspaceId, userId }: { workspaceId: string; userId: string },
      context: GraphQLContext
    ): Promise<WorkspaceMember | null> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const authService = context.dataSources.workspaceAuthorizationService;
        
        // Check access to workspace
        const hasAccess = await authService.hasWorkspaceAccess(
          context.user!.id,
          workspaceId,
          'workspace:read'
        );

        if (!hasAccess) {
          throw new AuthorizationError(
            'You do not have access to this workspace',
            'WORKSPACE_ACCESS_DENIED'
          );
        }

        return await authService.getWorkspaceMember(userId, workspaceId);
      } catch (error) {
        logger.error('Failed to get workspace member', {
          workspaceId,
          userId,
          requesterId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Get workspace invitations
     */
    workspaceInvites: async (
      _: any,
      { workspaceId }: { workspaceId: string },
      context: GraphQLContext
    ): Promise<WorkspaceInvite[]> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const inviteService = new WorkspaceInvitationService();
        
        // Get invites (service handles permission check)
        return await inviteService.getWorkspaceInvites(
          workspaceId,
          context.user!.id
        );
      } catch (error) {
        logger.error('Failed to get workspace invites', {
          workspaceId,
          requesterId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Get current user's invitations
     */
    myInvites: async (
      _: any,
      __: any,
      context: GraphQLContext
    ): Promise<WorkspaceInvite[]> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const inviteService = new WorkspaceInvitationService();
        const user = await context.dataSources.userService.findById(context.user!.id);
        
        if (!user) {
          throw new NotFoundError('User', context.user!.id);
        }

        return await inviteService.getUserInvites(user.email);
      } catch (error) {
        logger.error('Failed to get user invites', {
          requesterId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Get invitation by token (for accepting invites)
     */
    inviteByToken: async (
      _: any,
      { token }: { token: string },
      context: GraphQLContext
    ): Promise<WorkspaceInvite | null> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const inviteService = new WorkspaceInvitationService();
        return await inviteService.getInviteByToken(token);
      } catch (error) {
        logger.error('Failed to get invite by token', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
      }
    },
  },

  Mutation: {
    /**
     * Invite user to workspace
     */
    inviteToWorkspace: async (
      _: any,
      { input }: { 
        input: {
          workspaceId: string;
          email: string;
          role: WorkspaceRole;
          permissions?: string[];
          message?: string;
        }
      },
      context: GraphQLContext
    ): Promise<WorkspaceInvite> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const inviteService = new WorkspaceInvitationService();

        const invite = await inviteService.createInvite(
          input.workspaceId,
          input.email,
          input.role,
          context.user!.id,
          input.message,
          input.permissions
        );

        logger.info('Created workspace invitation', {
          workspaceId: input.workspaceId,
          email: input.email,
          role: input.role,
          invitedBy: context.user!.id
        });

        return invite;
      } catch (error) {
        logger.error('Failed to create workspace invitation', {
          input,
          invitedBy: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Accept workspace invitation
     */
    acceptInvite: async (
      _: any,
      { input }: { input: { token: string } },
      context: GraphQLContext
    ): Promise<WorkspaceMember> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const inviteService = new WorkspaceInvitationService();
        const authService = context.dataSources.workspaceAuthorizationService;

        await inviteService.acceptInvite(input.token, context.user!.id);

        // Get the invitation to determine workspace
        const invite = await inviteService.getInviteByToken(input.token);
        if (!invite) {
          throw new NotFoundError('Invitation', input.token);
        }

        // Return the new member
        const member = await authService.getWorkspaceMember(context.user!.id, invite.workspaceId);
        if (!member) {
          throw new Error('Failed to create workspace membership');
        }

        logger.info('Accepted workspace invitation', {
          workspaceId: invite.workspaceId,
          userId: context.user!.id,
          role: invite.role
        });

        return member;
      } catch (error) {
        logger.error('Failed to accept invitation', {
          token: input.token,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Reject workspace invitation
     */
    rejectInvite: async (
      _: any,
      { token }: { token: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const inviteService = new WorkspaceInvitationService();
        await inviteService.rejectInvite(token);

        logger.info('Rejected workspace invitation', {
          token,
          userId: context.user!.id
        });

        return true;
      } catch (error) {
        logger.error('Failed to reject invitation', {
          token,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
      }
    },

    /**
     * Cancel workspace invitation
     */
    cancelInvite: async (
      _: any,
      { inviteId }: { inviteId: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const inviteService = new WorkspaceInvitationService();
        await inviteService.cancelInvite(inviteId, context.user!.id);

        logger.info('Cancelled workspace invitation', {
          inviteId,
          cancelledBy: context.user!.id
        });

        return true;
      } catch (error) {
        logger.error('Failed to cancel invitation', {
          inviteId,
          cancelledBy: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
      }
    },

    /**
     * Update workspace member role
     */
    updateWorkspaceMember: async (
      _: any,
      { 
        workspaceId, 
        userId, 
        input 
      }: { 
        workspaceId: string; 
        userId: string; 
        input: { role: WorkspaceRole; permissions: string[] }
      },
      context: GraphQLContext
    ): Promise<WorkspaceMember> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const authService = context.dataSources.workspaceAuthorizationService;

        // Check if requester has permission to manage members
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'workspace:manage_members',
          'You do not have permission to update workspace members'
        );

        await authService.updateMemberRole(
          workspaceId,
          userId,
          input.role,
          context.user!.id
        );

        const updatedMember = await authService.getWorkspaceMember(userId, workspaceId);
        if (!updatedMember) {
          throw new NotFoundError('Workspace member', `${workspaceId}:${userId}`);
        }

        logger.info('Updated workspace member', {
          workspaceId,
          userId,
          newRole: input.role,
          updatedBy: context.user!.id
        });

        return updatedMember;
      } catch (error) {
        logger.error('Failed to update workspace member', {
          workspaceId,
          userId,
          input,
          updatedBy: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },

    /**
     * Remove workspace member
     */
    removeWorkspaceMember: async (
      _: any,
      { workspaceId, userId }: { workspaceId: string; userId: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const authService = context.dataSources.workspaceAuthorizationService;

        // Check if requester has permission to manage members
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'workspace:manage_members',
          'You do not have permission to remove workspace members'
        );

        await authService.removeMember(workspaceId, userId, context.user!.id);

        logger.info('Removed workspace member', {
          workspaceId,
          userId,
          removedBy: context.user!.id
        });

        return true;
      } catch (error) {
        logger.error('Failed to remove workspace member', {
          workspaceId,
          userId,
          removedBy: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
      }
    },

    /**
     * Leave workspace
     */
    leaveWorkspace: async (
      _: any,
      { workspaceId }: { workspaceId: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const authService = context.dataSources.workspaceAuthorizationService;
        
        // Users can always leave a workspace (except owners)
        await authService.removeMember(workspaceId, context.user!.id, context.user!.id);

        logger.info('User left workspace', {
          workspaceId,
          userId: context.user!.id
        });

        return true;
      } catch (error) {
        logger.error('Failed to leave workspace', {
          workspaceId,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
      }
    },
  },

  // Field resolvers
  WorkspaceMember: {
    /**
     * Resolve user for WorkspaceMember type
     */
    user: async (member: WorkspaceMember, _: any, context: GraphQLContext) => {
      const userService = context.dataSources.userService;
      return await userService.findById(member.userId);
    },

    /**
     * Resolve invitedBy user for WorkspaceMember type
     */
    invitedBy: async (member: WorkspaceMember, _: any, context: GraphQLContext) => {
      if (!member.invitedBy) return null;
      const userService = context.dataSources.userService;
      return await userService.findById(member.invitedBy);
    },
  },

  WorkspaceInvite: {
    /**
     * Resolve workspace for WorkspaceInvite type
     */
    workspace: async (invite: WorkspaceInvite, _: any, context: GraphQLContext) => {
      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getWorkspaceById(invite.workspaceId);
    },

    /**
     * Resolve invitedBy user for WorkspaceInvite type
     */
    invitedBy: async (invite: WorkspaceInvite, _: any, context: GraphQLContext) => {
      const userService = context.dataSources.userService;
      return await userService.findById(invite.invitedBy);
    },
  },

  // Add field resolvers to existing Workspace type
  Workspace: {
    /**
     * Resolve members for Workspace type
     */
    members: async (workspace: any, _: any, context: GraphQLContext) => {
      if (!context.isAuthenticated) return [];

      try {
        const authService = context.dataSources.workspaceAuthorizationService;
        
        // Check if user has access to view workspace
        const hasAccess = await authService.hasWorkspaceAccess(
          context.user!.id,
          workspace.id,
          'workspace:read'
        );

        if (!hasAccess) return [];

        return await authService.getWorkspaceMembers(workspace.id);
      } catch (error) {
        logger.error('Failed to resolve workspace members', {
          workspaceId: workspace.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return [];
      }
    },

    /**
     * Resolve member count for Workspace type
     */
    memberCount: async (workspace: any, _: any, context: GraphQLContext) => {
      if (!context.isAuthenticated) return 0;

      try {
        const authService = context.dataSources.workspaceAuthorizationService;
        
        // Check if user has access to view workspace
        const hasAccess = await authService.hasWorkspaceAccess(
          context.user!.id,
          workspace.id,
          'workspace:read'
        );

        if (!hasAccess) return 0;

        const members = await authService.getWorkspaceMembers(workspace.id);
        return members.length;
      } catch (error) {
        logger.error('Failed to resolve workspace member count', {
          workspaceId: workspace.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return 0;
      }
    },

    /**
     * Resolve current user's role in workspace
     */
    currentUserRole: async (workspace: any, _: any, context: GraphQLContext) => {
      if (!context.isAuthenticated) return null;

      try {
        const authService = context.dataSources.workspaceAuthorizationService;
        const member = await authService.getWorkspaceMember(context.user!.id, workspace.id);
        return member?.role || null;
      } catch (error) {
        return null;
      }
    },
  },
};
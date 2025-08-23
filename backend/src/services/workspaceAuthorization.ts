import { NotFoundError, AuthorizationError } from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { WorkspaceService } from './workspace';

/**
 * Workspace Authorization Service
 * Provides centralized workspace access control for GraphQL resolvers
 * 
 * Used by cardResolvers and connectionResolvers for consistent authorization
 */

const logger = createContextLogger({ service: 'WorkspaceAuthorizationService' });

export class WorkspaceAuthorizationService {
  private workspaceService: WorkspaceService;

  constructor() {
    this.workspaceService = new WorkspaceService();
  }

  /**
   * Check if user has access to a workspace
   */
  async hasWorkspaceAccess(
    userId: string,
    workspaceId: string,
    permission: string
  ): Promise<boolean> {
    try {
      const workspace = await this.workspaceService.getWorkspaceById(workspaceId);
      
      if (!workspace) {
        return false;
      }

      // For now, only workspace owners have access
      // This can be extended later for team workspaces
      return workspace.ownerId === userId;

    } catch (error) {
      logger.error('Failed to check workspace access', {
        userId,
        workspaceId,
        permission,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Require permission or throw authorization error
   */
  async requirePermission(
    userId: string,
    workspaceId: string,
    permission: string,
    errorMessage: string
  ): Promise<void> {
    const hasAccess = await this.hasWorkspaceAccess(userId, workspaceId, permission);
    
    if (!hasAccess) {
      throw new AuthorizationError(
        errorMessage,
        'WORKSPACE_ACCESS_DENIED',
        permission,
        []
      );
    }
  }

  /**
   * Check if user can access multiple workspaces
   * Useful for batch operations
   */
  async hasMultipleWorkspaceAccess(
    userId: string,
    workspaceIds: string[],
    permission: string
  ): Promise<{ [workspaceId: string]: boolean }> {
    const results: { [workspaceId: string]: boolean } = {};

    for (const workspaceId of workspaceIds) {
      results[workspaceId] = await this.hasWorkspaceAccess(userId, workspaceId, permission);
    }

    return results;
  }

  /**
   * Require permission for multiple workspaces or throw error
   */
  async requireMultipleWorkspacePermissions(
    userId: string,
    workspaceIds: string[],
    permission: string,
    errorMessage: string
  ): Promise<void> {
    const accessResults = await this.hasMultipleWorkspaceAccess(userId, workspaceIds, permission);
    
    const deniedWorkspaces = Object.entries(accessResults)
      .filter(([_, hasAccess]) => !hasAccess)
      .map(([workspaceId]) => workspaceId);

    if (deniedWorkspaces.length > 0) {
      logger.warn('Multiple workspace access denied', {
        userId,
        permission,
        deniedWorkspaces,
      });

      throw new AuthorizationError(
        `${errorMessage}. Denied access to workspaces: ${deniedWorkspaces.join(', ')}`,
        'WORKSPACE_ACCESS_DENIED',
        permission,
        []
      );
    }
  }

  /**
   * Get workspace with access validation
   */
  async getWorkspaceWithAccess(
    userId: string,
    workspaceId: string,
    permission: string
  ) {
    const workspace = await this.workspaceService.getWorkspaceById(workspaceId);
    
    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId);
    }

    if (workspace.ownerId !== userId) {
      throw new AuthorizationError(
        'Cannot access workspace you do not own',
        'WORKSPACE_ACCESS_DENIED',
        permission,
        []
      );
    }

    return workspace;
  }
}
import { database, knex } from '@/database/connection';
import { 
  NotFoundError, 
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { z } from 'zod';

/**
 * Workspace Service - Repository layer for workspace management
 * Implements workspace CRUD operations for onboarding and user workspaces
 */

const logger = createContextLogger({ service: 'WorkspaceService' });

// Validation schemas
const workspaceCreateSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
  ownerId: z.string().uuid('Invalid owner ID format'),
  privacy: z.enum(['private', 'team', 'public']).optional().default('private'),
  settings: z.record(z.any()).optional().default({}),
  isDefault: z.boolean().optional().default(false),
});

const workspaceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  privacy: z.enum(['private', 'team', 'public']).optional(),
  settings: z.record(z.any()).optional(),
  isDefault: z.boolean().optional(),
});

// Types
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  privacy: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  settings: Record<string, any>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkspaceCreateInput {
  name: string;
  ownerId: string;
  privacy?: 'private' | 'team' | 'public';
  settings?: Record<string, any>;
  isDefault?: boolean;
}

interface WorkspaceUpdateInput {
  name?: string;
  privacy?: 'private' | 'team' | 'public';
  settings?: Record<string, any>;
  isDefault?: boolean;
}

export class WorkspaceService {
  private readonly tableName = 'workspaces';

  /**
   * Get workspace by ID
   */
  async getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
    try {
      const workspace = await database.query<any>(
        knex(this.tableName)
          .where('id', workspaceId)
          .first(),
        'workspace_get_by_id'
      );

      return workspace ? this.mapDbWorkspaceToWorkspace(workspace) : null;

    } catch (error) {
      logger.error('Failed to get workspace by ID', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get workspaces by owner ID
   */
  async getWorkspacesByOwnerId(ownerId: string): Promise<Workspace[]> {
    try {
      const workspaces = await database.query<any[]>(
        knex(this.tableName)
          .where('owner_id', ownerId)
          .orderBy('created_at', 'desc'),
        'workspace_get_by_owner_id'
      );

      return workspaces.map(workspace => this.mapDbWorkspaceToWorkspace(workspace));

    } catch (error) {
      logger.error('Failed to get workspaces by owner ID', {
        ownerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get default workspace for a user
   */
  async getDefaultWorkspace(ownerId: string): Promise<Workspace | null> {
    try {
      const workspace = await database.query<any>(
        knex(this.tableName)
          .where('owner_id', ownerId)
          .where('is_default', true)
          .first(),
        'workspace_get_default'
      );

      return workspace ? this.mapDbWorkspaceToWorkspace(workspace) : null;

    } catch (error) {
      logger.error('Failed to get default workspace', {
        ownerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(input: WorkspaceCreateInput): Promise<Workspace> {
    try {
      // Validate input
      const validatedInput = workspaceCreateSchema.parse(input);

      // If creating as default workspace, ensure no other default exists for this user
      if (validatedInput.isDefault) {
        await this.clearDefaultWorkspace(validatedInput.ownerId);
      }

      const workspaceData = {
        name: validatedInput.name,
        owner_id: validatedInput.ownerId,
        privacy: validatedInput.privacy,
        settings: validatedInput.settings,
        is_default: validatedInput.isDefault,
      };

      const [workspace] = await database.query<any[]>(
        knex(this.tableName)
          .insert(workspaceData)
          .returning('*'),
        'workspace_create'
      );

      logger.info('Workspace created', {
        ownerId: validatedInput.ownerId,
        workspaceId: workspace.id,
        name: validatedInput.name,
        isDefault: validatedInput.isDefault,
      });

      return this.mapDbWorkspaceToWorkspace(workspace);

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to create workspace', {
        ownerId: input.ownerId,
        name: input.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Update workspace
   */
  async updateWorkspace(workspaceId: string, input: WorkspaceUpdateInput): Promise<Workspace> {
    try {
      // Validate input
      const validatedInput = workspaceUpdateSchema.parse(input);

      // Check if workspace exists
      const existingWorkspace = await this.getWorkspaceById(workspaceId);
      if (!existingWorkspace) {
        throw new NotFoundError('Workspace', workspaceId);
      }

      // If setting as default workspace, ensure no other default exists for this user
      if (validatedInput.isDefault === true) {
        await this.clearDefaultWorkspace(existingWorkspace.ownerId);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date(),
      };

      if (validatedInput.name !== undefined) {
        updateData.name = validatedInput.name;
      }
      if (validatedInput.privacy !== undefined) {
        updateData.privacy = validatedInput.privacy;
      }
      if (validatedInput.settings !== undefined) {
        updateData.settings = {
          ...existingWorkspace.settings,
          ...validatedInput.settings,
        };
      }
      if (validatedInput.isDefault !== undefined) {
        updateData.is_default = validatedInput.isDefault;
      }

      const [updatedWorkspace] = await database.query<any[]>(
        knex(this.tableName)
          .where('id', workspaceId)
          .update(updateData)
          .returning('*'),
        'workspace_update'
      );

      logger.info('Workspace updated', {
        workspaceId,
        ownerId: existingWorkspace.ownerId,
        updatedFields: Object.keys(updateData),
      });

      return this.mapDbWorkspaceToWorkspace(updatedWorkspace);

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to update workspace', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    try {
      // Check if workspace exists
      const existingWorkspace = await this.getWorkspaceById(workspaceId);
      if (!existingWorkspace) {
        throw new NotFoundError('Workspace', workspaceId);
      }

      await database.query(
        knex(this.tableName)
          .where('id', workspaceId)
          .del(),
        'workspace_delete'
      );

      logger.info('Workspace deleted', { 
        workspaceId, 
        ownerId: existingWorkspace.ownerId,
        name: existingWorkspace.name 
      });

    } catch (error) {
      logger.error('Failed to delete workspace', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create default workspace for user (used during onboarding)
   */
  async createDefaultWorkspace(ownerId: string, workspaceName: string = 'My Workspace'): Promise<Workspace> {
    try {
      // Check if user already has a default workspace
      const existingDefault = await this.getDefaultWorkspace(ownerId);
      if (existingDefault) {
        logger.info('User already has default workspace', {
          ownerId,
          workspaceId: existingDefault.id,
          name: existingDefault.name,
        });
        return existingDefault;
      }

      // Create new default workspace
      return await this.createWorkspace({
        name: workspaceName,
        ownerId,
        privacy: 'private',
        isDefault: true,
        settings: {
          onboardingCompleted: true,
          createdDuringOnboarding: true,
        },
      });

    } catch (error) {
      logger.error('Failed to create default workspace', {
        ownerId,
        workspaceName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clear default workspace flag for all user's workspaces
   */
  private async clearDefaultWorkspace(ownerId: string): Promise<void> {
    try {
      await database.query(
        knex(this.tableName)
          .where('owner_id', ownerId)
          .where('is_default', true)
          .update({ 
            is_default: false,
            updated_at: new Date(),
          }),
        'workspace_clear_default'
      );

    } catch (error) {
      logger.error('Failed to clear default workspace', {
        ownerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Search workspaces by name
   */
  async searchWorkspaces(query: string, limit: number = 20): Promise<Workspace[]> {
    try {
      const workspaces = await database.query<any[]>(
        knex(this.tableName)
          .whereILike('name', `%${query}%`)
          .orderBy('name')
          .limit(limit),
        'workspace_search'
      );

      return workspaces.map(workspace => this.mapDbWorkspaceToWorkspace(workspace));

    } catch (error) {
      logger.error('Failed to search workspaces', {
        query,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Map database workspace record to Workspace interface
   */
  private mapDbWorkspaceToWorkspace(dbWorkspace: any): Workspace {
    return {
      id: dbWorkspace.id,
      name: dbWorkspace.name,
      ownerId: dbWorkspace.owner_id,
      privacy: dbWorkspace.privacy?.toUpperCase() || 'PRIVATE',
      settings: dbWorkspace.settings || {},
      isDefault: dbWorkspace.is_default,
      createdAt: new Date(dbWorkspace.created_at),
      updatedAt: new Date(dbWorkspace.updated_at),
    };
  }
}
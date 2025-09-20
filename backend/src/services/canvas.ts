import { database, knex } from '@/database/connection';
import { 
  Canvas,
  CreateCanvasInput,
  UpdateCanvasInput,
  CanvasStats,
  CanvasFilter,
  DuplicateCanvasOptions,
  CreateCanvasSchema,
  UpdateCanvasSchema,
  DuplicateCanvasSchema,
  CanvasNotFoundError as _CanvasNotFoundError,
  CanvasNameConflictError,
  DefaultCanvasError,
  CanvasValidationError as _CanvasValidationError
} from '@/types/canvas';
import { 
  NotFoundError, 
  ValidationError,
  UniqueConstraintError as _UniqueConstraintError,
  ConflictError
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { z } from 'zod';

/**
 * Canvas Service - Repository layer for canvas management
 * Implements canvas CRUD operations with authorization and business rules
 */

const logger = createContextLogger({ service: 'CanvasService' });

export class CanvasService {
  private readonly tableName = 'canvases';
  private readonly workspaceAuth: WorkspaceAuthorizationService;

  constructor() {
    this.workspaceAuth = new WorkspaceAuthorizationService();
  }

  /**
   * Get canvas by ID
   */
  async getCanvasById(canvasId: string): Promise<Canvas | null> {
    try {
      const dbCanvas = await database.query<any>(
        knex(this.tableName)
          .where('id', canvasId)
          .first(),
        'canvas_get_by_id'
      );

      return dbCanvas ? this.mapDbCanvasToCanvas(dbCanvas) : null;

    } catch (error) {
      logger.error('Failed to get canvas by ID', {
        canvasId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get canvases by workspace ID
   */
  async getCanvasesByWorkspace(
    workspaceId: string,
    filter?: CanvasFilter,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ canvases: Canvas[]; totalCount: number }> {
    try {
      let query = knex(this.tableName)
        .where('workspace_id', workspaceId);

      // Apply filters
      if (filter) {
        query = this.applyFilters(query, filter);
      }

      // Get total count
      const [{ count }] = await database.query<[{ count: string }]>(
        query.clone().count('id as count'),
        'canvases_count'
      );

      const totalCount = parseInt(count, 10);

      // Get paginated results ordered by position, then created_at
      const dbCanvases = await database.query<any[]>(
        query
          .orderBy('position', 'asc')
          .orderBy('created_at', 'asc')
          .limit(limit)
          .offset(offset),
        'canvases_list'
      );

      const canvases = dbCanvases.map(dbCanvas => this.mapDbCanvasToCanvas(dbCanvas));

      return { canvases, totalCount };

    } catch (error) {
      logger.error('Failed to get canvases by workspace', {
        workspaceId,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create new canvas
   */
  async createCanvas(input: CreateCanvasInput, userId: string): Promise<Canvas> {
    try {
      // Validate input
      const validatedInput = CreateCanvasSchema.parse(input);

      // Check if user has workspace access
      await this.workspaceAuth.requirePermission(
        userId, 
        validatedInput.workspaceId, 
        'canvas:create',
        'Insufficient permissions to create canvas in this workspace'
      );

      // Check for name conflicts within workspace
      const existingCanvas = await this.getCanvasByName(validatedInput.workspaceId, validatedInput.name);
      if (existingCanvas) {
        throw new CanvasNameConflictError(validatedInput.name, validatedInput.workspaceId);
      }

      // If this is being set as default, clear existing default
      if (validatedInput.isDefault) {
        await this.clearDefaultCanvas(validatedInput.workspaceId);
      }

      // If no position specified, set to next available position
      let position = validatedInput.position || 0;
      if (!validatedInput.position) {
        position = await this.getNextPosition(validatedInput.workspaceId);
      }

      const canvasData = {
        workspace_id: validatedInput.workspaceId,
        name: validatedInput.name,
        description: validatedInput.description || null,
        is_default: validatedInput.isDefault,
        position,
        created_by: userId,
      };

      const [dbCanvas] = await database.query<any[]>(
        knex(this.tableName)
          .insert(canvasData)
          .returning('*'),
        'canvas_create'
      );

      const canvas = this.mapDbCanvasToCanvas(dbCanvas);

      logger.info('Canvas created', {
        canvasId: canvas.id,
        workspaceId: canvas.workspaceId,
        name: canvas.name,
        isDefault: canvas.isDefault,
        userId,
      });

      return canvas;

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      if (error instanceof CanvasNameConflictError) {
        throw new ConflictError(error.message);
      }

      logger.error('Failed to create canvas', {
        workspaceId: input.workspaceId,
        name: input.name,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Update canvas
   */
  async updateCanvas(canvasId: string, input: UpdateCanvasInput, userId: string): Promise<Canvas> {
    try {
      // Validate input
      const validatedInput = UpdateCanvasSchema.parse(input);

      // Check if canvas exists
      const existingCanvas = await this.getCanvasById(canvasId);
      if (!existingCanvas) {
        throw new NotFoundError('Canvas', canvasId);
      }

      // Check if user has permission to update this canvas
      await this.workspaceAuth.requirePermission(
        userId,
        existingCanvas.workspaceId,
        'canvas:update',
        'Insufficient permissions to update this canvas'
      );

      // Check for name conflicts if name is being changed
      if (validatedInput.name && validatedInput.name !== existingCanvas.name) {
        const existingWithName = await this.getCanvasByName(existingCanvas.workspaceId, validatedInput.name);
        if (existingWithName && existingWithName.id !== canvasId) {
          throw new CanvasNameConflictError(validatedInput.name, existingCanvas.workspaceId);
        }
      }

      // If setting as default, clear existing default
      if (validatedInput.isDefault === true && !existingCanvas.isDefault) {
        await this.clearDefaultCanvas(existingCanvas.workspaceId);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date(),
      };

      if (validatedInput.name !== undefined) {
        updateData.name = validatedInput.name;
      }

      if (validatedInput.description !== undefined) {
        updateData.description = validatedInput.description;
      }

      if (validatedInput.isDefault !== undefined) {
        updateData.is_default = validatedInput.isDefault;
      }

      if (validatedInput.position !== undefined) {
        updateData.position = validatedInput.position;
      }

      const [updatedDbCanvas] = await database.query<any[]>(
        knex(this.tableName)
          .where('id', canvasId)
          .update(updateData)
          .returning('*'),
        'canvas_update'
      );

      const updatedCanvas = this.mapDbCanvasToCanvas(updatedDbCanvas);

      logger.info('Canvas updated', {
        canvasId,
        workspaceId: existingCanvas.workspaceId,
        updatedFields: Object.keys(updateData),
        userId,
      });

      return updatedCanvas;

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      if (error instanceof CanvasNameConflictError) {
        throw new ConflictError(error.message);
      }

      logger.error('Failed to update canvas', {
        canvasId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Delete canvas
   */
  async deleteCanvas(canvasId: string, userId: string): Promise<boolean> {
    try {
      // Check if canvas exists
      const existingCanvas = await this.getCanvasById(canvasId);
      if (!existingCanvas) {
        throw new NotFoundError('Canvas', canvasId);
      }

      // Check if user has permission to delete this canvas
      await this.workspaceAuth.requirePermission(
        userId,
        existingCanvas.workspaceId,
        'canvas:delete',
        'Insufficient permissions to delete this canvas'
      );

      // Check if this is the only canvas in the workspace
      if (existingCanvas.isDefault) {
        const { totalCount } = await this.getCanvasesByWorkspace(existingCanvas.workspaceId);
        if (totalCount === 1) {
          throw new DefaultCanvasError('Cannot delete the only canvas in a workspace');
        }

        // Set another canvas as default before deleting
        await this.setAnotherCanvasAsDefault(existingCanvas.workspaceId, canvasId);
      }

      await database.query(
        knex(this.tableName)
          .where('id', canvasId)
          .del(),
        'canvas_delete'
      );

      logger.info('Canvas deleted', {
        canvasId,
        workspaceId: existingCanvas.workspaceId,
        name: existingCanvas.name,
        userId,
      });

      return true;

    } catch (error) {
      if (error instanceof DefaultCanvasError) {
        throw new ConflictError(error.message);
      }

      logger.error('Failed to delete canvas', {
        canvasId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get default canvas for workspace
   */
  async getDefaultCanvas(workspaceId: string): Promise<Canvas | null> {
    try {
      const dbCanvas = await database.query<any>(
        knex(this.tableName)
          .where('workspace_id', workspaceId)
          .where('is_default', true)
          .first(),
        'canvas_get_default'
      );

      return dbCanvas ? this.mapDbCanvasToCanvas(dbCanvas) : null;

    } catch (error) {
      logger.error('Failed to get default canvas', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Set canvas as default with transaction safety and validation
   */
  async setDefaultCanvas(canvasId: string, userId: string): Promise<Canvas> {
    const operationStartTime = Date.now();

    try {
      // Check if canvas exists
      const existingCanvas = await this.getCanvasById(canvasId);
      if (!existingCanvas) {
        throw new NotFoundError('Canvas', canvasId);
      }

      // Check if user has permission
      await this.workspaceAuth.requirePermission(
        userId,
        existingCanvas.workspaceId,
        'canvas:update',
        'Insufficient permissions to set default canvas'
      );

      // If already default, return early
      if (existingCanvas.isDefault) {
        logger.info('Canvas already set as default, returning existing canvas', {
          canvasId,
          workspaceId: existingCanvas.workspaceId,
          userId,
        });
        return existingCanvas;
      }

      logger.info('Starting setDefaultCanvas operation', {
        canvasId,
        workspaceId: existingCanvas.workspaceId,
        userId,
        previousDefault: existingCanvas.isDefault,
      });

      // Execute operation in transaction for atomicity
      const result = await database.transaction(async (trx) => {
        // Clear existing default within transaction
        const clearResult = await trx(this.tableName)
          .where('workspace_id', existingCanvas.workspaceId)
          .where('is_default', true)
          .update({
            is_default: false,
            updated_at: new Date(),
          });

        logger.debug('Cleared existing default canvases', {
          workspaceId: existingCanvas.workspaceId,
          clearedCount: clearResult,
          canvasId,
          userId,
        });

        // Set new default within transaction
        const [updatedDbCanvas] = await trx(this.tableName)
          .where('id', canvasId)
          .update({
            is_default: true,
            updated_at: new Date(),
          })
          .returning('*');

        if (!updatedDbCanvas) {
          throw new Error('Failed to update canvas as default - canvas may have been deleted');
        }

        // Validate that only one default exists after operation
        const defaultCanvases = await trx(this.tableName)
          .where('workspace_id', existingCanvas.workspaceId)
          .where('is_default', true)
          .select('id', 'name');

        if (defaultCanvases.length !== 1) {
          throw new Error(
            `Database constraint violation: Found ${defaultCanvases.length} default canvases in workspace ${existingCanvas.workspaceId}, expected exactly 1`
          );
        }

        if (defaultCanvases[0].id !== canvasId) {
          throw new Error(
            `Database constraint violation: Expected canvas ${canvasId} to be default, but found ${defaultCanvases[0].id}`
          );
        }

        logger.debug('Validated single default canvas constraint', {
          workspaceId: existingCanvas.workspaceId,
          defaultCanvasId: defaultCanvases[0].id,
          defaultCanvasName: defaultCanvases[0].name,
          canvasId,
          userId,
        });

        return updatedDbCanvas;
      });

      const updatedCanvas = this.mapDbCanvasToCanvas(result);
      const operationDuration = Date.now() - operationStartTime;

      logger.info('Canvas set as default successfully', {
        canvasId,
        workspaceId: existingCanvas.workspaceId,
        canvasName: updatedCanvas.name,
        userId,
        operationDurationMs: operationDuration,
        wasAlreadyDefault: false,
      });

      return updatedCanvas;

    } catch (error) {
      const operationDuration = Date.now() - operationStartTime;

      logger.error('Failed to set default canvas', {
        canvasId,
        userId,
        operationDurationMs: operationDuration,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Duplicate canvas
   */
  async duplicateCanvas(
    canvasId: string, 
    options: DuplicateCanvasOptions, 
    userId: string
  ): Promise<Canvas> {
    try {
      // Validate options
      const validatedOptions = DuplicateCanvasSchema.parse(options);

      // Check if source canvas exists
      const sourceCanvas = await this.getCanvasById(canvasId);
      if (!sourceCanvas) {
        throw new NotFoundError('Canvas', canvasId);
      }

      // Check if user has permission to read source canvas
      await this.workspaceAuth.requirePermission(
        userId,
        sourceCanvas.workspaceId,
        'canvas:read',
        'Insufficient permissions to access source canvas'
      );

      // Check if user has permission to create canvas in workspace
      await this.workspaceAuth.requirePermission(
        userId,
        sourceCanvas.workspaceId,
        'canvas:create',
        'Insufficient permissions to create canvas in this workspace'
      );

      // Create new canvas using transaction for atomicity
      return await database.transaction(async (_trx) => {
        // Create the new canvas
        const newCanvas = await this.createCanvas({
          workspaceId: sourceCanvas.workspaceId,
          name: validatedOptions.name,
          description: validatedOptions.description || sourceCanvas.description,
          isDefault: false, // Duplicated canvas is never default
          position: validatedOptions.position || await this.getNextPosition(sourceCanvas.workspaceId)
        }, userId);

        // TODO: Implement card and connection duplication if requested
        // This would require CardService and ConnectionService integration
        if (validatedOptions.includeCards) {
          logger.info('Card duplication requested but not yet implemented', {
            sourceCanvasId: canvasId,
            newCanvasId: newCanvas.id
          });
        }

        if (validatedOptions.includeConnections) {
          logger.info('Connection duplication requested but not yet implemented', {
            sourceCanvasId: canvasId,
            newCanvasId: newCanvas.id
          });
        }

        logger.info('Canvas duplicated', {
          sourceCanvasId: canvasId,
          newCanvasId: newCanvas.id,
          workspaceId: sourceCanvas.workspaceId,
          userId,
        });

        return newCanvas;
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to duplicate canvas', {
        sourceCanvasId: canvasId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get canvas statistics
   */
  async getCanvasStatistics(canvasId: string, userId: string): Promise<CanvasStats> {
    try {
      // Check if canvas exists and user has access
      const canvas = await this.getCanvasById(canvasId);
      if (!canvas) {
        throw new NotFoundError('Canvas', canvasId);
      }

      await this.workspaceAuth.requirePermission(
        userId,
        canvas.workspaceId,
        'canvas:read',
        'Insufficient permissions to access canvas statistics'
      );

      // Get card count
      const [cardCountResult] = await database.query<[{ count: string }]>(
        knex('cards')
          .where('canvas_id', canvasId)
          .where('status', '!=', 'deleted') // Assuming cards have a status field
          .count('id as count'),
        'canvas_card_count'
      );

      const cardCount = parseInt(cardCountResult.count, 10);

      // Get connection count (assuming connections table exists)
      let connectionCount = 0;
      try {
        const [connectionCountResult] = await database.query<[{ count: string }]>(
          knex('connections')
            .whereIn('source_card_id', function() {
              this.select('id').from('cards').where('canvas_id', canvasId);
            })
            .orWhereIn('target_card_id', function() {
              this.select('id').from('cards').where('canvas_id', canvasId);
            })
            .count('id as count'),
          'canvas_connection_count'
        );
        connectionCount = parseInt(connectionCountResult.count, 10);
      } catch (err) {
        // Connections table might not exist yet, ignore error
        logger.debug('Could not count connections, table may not exist', { canvasId });
      }

      // Get last activity (most recent card update or creation)
      let lastActivity: Date | undefined;
      try {
        const lastActivityResult = await database.query<any>(
          knex('cards')
            .where('canvas_id', canvasId)
            .where('status', '!=', 'deleted')
            .orderBy('updated_at', 'desc')
            .select('updated_at')
            .first(),
          'canvas_last_activity'
        );

        if (lastActivityResult) {
          lastActivity = new Date(lastActivityResult.updated_at);
        }
      } catch (err) {
        // Non-critical error
        logger.debug('Could not determine last activity', { canvasId });
      }

      const stats: CanvasStats = {
        id: canvas.id,
        name: canvas.name,
        cardCount,
        connectionCount,
        lastActivity,
        createdAt: canvas.createdAt,
      };

      logger.debug('Canvas statistics retrieved', {
        canvasId,
        cardCount,
        connectionCount,
        userId,
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get canvas statistics', {
        canvasId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Authorization helper: Check if user can access canvas
   */
  async canUserAccessCanvas(userId: string, canvasId: string): Promise<boolean> {
    try {
      const canvas = await this.getCanvasById(canvasId);
      if (!canvas) {
        return false;
      }

      return await this.workspaceAuth.hasWorkspaceAccess(userId, canvas.workspaceId, 'canvas:read');
    } catch (error) {
      logger.error('Failed to check canvas access', {
        userId,
        canvasId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Authorization helper: Check if user can edit canvas
   */
  async canUserEditCanvas(userId: string, canvasId: string): Promise<boolean> {
    try {
      const canvas = await this.getCanvasById(canvasId);
      if (!canvas) {
        return false;
      }

      return await this.workspaceAuth.hasWorkspaceAccess(userId, canvas.workspaceId, 'canvas:update');
    } catch (error) {
      logger.error('Failed to check canvas edit permission', {
        userId,
        canvasId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Authorization helper: Check if user can delete canvas
   */
  async canUserDeleteCanvas(userId: string, canvasId: string): Promise<boolean> {
    try {
      const canvas = await this.getCanvasById(canvasId);
      if (!canvas) {
        return false;
      }

      return await this.workspaceAuth.hasWorkspaceAccess(userId, canvas.workspaceId, 'canvas:delete');
    } catch (error) {
      logger.error('Failed to check canvas delete permission', {
        userId,
        canvasId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Private helper: Get canvas by name within workspace
   */
  private async getCanvasByName(workspaceId: string, name: string): Promise<Canvas | null> {
    try {
      const dbCanvas = await database.query<any>(
        knex(this.tableName)
          .where('workspace_id', workspaceId)
          .where('name', name)
          .first(),
        'canvas_get_by_name'
      );

      return dbCanvas ? this.mapDbCanvasToCanvas(dbCanvas) : null;
    } catch (error) {
      logger.error('Failed to get canvas by name', {
        workspaceId,
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Private helper: Clear default canvas flag for workspace
   */
  private async clearDefaultCanvas(workspaceId: string): Promise<void> {
    try {
      await database.query(
        knex(this.tableName)
          .where('workspace_id', workspaceId)
          .where('is_default', true)
          .update({
            is_default: false,
            updated_at: new Date(),
          }),
        'canvas_clear_default'
      );
    } catch (error) {
      logger.error('Failed to clear default canvas', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private helper: Set another canvas as default when deleting default
   */
  private async setAnotherCanvasAsDefault(workspaceId: string, excludeCanvasId: string): Promise<void> {
    try {
      // Get the first available canvas (by position, then creation date)
      const dbCanvas = await database.query<any>(
        knex(this.tableName)
          .where('workspace_id', workspaceId)
          .where('id', '!=', excludeCanvasId)
          .orderBy('position', 'asc')
          .orderBy('created_at', 'asc')
          .first(),
        'canvas_get_replacement_default'
      );

      if (dbCanvas) {
        await database.query(
          knex(this.tableName)
            .where('id', dbCanvas.id)
            .update({
              is_default: true,
              updated_at: new Date(),
            }),
          'canvas_set_replacement_default'
        );

        logger.info('Set replacement default canvas', {
          workspaceId,
          newDefaultCanvasId: dbCanvas.id,
          excludedCanvasId: excludeCanvasId,
        });
      }
    } catch (error) {
      logger.error('Failed to set replacement default canvas', {
        workspaceId,
        excludeCanvasId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private helper: Get next position for new canvas
   */
  private async getNextPosition(workspaceId: string): Promise<number> {
    try {
      const result = await database.query<any>(
        knex(this.tableName)
          .where('workspace_id', workspaceId)
          .max('position as maxPosition')
          .first(),
        'canvas_get_max_position'
      );

      return (result?.maxPosition || -1) + 1;
    } catch (error) {
      logger.error('Failed to get next position', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0; // Default to 0 if can't determine
    }
  }

  /**
   * Private helper: Apply filters to query
   */
  private applyFilters(query: any, filter: CanvasFilter): any {
    if (filter.name) {
      query = query.whereILike('name', `%${filter.name}%`);
    }

    if (filter.isDefault !== undefined) {
      query = query.where('is_default', filter.isDefault);
    }

    if (filter.createdBy) {
      query = query.where('created_by', filter.createdBy);
    }

    if (filter.createdAfter) {
      query = query.where('created_at', '>=', filter.createdAfter);
    }

    if (filter.createdBefore) {
      query = query.where('created_at', '<=', filter.createdBefore);
    }

    if (filter.updatedAfter) {
      query = query.where('updated_at', '>=', filter.updatedAfter);
    }

    if (filter.updatedBefore) {
      query = query.where('updated_at', '<=', filter.updatedBefore);
    }

    return query;
  }

  /**
   * Private helper: Map database record to Canvas interface
   */
  private mapDbCanvasToCanvas(dbCanvas: any): Canvas {
    return {
      id: dbCanvas.id,
      workspaceId: dbCanvas.workspace_id,
      name: dbCanvas.name,
      description: dbCanvas.description,
      isDefault: Boolean(dbCanvas.is_default),
      position: dbCanvas.position || 0,
      createdBy: dbCanvas.created_by,
      createdAt: new Date(dbCanvas.created_at),
      updatedAt: new Date(dbCanvas.updated_at),
    };
  }
}
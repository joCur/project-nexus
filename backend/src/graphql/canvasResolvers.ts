import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { CanvasService } from '@/services/canvas';
import { CardService } from '@/services/CardService';
import { ConnectionService as _ConnectionService } from '@/services/ConnectionService';
import { 
  Canvas,
  CreateCanvasInput,
  UpdateCanvasInput,
  CanvasStats,
  CanvasFilter,
  DuplicateCanvasOptions
} from '@/types/canvas';
import { 
  SubscriptionService as _SubscriptionService, 
  pubSub 
} from '@/services/subscriptionService';
import { withFilter } from 'graphql-subscriptions';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';

/**
 * GraphQL resolvers for Canvas management operations (NEX-174)
 * Implements comprehensive canvas CRUD with real-time updates and authorization
 */

const logger = createContextLogger({ service: 'CanvasResolvers' });

// Canvas event names for subscriptions
export const CANVAS_EVENTS = {
  CANVAS_CREATED: 'CANVAS_CREATED',
  CANVAS_UPDATED: 'CANVAS_UPDATED',
  CANVAS_DELETED: 'CANVAS_DELETED',
} as const;

export const canvasResolvers = {
  Query: {
    /**
     * Get canvas by ID
     */
    canvas: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<Canvas | null> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const canvasService = new CanvasService();
        const canvas = await canvasService.getCanvasById(id);

        if (!canvas) {
          return null;
        }

        // Authorization check - users can only access canvases in workspaces they have access to
        const authService = new WorkspaceAuthorizationService();
        const hasAccess = await authService.hasWorkspaceAccess(
          context.user!.id,
          canvas.workspaceId,
          'canvas:read'
        );
        
        if (!hasAccess) {
          throw new AuthorizationError(
            'Cannot access canvases in workspaces you do not have access to',
            'WORKSPACE_ACCESS_DENIED',
            'canvas:read',
            []
          );
        }

        logger.info('Canvas retrieved via GraphQL', {
          canvasId: id,
          workspaceId: canvas.workspaceId,
          userId: context.user?.id,
        });

        return canvas;

      } catch (error) {
        logger.error('Failed to get canvas via GraphQL', {
          canvasId: id,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get canvases for a workspace with filtering and pagination
     */
    workspaceCanvases: async (
      _: any,
      { 
        workspaceId, 
        filter, 
        pagination 
      }: { 
        workspaceId: string; 
        filter?: CanvasFilter; 
        pagination?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC' } 
      },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - verify workspace access
        const authService = new WorkspaceAuthorizationService();
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'canvas:read',
          'Cannot access canvases in this workspace'
        );

        const canvasService = new CanvasService();
        const page = pagination?.page || 1;
        const limit = Math.min(pagination?.limit || 20, 100); // Cap at 100
        const offset = (page - 1) * limit;

        const { canvases, totalCount } = await canvasService.getCanvasesByWorkspace(
          workspaceId,
          filter,
          limit,
          offset
        );

        const totalPages = Math.ceil(totalCount / limit);

        logger.info('Canvases retrieved via GraphQL', {
          workspaceId,
          userId: context.user?.id,
          totalCount,
          page,
          limit,
          filterApplied: !!filter,
        });

        return {
          items: canvases,
          totalCount,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        };

      } catch (error) {
        logger.error('Failed to get workspace canvases via GraphQL', {
          workspaceId,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get default canvas for workspace
     */
    defaultCanvas: async (
      _: any,
      { workspaceId }: { workspaceId: string },
      context: GraphQLContext
    ): Promise<Canvas | null> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - verify workspace access
        const authService = new WorkspaceAuthorizationService();
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'canvas:read',
          'Cannot access canvases in this workspace'
        );

        const canvasService = new CanvasService();
        const canvas = await canvasService.getDefaultCanvas(workspaceId);

        logger.info('Default canvas retrieved via GraphQL', {
          workspaceId,
          canvasId: canvas?.id,
          userId: context.user?.id,
        });

        return canvas;

      } catch (error) {
        logger.error('Failed to get default canvas via GraphQL', {
          workspaceId,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  Mutation: {
    /**
     * Create new canvas
     */
    createCanvas: async (
      _: any,
      { input }: { input: CreateCanvasInput },
      context: GraphQLContext
    ): Promise<Canvas> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - verify workspace access for canvas creation
        const authService = new WorkspaceAuthorizationService();
        await authService.requirePermission(
          context.user!.id,
          input.workspaceId,
          'canvas:create',
          'Cannot create canvases in this workspace'
        );

        const canvasService = new CanvasService();
        const canvas = await canvasService.createCanvas(input, context.user!.id);

        // Publish real-time event
        await pubSub.publish(CANVAS_EVENTS.CANVAS_CREATED, {
          canvasCreated: canvas,
          workspaceId: canvas.workspaceId,
        });

        logger.info('Canvas created via GraphQL', {
          canvasId: canvas.id,
          workspaceId: input.workspaceId,
          name: canvas.name,
          isDefault: canvas.isDefault,
          userId: context.user!.id,
        });

        return canvas;

      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }

        logger.error('Failed to create canvas via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update existing canvas
     */
    updateCanvas: async (
      _: any,
      { id, input }: { id: string; input: UpdateCanvasInput },
      context: GraphQLContext
    ): Promise<Canvas> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const canvasService = new CanvasService();
        
        // Check if canvas exists and get workspace ID for authorization
        const existingCanvas = await canvasService.getCanvasById(id);
        if (!existingCanvas) {
          throw new NotFoundError('Canvas', id);
        }

        // Authorization check - verify workspace access for canvas updates
        const authService = new WorkspaceAuthorizationService();
        await authService.requirePermission(
          context.user!.id,
          existingCanvas.workspaceId,
          'canvas:update',
          'Cannot update canvases in this workspace'
        );

        const updatedCanvas = await canvasService.updateCanvas(id, input, context.user!.id);

        // Publish real-time event
        await pubSub.publish(CANVAS_EVENTS.CANVAS_UPDATED, {
          canvasUpdated: updatedCanvas,
          workspaceId: updatedCanvas.workspaceId,
        });

        logger.info('Canvas updated via GraphQL', {
          canvasId: id,
          userId: context.user!.id,
          updatedFields: Object.keys(input),
        });

        return updatedCanvas;

      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          throw error;
        }

        logger.error('Failed to update canvas via GraphQL', {
          canvasId: id,
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Delete canvas
     */
    deleteCanvas: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const canvasService = new CanvasService();
        
        // Check if canvas exists and get workspace ID for authorization
        const existingCanvas = await canvasService.getCanvasById(id);
        if (!existingCanvas) {
          throw new NotFoundError('Canvas', id);
        }

        // Authorization check - verify workspace access for canvas deletion
        const authService = new WorkspaceAuthorizationService();
        await authService.requirePermission(
          context.user!.id,
          existingCanvas.workspaceId,
          'canvas:delete',
          'Cannot delete canvases in this workspace'
        );

        const success = await canvasService.deleteCanvas(id, context.user!.id);

        if (success) {
          // Publish real-time event
          await pubSub.publish(CANVAS_EVENTS.CANVAS_DELETED, {
            canvasDeleted: id,
            workspaceId: existingCanvas.workspaceId,
          });
        }

        logger.info('Canvas deleted via GraphQL', {
          canvasId: id,
          workspaceId: existingCanvas.workspaceId,
          userId: context.user!.id,
          success,
        });

        return success;

      } catch (error) {
        if (error instanceof NotFoundError) {
          throw error;
        }

        logger.error('Failed to delete canvas via GraphQL', {
          canvasId: id,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },

    /**
     * Set canvas as default
     */
    setDefaultCanvas: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<Canvas> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const canvasService = new CanvasService();
        const updatedCanvas = await canvasService.setDefaultCanvas(id, context.user!.id);

        // Publish real-time event
        await pubSub.publish(CANVAS_EVENTS.CANVAS_UPDATED, {
          canvasUpdated: updatedCanvas,
          workspaceId: updatedCanvas.workspaceId,
        });

        logger.info('Canvas set as default via GraphQL', {
          canvasId: id,
          workspaceId: updatedCanvas.workspaceId,
          userId: context.user!.id,
        });

        return updatedCanvas;

      } catch (error) {
        logger.error('Failed to set default canvas via GraphQL', {
          canvasId: id,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Duplicate canvas
     */
    duplicateCanvas: async (
      _: any,
      { id, input }: { id: string; input: DuplicateCanvasOptions },
      context: GraphQLContext
    ): Promise<Canvas> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const canvasService = new CanvasService();
        const duplicatedCanvas = await canvasService.duplicateCanvas(
          id, 
          input, 
          context.user!.id
        );

        // Publish real-time event
        await pubSub.publish(CANVAS_EVENTS.CANVAS_CREATED, {
          canvasCreated: duplicatedCanvas,
          workspaceId: duplicatedCanvas.workspaceId,
        });

        logger.info('Canvas duplicated via GraphQL', {
          sourceCanvasId: id,
          duplicatedCanvasId: duplicatedCanvas.id,
          workspaceId: duplicatedCanvas.workspaceId,
          userId: context.user!.id,
        });

        return duplicatedCanvas;

      } catch (error) {
        logger.error('Failed to duplicate canvas via GraphQL', {
          sourceCanvasId: id,
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  Subscription: {
    /**
     * Subscribe to canvas created events in a workspace
     */
    canvasCreated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CANVAS_EVENTS.CANVAS_CREATED]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const authService = new WorkspaceAuthorizationService();
          const hasAccess = await authService.hasWorkspaceAccess(
            context.user!.id,
            variables.workspaceId,
            'canvas:read'
          );

          return hasAccess && payload.workspaceId === variables.workspaceId;
        }
      ),
    },

    /**
     * Subscribe to canvas updated events in a workspace
     */
    canvasUpdated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CANVAS_EVENTS.CANVAS_UPDATED]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const authService = new WorkspaceAuthorizationService();
          const hasAccess = await authService.hasWorkspaceAccess(
            context.user!.id,
            variables.workspaceId,
            'canvas:read'
          );

          return hasAccess && payload.workspaceId === variables.workspaceId;
        }
      ),
    },

    /**
     * Subscribe to canvas deleted events in a workspace
     */
    canvasDeleted: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CANVAS_EVENTS.CANVAS_DELETED]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const authService = new WorkspaceAuthorizationService();
          const hasAccess = await authService.hasWorkspaceAccess(
            context.user!.id,
            variables.workspaceId,
            'canvas:read'
          );

          return hasAccess && payload.workspaceId === variables.workspaceId;
        }
      ),
    },
  },

  // Field resolvers for Canvas type
  Canvas: {
    /**
     * Resolve workspace for Canvas type
     */
    workspace: async (canvas: Canvas, _: any, context: GraphQLContext) => {
      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getWorkspaceById(canvas.workspaceId);
    },

    /**
     * Resolve creator (createdBy) for Canvas type
     */
    createdByUser: async (canvas: Canvas, _: any, context: GraphQLContext) => {
      const userService = context.dataSources.userService;
      return await userService.findById(canvas.createdBy);
    },

    /**
     * Resolve card count for Canvas type
     */
    cardCount: async (canvas: Canvas, _: any, context: GraphQLContext): Promise<number> => {
      try {
        const canvasService = new CanvasService();
        const stats = await canvasService.getCanvasStatistics(canvas.id, context.user!.id);
        return stats.cardCount;
      } catch (error) {
        logger.error('Failed to resolve card count for canvas', {
          canvasId: canvas.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return 0;
      }
    },

    /**
     * Resolve connection count for Canvas type
     */
    connectionCount: async (canvas: Canvas, _: any, context: GraphQLContext): Promise<number> => {
      try {
        const canvasService = new CanvasService();
        const stats = await canvasService.getCanvasStatistics(canvas.id, context.user!.id);
        return stats.connectionCount;
      } catch (error) {
        logger.error('Failed to resolve connection count for canvas', {
          canvasId: canvas.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return 0;
      }
    },

    /**
     * Resolve cards for Canvas type
     */
    cards: async (canvas: Canvas, _: any, _context: GraphQLContext) => {
      try {
        const cardService = new CardService();
        const { cards } = await cardService.getCanvasCards(canvas.id, {}, 1000); // Large limit for field resolver
        return cards;
      } catch (error) {
        logger.error('Failed to resolve cards for canvas', {
          canvasId: canvas.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
    },

    /**
     * Resolve connections for Canvas type
     */
    connections: async (canvas: Canvas, _: any, _context: GraphQLContext) => {
      // TODO: Implement canvas-specific connection resolution
      // For now, return empty array as this field is not actively used
      logger.debug('Canvas connections resolver called', { canvasId: canvas.id });
      return [];
    },

    /**
     * Resolve stats for Canvas type
     */
    stats: async (canvas: Canvas, _: any, context: GraphQLContext): Promise<CanvasStats> => {
      try {
        const canvasService = new CanvasService();
        return await canvasService.getCanvasStatistics(canvas.id, context.user!.id);
      } catch (error) {
        logger.error('Failed to resolve stats for canvas', {
          canvasId: canvas.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Return default stats if error
        return {
          id: canvas.id,
          name: canvas.name,
          cardCount: 0,
          connectionCount: 0,
          createdAt: canvas.createdAt,
        };
      }
    },
  },
};
import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { CardService } from '@/services/CardService';
import { 
  Card, 
  CreateCardInput, 
  UpdateCardInput, 
  CardFilter,
  CardPositionUpdate 
} from '@/types/CardTypes';
import { 
  SubscriptionService, 
  CARD_EVENTS, 
  WORKSPACE_EVENTS, 
  pubSub 
} from '@/services/subscriptionService';
import { withFilter } from 'graphql-subscriptions';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';

/**
 * GraphQL resolvers for card management operations
 * Implements comprehensive card CRUD with real-time updates and batch operations
 * Aligns with frontend CardActions interface expectations (NEX-94)
 */

const logger = createContextLogger({ service: 'CardResolvers' });

export const cardResolvers = {
  Query: {
    /**
     * Get single card by ID
     * Aligns with frontend CardActions.getCard()
     */
    card: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<Card | null> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const cardService = new CardService();
        const card = await cardService.getCard(id);

        if (!card) {
          return null;
        }

        // Authorization check - users can only access cards in workspaces they have access to
        const authService = context.dataSources.workspaceAuthorizationService;
        const hasAccess = await authService.hasWorkspaceAccess(
          context.user!.id,
          card.workspaceId,
          'card:read'
        );
        
        if (!hasAccess) {
          throw new AuthorizationError(
            'Cannot access cards in workspaces you do not have access to',
            'WORKSPACE_ACCESS_DENIED',
            'card:read',
            []
          );
        }

        logger.info('Card retrieved via GraphQL', {
          cardId: id,
          workspaceId: card.workspaceId,
          userId: context.user?.id,
        });

        return card;

      } catch (error) {
        logger.error('Failed to get card via GraphQL', {
          cardId: id,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get cards with filtering and pagination
     * Supports both workspace-scoped and canvas-scoped queries
     * Aligns with frontend CardActions.getCards()
     */
    cards: async (
      _: any,
      { 
        workspaceId, 
        canvasId,
        filter, 
        pagination 
      }: { 
        workspaceId: string; 
        canvasId?: string;
        filter?: CardFilter; 
        pagination?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC' } 
      },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - verify workspace access
        const authService = context.dataSources.workspaceAuthorizationService;
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'card:read',
          'Cannot access cards in this workspace'
        );

        const cardService = new CardService();
        const page = pagination?.page || 1;
        const limit = Math.min(pagination?.limit || 20, 100); // Cap at 100
        const offset = (page - 1) * limit;

        // Use canvas-scoped or workspace-scoped query based on canvasId parameter
        const { cards, totalCount } = canvasId 
          ? await cardService.getCanvasCards(canvasId, filter, limit, offset)
          : await cardService.getWorkspaceCards(workspaceId, filter, limit, offset);

        const totalPages = Math.ceil(totalCount / limit);

        logger.info('Cards retrieved via GraphQL', {
          workspaceId,
          canvasId,
          userId: context.user?.id,
          totalCount,
          page,
          limit,
          filterApplied: !!filter,
          scopeType: canvasId ? 'canvas' : 'workspace',
        });

        return {
          items: cards,
          totalCount,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        };

      } catch (error) {
        logger.error('Failed to get cards via GraphQL', {
          workspaceId,
          canvasId,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Search cards by text query
     * Aligns with frontend CardActions.searchCards()
     */
    searchCards: async (
      _: any,
      { 
        workspaceId, 
        query, 
        limit = 20 
      }: { 
        workspaceId: string; 
        query: string; 
        limit?: number 
      },
      context: GraphQLContext
    ): Promise<Card[]> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - verify workspace access
        const authService = context.dataSources.workspaceAuthorizationService;
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'card:read',
          'Cannot search cards in this workspace'
        );

        const cardService = new CardService();
        const searchLimit = Math.min(limit, 50); // Cap search results
        const cards = await cardService.searchCards(workspaceId, query, searchLimit);

        logger.info('Card search completed via GraphQL', {
          workspaceId,
          query,
          userId: context.user?.id,
          resultCount: cards.length,
        });

        return cards;

      } catch (error) {
        logger.error('Failed to search cards via GraphQL', {
          workspaceId,
          query,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get cards within specific canvas bounds
     * For viewport-based card loading optimization
     */
    cardsInBounds: async (
      _: any,
      { 
        workspaceId, 
        bounds 
      }: { 
        workspaceId: string; 
        bounds: { minX: number; minY: number; maxX: number; maxY: number } 
      },
      context: GraphQLContext
    ): Promise<Card[]> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - verify workspace access
        const authService = context.dataSources.workspaceAuthorizationService;
        await authService.requirePermission(
          context.user!.id,
          workspaceId,
          'card:read',
          'Cannot access cards in this workspace'
        );

        const cardService = new CardService();
        const filter: CardFilter = {
          boundingBox: bounds,
        };

        const { cards } = await cardService.getWorkspaceCards(workspaceId, filter, 1000); // Large limit for bounds query

        logger.info('Cards in bounds retrieved via GraphQL', {
          workspaceId,
          bounds,
          userId: context.user?.id,
          cardCount: cards.length,
        });

        return cards;

      } catch (error) {
        logger.error('Failed to get cards in bounds via GraphQL', {
          workspaceId,
          bounds,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  Mutation: {
    /**
     * Create new card
     * Aligns with frontend CardActions.createCard()
     */
    createCard: async (
      _: any,
      { input }: { input: CreateCardInput },
      context: GraphQLContext
    ): Promise<Card> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - verify workspace access for card creation
        const authService = context.dataSources.workspaceAuthorizationService;
        await authService.requirePermission(
          context.user!.id,
          input.workspaceId,
          'card:create',
          'Cannot create cards in this workspace'
        );

        const cardService = new CardService();
        const card = await cardService.createCard(input, context.user!.id);

        // Publish real-time event
        await SubscriptionService.publishCardCreated(card);

        logger.info('Card created via GraphQL', {
          cardId: card.id,
          workspaceId: input.workspaceId,
          type: card.type,
          userId: context.user!.id,
        });

        return card;

      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }

        logger.error('Failed to create card via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update existing card
     * Aligns with frontend CardActions.updateCard()
     */
    updateCard: async (
      _: any,
      { id, input }: { id: string; input: UpdateCardInput },
      context: GraphQLContext
    ): Promise<Card> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const cardService = new CardService();
        
        // Check if card exists and user has permission
        const existingCard = await cardService.getCard(id);
        if (!existingCard) {
          throw new NotFoundError('Card', id);
        }

        // Authorization check - verify workspace access for card updates
        const authService = context.dataSources.workspaceAuthorizationService;
        await authService.requirePermission(
          context.user!.id,
          existingCard.workspaceId,
          'card:update',
          'Cannot update cards in this workspace'
        );

        const updatedCard = await cardService.updateCard(id, input, context.user!.id);

        // Publish real-time event
        await SubscriptionService.publishCardUpdated(updatedCard);

        logger.info('Card updated via GraphQL', {
          cardId: id,
          userId: context.user!.id,
          updatedFields: Object.keys(input),
          newVersion: updatedCard.version,
        });

        return updatedCard;

      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          throw error;
        }

        logger.error('Failed to update card via GraphQL', {
          cardId: id,
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Delete card (soft delete)
     * Aligns with frontend CardActions.deleteCard()
     */
    deleteCard: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const cardService = new CardService();
        
        // Check if card exists and user has permission
        const existingCard = await cardService.getCard(id);
        if (!existingCard) {
          throw new NotFoundError('Card', id);
        }

        // Authorization check - verify workspace access for card deletion
        const authService = context.dataSources.workspaceAuthorizationService;
        await authService.requirePermission(
          context.user!.id,
          existingCard.workspaceId,
          'card:delete',
          'Cannot delete cards in this workspace'
        );

        const success = await cardService.deleteCard(id, context.user!.id);

        if (success) {
          // Publish real-time event
          await SubscriptionService.publishCardDeleted(id, existingCard.workspaceId);
        }

        logger.info('Card deleted via GraphQL', {
          cardId: id,
          userId: context.user!.id,
          success,
        });

        return success;

      } catch (error) {
        if (error instanceof NotFoundError) {
          throw error;
        }

        logger.error('Failed to delete card via GraphQL', {
          cardId: id,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },

    /**
     * Batch update card positions for performance
     * Aligns with frontend bulk move operations
     */
    batchUpdateCardPositions: async (
      _: any,
      { updates }: { updates: CardPositionUpdate[] },
      context: GraphQLContext
    ): Promise<Card[]> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Validate that user owns all cards being updated
        const cardService = new CardService();
        const cardIds = updates.map(update => update.cardId);
        const cards = await cardService.getCardsByIds(cardIds);

        // Get unique workspace IDs from the cards
        const workspaceIds = [...new Set(cards.map(card => card.workspaceId))];
        
        // Check authorization for all workspaces
        const authService = context.dataSources.workspaceAuthorizationService;
        for (const workspaceId of workspaceIds) {
          await authService.requirePermission(
            context.user!.id,
            workspaceId,
            'card:update',
            'Cannot update cards in this workspace'
          );
        }

        const result = await cardService.batchUpdatePositions(updates);

        if (result.successful.length > 0) {
          // Publish real-time event for successful updates
          const workspaceId = result.successful[0].workspaceId;
          await SubscriptionService.publishCardsBatchUpdated(result.successful, workspaceId);
        }

        logger.info('Batch position update completed via GraphQL', {
          userId: context.user!.id,
          totalUpdates: updates.length,
          successful: result.successful.length,
          failed: result.failed.length,
          processingTimeMs: result.processingTimeMs,
        });

        if (result.failed.length > 0) {
          logger.warn('Some position updates failed', {
            userId: context.user!.id,
            failedUpdates: result.failed,
          });
        }

        return result.successful;

      } catch (error) {
        logger.error('Failed to batch update positions via GraphQL', {
          updates,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Duplicate existing card
     * Aligns with frontend CardActions.duplicateCard()
     */
    duplicateCard: async (
      _: any,
      { id, offset }: { id: string; offset?: { x: number; y: number } },
      context: GraphQLContext
    ): Promise<Card> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const cardService = new CardService();
        
        // Get the original card
        const originalCard = await cardService.getCard(id);
        if (!originalCard) {
          throw new NotFoundError('Card', id);
        }

        // Authorization check - verify workspace access for card creation
        const authService = context.dataSources.workspaceAuthorizationService;
        await authService.requirePermission(
          context.user!.id,
          originalCard.workspaceId,
          'card:create',
          'Cannot duplicate cards in this workspace'
        );

        // Create duplicate with offset position
        const duplicateInput: CreateCardInput = {
          workspaceId: originalCard.workspaceId,
          type: originalCard.type,
          title: originalCard.title ? `${originalCard.title} (Copy)` : undefined,
          content: originalCard.content,
          position: {
            x: originalCard.position.x + (offset?.x || 20),
            y: originalCard.position.y + (offset?.y || 20),
            z: originalCard.position.z,
          },
          dimensions: originalCard.dimensions,
          metadata: originalCard.metadata,
          tags: [...originalCard.tags],
        };

        const duplicatedCard = await cardService.createCard(duplicateInput, context.user!.id);

        // Publish real-time event
        await SubscriptionService.publishCardCreated(duplicatedCard);

        logger.info('Card duplicated via GraphQL', {
          originalCardId: id,
          duplicatedCardId: duplicatedCard.id,
          workspaceId: originalCard.workspaceId,
          userId: context.user!.id,
        });

        return duplicatedCard;

      } catch (error) {
        logger.error('Failed to duplicate card via GraphQL', {
          cardId: id,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  Subscription: {
    /**
     * Subscribe to card created events in a workspace (with optional canvas filtering)
     * Aligns with frontend real-time card store updates
     */
    cardCreated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CARD_EVENTS.CARD_CREATED]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const hasAccess = await SubscriptionService.validateSubscriptionAuth(
            variables.workspaceId,
            context.user!.id,
            context.dataSources.workspaceService
          );

          // Check workspace match
          const workspaceMatch = hasAccess && payload.workspaceId === variables.workspaceId;
          
          // If no canvas filter specified, return workspace match
          if (!variables.canvasId) {
            return workspaceMatch;
          }

          // If canvas filter specified, check canvas match too
          return workspaceMatch && payload.cardCreated?.canvasId === variables.canvasId;
        }
      ),
    },

    /**
     * Subscribe to card updated events in a workspace (with optional canvas filtering)
     * Aligns with frontend real-time card store updates
     */
    cardUpdated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CARD_EVENTS.CARD_UPDATED]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const hasAccess = await SubscriptionService.validateSubscriptionAuth(
            variables.workspaceId,
            context.user!.id,
            context.dataSources.workspaceService
          );

          // Check workspace match
          const workspaceMatch = hasAccess && payload.workspaceId === variables.workspaceId;
          
          // If no canvas filter specified, return workspace match
          if (!variables.canvasId) {
            return workspaceMatch;
          }

          // If canvas filter specified, check canvas match too
          return workspaceMatch && payload.cardUpdated?.canvasId === variables.canvasId;
        }
      ),
    },

    /**
     * Subscribe to card deleted events in a workspace (with optional canvas filtering)
     * Aligns with frontend card store deletion handling
     */
    cardDeleted: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CARD_EVENTS.CARD_DELETED]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const hasAccess = await SubscriptionService.validateSubscriptionAuth(
            variables.workspaceId,
            context.user!.id,
            context.dataSources.workspaceService
          );

          // Check workspace match
          const workspaceMatch = hasAccess && payload.workspaceId === variables.workspaceId;
          
          // If no canvas filter specified, return workspace match
          if (!variables.canvasId) {
            return workspaceMatch;
          }

          // Canvas filtering for deletions is tricky since card may be gone
          // For now, just return workspace match - canvas filtering for deletes
          // should be handled client-side based on which canvas the card was on
          return workspaceMatch;
        }
      ),
    },

    /**
     * Subscribe to card moved events in a workspace (with optional canvas filtering)
     * For position-only updates (performance optimization)
     */
    cardMoved: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CARD_EVENTS.CARD_MOVED]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const hasAccess = await SubscriptionService.validateSubscriptionAuth(
            variables.workspaceId,
            context.user!.id,
            context.dataSources.workspaceService
          );

          // Check workspace match
          const workspaceMatch = hasAccess && payload.workspaceId === variables.workspaceId;
          
          // If no canvas filter specified, return workspace match
          if (!variables.canvasId) {
            return workspaceMatch;
          }

          // If canvas filter specified, check canvas match too
          return workspaceMatch && payload.cardMoved?.canvasId === variables.canvasId;
        }
      ),
    },

    /**
     * Subscribe to user joining canvas events
     * For collaborative editing awareness
     */
    userJoinedCanvas: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([WORKSPACE_EVENTS.USER_JOINED_CANVAS]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const hasAccess = await SubscriptionService.validateSubscriptionAuth(
            variables.workspaceId,
            context.user!.id,
            context.dataSources.workspaceService
          );

          return hasAccess && payload.workspaceId === variables.workspaceId;
        }
      ),
    },

    /**
     * Subscribe to user leaving canvas events
     * For collaborative editing awareness
     */
    userLeftCanvas: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([WORKSPACE_EVENTS.USER_LEFT_CANVAS]),
        async (payload, variables, context: GraphQLContext) => {
          if (!context.isAuthenticated) {
            return false;
          }

          // Verify user has access to the workspace
          const hasAccess = await SubscriptionService.validateSubscriptionAuth(
            variables.workspaceId,
            context.user!.id,
            context.dataSources.workspaceService
          );

          return hasAccess && payload.workspaceId === variables.workspaceId;
        }
      ),
    },
  },

  // Field resolvers for Card type
  Card: {
    /**
     * Resolve workspace for Card type
     */
    workspace: async (card: Card, _: any, context: GraphQLContext) => {
      const workspaceService = context.dataSources.workspaceService;
      return await workspaceService.getWorkspaceById(card.workspaceId);
    },

    /**
     * Resolve owner (creator) for Card type
     */
    owner: async (card: Card, _: any, context: GraphQLContext) => {
      const userService = context.dataSources.userService;
      return await userService.findById(card.createdBy);
    },
  },
};
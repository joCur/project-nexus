import { PubSub } from 'graphql-subscriptions';
import { createContextLogger } from '@/utils/logger';
import { Card } from '@/types/CardTypes';
import { Connection } from '@/types/ConnectionTypes';

/**
 * Subscription service for real-time GraphQL updates
 * Manages PubSub events for card and workspace updates
 */

const logger = createContextLogger({ service: 'SubscriptionService' });

// Create PubSub instance - in production, use Redis PubSub
export const pubSub = new PubSub<Record<string, unknown>>();

// Event names for card subscriptions
export const CARD_EVENTS = {
  CARD_CREATED: 'CARD_CREATED',
  CARD_UPDATED: 'CARD_UPDATED', 
  CARD_DELETED: 'CARD_DELETED',
  CARD_MOVED: 'CARD_MOVED',
  CARDS_BATCH_UPDATED: 'CARDS_BATCH_UPDATED',
} as const;

// Event names for connection subscriptions
export const CONNECTION_EVENTS = {
  CONNECTION_CREATED: 'CONNECTION_CREATED',
  CONNECTION_UPDATED: 'CONNECTION_UPDATED',
  CONNECTION_DELETED: 'CONNECTION_DELETED',
} as const;

// Event names for canvas subscriptions
export const CANVAS_EVENTS = {
  CANVAS_CREATED: 'CANVAS_CREATED',
  CANVAS_UPDATED: 'CANVAS_UPDATED',
  CANVAS_DELETED: 'CANVAS_DELETED',
} as const;

// Event names for workspace subscriptions
export const WORKSPACE_EVENTS = {
  USER_JOINED_CANVAS: 'USER_JOINED_CANVAS',
  USER_LEFT_CANVAS: 'USER_LEFT_CANVAS',
  CURSOR_POSITION_UPDATED: 'CURSOR_POSITION_UPDATED',
} as const;

export type CardEventType = typeof CARD_EVENTS[keyof typeof CARD_EVENTS];
export type ConnectionEventType = typeof CONNECTION_EVENTS[keyof typeof CONNECTION_EVENTS];
export type CanvasEventType = typeof CANVAS_EVENTS[keyof typeof CANVAS_EVENTS];
export type WorkspaceEventType = typeof WORKSPACE_EVENTS[keyof typeof WORKSPACE_EVENTS];

/**
 * Subscription service class for managing real-time events
 */
export class SubscriptionService {
  /**
   * Publish card created event
   */
  static async publishCardCreated(card: Card): Promise<void> {
    try {
      await pubSub.publish(CARD_EVENTS.CARD_CREATED, {
        cardCreated: card,
        workspaceId: card.workspaceId,
      });

      logger.info('Card created event published', {
        cardId: card.id,
        workspaceId: card.workspaceId,
        type: card.type,
      });
    } catch (error) {
      logger.error('Failed to publish card created event', {
        cardId: card.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish card updated event
   */
  static async publishCardUpdated(card: Card): Promise<void> {
    try {
      await pubSub.publish(CARD_EVENTS.CARD_UPDATED, {
        cardUpdated: card,
        workspaceId: card.workspaceId,
      });

      logger.info('Card updated event published', {
        cardId: card.id,
        workspaceId: card.workspaceId,
        version: card.version,
      });
    } catch (error) {
      logger.error('Failed to publish card updated event', {
        cardId: card.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish card deleted event
   */
  static async publishCardDeleted(cardId: string, workspaceId: string): Promise<void> {
    try {
      await pubSub.publish(CARD_EVENTS.CARD_DELETED, {
        cardDeleted: cardId,
        workspaceId,
      });

      logger.info('Card deleted event published', {
        cardId,
        workspaceId,
      });
    } catch (error) {
      logger.error('Failed to publish card deleted event', {
        cardId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish card moved event (for position-only updates)
   */
  static async publishCardMoved(card: Card): Promise<void> {
    try {
      await pubSub.publish(CARD_EVENTS.CARD_MOVED, {
        cardMoved: card,
        workspaceId: card.workspaceId,
      });

      logger.info('Card moved event published', {
        cardId: card.id,
        workspaceId: card.workspaceId,
        position: card.position,
      });
    } catch (error) {
      logger.error('Failed to publish card moved event', {
        cardId: card.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish batch cards updated event
   */
  static async publishCardsBatchUpdated(cards: Card[], workspaceId: string): Promise<void> {
    try {
      await pubSub.publish(CARD_EVENTS.CARDS_BATCH_UPDATED, {
        cardsBatchUpdated: cards,
        workspaceId,
      });

      logger.info('Cards batch updated event published', {
        cardCount: cards.length,
        workspaceId,
      });
    } catch (error) {
      logger.error('Failed to publish cards batch updated event', {
        cardCount: cards.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish connection created event
   */
  static async publishConnectionCreated(connection: Connection): Promise<void> {
    try {
      // We need to determine workspace ID from the connection's cards
      // This is a simplified approach - in practice, you'd get the workspace ID from the card
      await pubSub.publish(CONNECTION_EVENTS.CONNECTION_CREATED, {
        connectionCreated: connection,
        // Note: workspaceId should be passed separately or derived from the connection's cards
      });

      logger.info('Connection created event published', {
        connectionId: connection.id,
        sourceCardId: connection.sourceCardId,
        targetCardId: connection.targetCardId,
        type: connection.type,
      });
    } catch (error) {
      logger.error('Failed to publish connection created event', {
        connectionId: connection.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish connection updated event
   */
  static async publishConnectionUpdated(connection: Connection): Promise<void> {
    try {
      await pubSub.publish(CONNECTION_EVENTS.CONNECTION_UPDATED, {
        connectionUpdated: connection,
      });

      logger.info('Connection updated event published', {
        connectionId: connection.id,
        sourceCardId: connection.sourceCardId,
        targetCardId: connection.targetCardId,
      });
    } catch (error) {
      logger.error('Failed to publish connection updated event', {
        connectionId: connection.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish connection deleted event
   */
  static async publishConnectionDeleted(connectionId: string, workspaceId: string): Promise<void> {
    try {
      await pubSub.publish(CONNECTION_EVENTS.CONNECTION_DELETED, {
        connectionDeleted: connectionId,
        workspaceId,
      });

      logger.info('Connection deleted event published', {
        connectionId,
        workspaceId,
      });
    } catch (error) {
      logger.error('Failed to publish connection deleted event', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish user joined canvas event
   */
  static async publishUserJoinedCanvas(userId: string, workspaceId: string): Promise<void> {
    try {
      await pubSub.publish(WORKSPACE_EVENTS.USER_JOINED_CANVAS, {
        userJoinedCanvas: { userId },
        workspaceId,
      });

      logger.info('User joined canvas event published', {
        userId,
        workspaceId,
      });
    } catch (error) {
      logger.error('Failed to publish user joined canvas event', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish user left canvas event
   */
  static async publishUserLeftCanvas(userId: string, workspaceId: string): Promise<void> {
    try {
      await pubSub.publish(WORKSPACE_EVENTS.USER_LEFT_CANVAS, {
        userLeftCanvas: userId,
        workspaceId,
      });

      logger.info('User left canvas event published', {
        userId,
        workspaceId,
      });
    } catch (error) {
      logger.error('Failed to publish user left canvas event', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish canvas created event
   */
  static async publishCanvasCreated(canvas: any): Promise<void> {
    try {
      await pubSub.publish(CANVAS_EVENTS.CANVAS_CREATED, {
        canvasCreated: canvas,
        workspaceId: canvas.workspaceId,
      });

      logger.info('Canvas created event published', {
        canvasId: canvas.id,
        workspaceId: canvas.workspaceId,
        name: canvas.name,
      });
    } catch (error) {
      logger.error('Failed to publish canvas created event', {
        canvasId: canvas.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish canvas updated event
   */
  static async publishCanvasUpdated(canvas: any): Promise<void> {
    try {
      await pubSub.publish(CANVAS_EVENTS.CANVAS_UPDATED, {
        canvasUpdated: canvas,
        workspaceId: canvas.workspaceId,
      });

      logger.info('Canvas updated event published', {
        canvasId: canvas.id,
        workspaceId: canvas.workspaceId,
        name: canvas.name,
      });
    } catch (error) {
      logger.error('Failed to publish canvas updated event', {
        canvasId: canvas.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Publish canvas deleted event
   */
  static async publishCanvasDeleted(canvasId: string, workspaceId: string): Promise<void> {
    try {
      await pubSub.publish(CANVAS_EVENTS.CANVAS_DELETED, {
        canvasDeleted: canvasId,
        workspaceId,
      });

      logger.info('Canvas deleted event published', {
        canvasId,
        workspaceId,
      });
    } catch (error) {
      logger.error('Failed to publish canvas deleted event', {
        canvasId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create workspace-specific subscription filter
   * Ensures users only receive events for workspaces they have access to
   */
  static createWorkspaceFilter(workspaceId: string) {
    return {
      workspaceId: {
        equals: workspaceId,
      },
    };
  }

  /**
   * Validate subscription authorization
   * Ensures user has access to the workspace before subscribing
   */
  static async validateSubscriptionAuth(
    workspaceId: string, 
    userId: string,
    workspaceService: any
  ): Promise<boolean> {
    try {
      const workspace = await workspaceService.getWorkspaceById(workspaceId);
      return workspace && workspace.ownerId === userId;
    } catch (error) {
      logger.error('Failed to validate subscription authorization', {
        workspaceId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

// Export the pubSub instance for use in resolvers
export { pubSub as default };

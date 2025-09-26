import { database, knex } from '@/database/connection';
import { 
  Card, 
  CreateCardInput, 
  UpdateCardInput, 
  CardFilter,
  CardPositionUpdate,
  BatchCardUpdate,
  ImportCardData,
  CardType as _CardType,
  CardStatus,
  BatchOperationResult
} from '@/types/CardTypes';
import { 
  NotFoundError, 
  ValidationError,
  UniqueConstraintError as _UniqueConstraintError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { CardValidator } from '@/validators/CardValidators';
import { CardMapper, CardGeometry } from '@/utils/CardUtils';
import { z } from 'zod';

/**
 * Card Service - Repository layer for card management
 * Implements card CRUD operations with validation, auto-save, and batch processing
 */

const logger = createContextLogger({ service: 'CardService' });

export class CardService {
  private readonly tableName = 'cards';

  /**
   * Create a new card
   */
  async createCard(input: CreateCardInput, userId: string): Promise<Card> {
    try {
      // Validate input
      const validatedInput = CardValidator.validateCreateCard(input);

      // Determine canvas ID - if not provided, use default canvas for workspace
      let canvasId = validatedInput.canvasId;
      if (!canvasId) {
        // Import CanvasService only when needed to avoid circular imports
        const { CanvasService } = await import('@/services/canvas');
        const canvasService = new CanvasService();
        const defaultCanvas = await canvasService.getDefaultCanvas(validatedInput.workspaceId);
        if (!defaultCanvas) {
          throw new ValidationError('No default canvas found for workspace. Please specify a canvasId.');
        }
        canvasId = defaultCanvas.id;
      }

      // Sanitize content based on card type
      const sanitizedContent = CardValidator.sanitizeContent(
        validatedInput.content, 
        validatedInput.type
      );

      const cardData = {
        workspace_id: validatedInput.workspaceId,
        canvas_id: canvasId,
        type: validatedInput.type,
        title: validatedInput.title,
        content: sanitizedContent,
        position_x: validatedInput.position.x,
        position_y: validatedInput.position.y,
        z_index: validatedInput.position.z,
        width: validatedInput.dimensions.width,
        height: validatedInput.dimensions.height,
        metadata: JSON.stringify(validatedInput.metadata || {}),
        tags: JSON.stringify(validatedInput.tags || []),
        status: CardStatus.ACTIVE,
        version: 1,
        created_by: userId,
        last_modified_by: userId,
        is_dirty: false,
        last_saved_at: new Date(),
      };

      const [dbCard] = await database.query<any[]>(
        knex(this.tableName)
          .insert(cardData)
          .returning('*'),
        'card_create'
      );

      const card = CardMapper.mapDbCardToCard(dbCard);

      logger.info('Card created', {
        cardId: card.id,
        workspaceId: card.workspaceId,
        type: card.type,
        userId,
      });

      return card;

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to create card', {
        workspaceId: input.workspaceId,
        type: input.type,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get card by ID
   */
  async getCard(cardId: string): Promise<Card | null> {
    try {
      const dbCard = await database.query<any>(
        knex(this.tableName)
          .where('id', cardId)
          .where('status', '!=', CardStatus.DELETED)
          .first(),
        'card_get'
      );

      return dbCard ? CardMapper.mapDbCardToCard(dbCard) : null;

    } catch (error) {
      logger.error('Failed to get card', {
        cardId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get multiple cards by IDs
   */
  async getCardsByIds(cardIds: string[]): Promise<Card[]> {
    try {
      const dbCards = await database.query<any[]>(
        knex(this.tableName)
          .whereIn('id', cardIds)
          .where('status', '!=', CardStatus.DELETED),
        'cards_get_by_ids'
      );

      return dbCards.map(dbCard => CardMapper.mapDbCardToCard(dbCard));

    } catch (error) {
      logger.error('Failed to get cards by IDs', {
        cardIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get cards in workspace with optional filtering
   */
  async getWorkspaceCards(
    workspaceId: string, 
    filter?: CardFilter,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ cards: Card[]; totalCount: number }> {
    try {
      let query = knex(this.tableName)
        .where('workspace_id', workspaceId)
        .where('status', '!=', CardStatus.DELETED);

      // Apply filters
      if (filter) {
        query = this.applyFilters(query, filter);
      }

      // Get total count
      const [{ count }] = await database.query<[{ count: string }]>(
        query.clone().count('id as count'),
        'cards_count'
      );

      const totalCount = parseInt(count, 10);

      // Get paginated results
      const dbCards = await database.query<any[]>(
        query
          .orderBy('updated_at', 'desc')
          .limit(limit)
          .offset(offset),
        'cards_list'
      );

      const cards = dbCards.map(dbCard => CardMapper.mapDbCardToCard(dbCard));

      return { cards, totalCount };

    } catch (error) {
      logger.error('Failed to get workspace cards', {
        workspaceId,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get cards in canvas with optional filtering
   */
  async getCanvasCards(
    canvasId: string, 
    filter?: CardFilter,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ cards: Card[]; totalCount: number }> {
    try {
      let query = knex(this.tableName)
        .where('canvas_id', canvasId)
        .where('status', '!=', CardStatus.DELETED);

      // Apply filters
      if (filter) {
        query = this.applyFilters(query, filter);
      }

      // Get total count
      const [{ count }] = await database.query<[{ count: string }]>(
        query.clone().count('id as count'),
        'cards_canvas_count'
      );

      const totalCount = parseInt(count, 10);

      // Get paginated results
      const dbCards = await database.query<any[]>(
        query
          .orderBy('updated_at', 'desc')
          .limit(limit)
          .offset(offset),
        'cards_canvas_list'
      );

      const cards = dbCards.map(dbCard => CardMapper.mapDbCardToCard(dbCard));

      logger.debug('Canvas cards retrieved', {
        canvasId,
        cardCount: cards.length,
        totalCount,
        limit,
        offset,
      });

      return { cards, totalCount };

    } catch (error) {
      logger.error('Failed to get canvas cards', {
        canvasId,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update card
   */
  async updateCard(cardId: string, input: UpdateCardInput, userId: string): Promise<Card> {
    try {
      // Validate input
      const validatedInput = CardValidator.validateUpdateCard(input);

      // Check if card exists
      const existingCard = await this.getCard(cardId);
      if (!existingCard) {
        throw new NotFoundError('Card', cardId);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date(),
        last_modified_by: userId,
        version: existingCard.version + 1,
        is_dirty: true, // Mark as dirty for auto-save
      };

      if (validatedInput.title !== undefined) {
        updateData.title = validatedInput.title;
      }

      if (validatedInput.content !== undefined) {
        updateData.content = CardValidator.sanitizeContent(
          validatedInput.content, 
          existingCard.type
        );
      }

      if (validatedInput.position !== undefined) {
        updateData.position_x = validatedInput.position.x;
        updateData.position_y = validatedInput.position.y;
        updateData.z_index = validatedInput.position.z;
      }

      if (validatedInput.dimensions !== undefined) {
        updateData.width = validatedInput.dimensions.width;
        updateData.height = validatedInput.dimensions.height;
      }

      if (validatedInput.metadata !== undefined) {
        updateData.metadata = JSON.stringify(validatedInput.metadata);
      }

      if (validatedInput.tags !== undefined) {
        updateData.tags = JSON.stringify(validatedInput.tags);
      }

      if (validatedInput.status !== undefined) {
        updateData.status = validatedInput.status;
      }

      const [updatedDbCard] = await database.query<any[]>(
        knex(this.tableName)
          .where('id', cardId)
          .update(updateData)
          .returning('*'),
        'card_update'
      );

      const updatedCard = CardMapper.mapDbCardToCard(updatedDbCard);

      logger.info('Card updated', {
        cardId,
        userId,
        updatedFields: Object.keys(updateData),
        newVersion: updatedCard.version,
      });

      return updatedCard;

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to update card', {
        cardId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Delete card (soft delete by changing status)
   */
  async deleteCard(cardId: string, userId: string): Promise<boolean> {
    try {
      // Check if card exists
      const existingCard = await this.getCard(cardId);
      if (!existingCard) {
        throw new NotFoundError('Card', cardId);
      }

      await database.query(
        knex(this.tableName)
          .where('id', cardId)
          .update({
            status: CardStatus.DELETED,
            updated_at: new Date(),
            last_modified_by: userId,
            version: existingCard.version + 1,
          }),
        'card_delete'
      );

      logger.info('Card deleted', {
        cardId,
        userId,
        newVersion: existingCard.version + 1,
      });

      return true;

    } catch (error) {
      logger.error('Failed to delete card', {
        cardId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Batch update card positions
   */
  async batchUpdatePositions(updates: CardPositionUpdate[]): Promise<BatchOperationResult<Card>> {
    const startTime = Date.now();
    const successful: Card[] = [];
    const failed: Array<{ input: CardPositionUpdate; error: string }> = [];

    try {
      // Validate all updates first
      const validatedUpdates = CardValidator.validateBatchPositionUpdates(updates);

      // Process updates in a transaction
      await database.transaction(async (trx) => {
        for (const update of validatedUpdates) {
          try {
            // Check version for optimistic locking
            const existingCard = await trx(this.tableName)
              .where('id', update.cardId)
              .first();

            if (!existingCard) {
              failed.push({
                input: update,
                error: `Card ${update.cardId} not found`,
              });
              continue;
            }

            if (existingCard.version !== update.version) {
              failed.push({
                input: update,
                error: `Version conflict: expected ${update.version}, got ${existingCard.version}`,
              });
              continue;
            }

            // Update position
            const [updatedDbCard] = await trx(this.tableName)
              .where('id', update.cardId)
              .update({
                position_x: update.position.x,
                position_y: update.position.y,
                z_index: update.position.z,
                updated_at: new Date(),
                version: existingCard.version + 1,
              })
              .returning('*');

            const updatedCard = CardMapper.mapDbCardToCard(updatedDbCard);
            successful.push(updatedCard);

          } catch (error) {
            failed.push({
              input: update,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Batch position update completed', {
        totalProcessed: updates.length,
        successful: successful.length,
        failed: failed.length,
        processingTimeMs,
      });

      return {
        successful,
        failed,
        totalProcessed: updates.length,
        processingTimeMs,
      };

    } catch (error) {
      logger.error('Batch position update failed', {
        updateCount: updates.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Apply filters to query
   */
  private applyFilters(query: any, filter: CardFilter): any {
    if (filter.type) {
      if (Array.isArray(filter.type)) {
        query = query.whereIn('type', filter.type);
      } else {
        query = query.where('type', filter.type);
      }
    }

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        query = query.whereIn('status', filter.status);
      } else {
        query = query.where('status', filter.status);
      }
    }

    if (filter.createdBy) {
      query = query.where('created_by', filter.createdBy);
    }

    if (filter.lastModifiedBy) {
      query = query.where('last_modified_by', filter.lastModifiedBy);
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

    if (filter.searchTerm) {
      query = query.where(function() {
        this.whereILike('title', `%${filter.searchTerm}%`)
            .orWhereILike('content', `%${filter.searchTerm}%`);
      });
    }

    if (filter.tags && filter.tags.length > 0) {
      // PostgreSQL JSON array contains any of the specified tags
      query = query.whereRaw(
        'tags ?| array[?]',
        [filter.tags]
      );
    }

    if (filter.boundingBox) {
      const { minX, minY, maxX, maxY } = filter.boundingBox;
      query = query
        .where('position_x', '>=', minX)
        .where('position_x', '<=', maxX)
        .where('position_y', '>=', minY)
        .where('position_y', '<=', maxY);
    }

    return query;
  }

  /**
   * Batch update multiple cards
   */
  async batchUpdateCards(updates: BatchCardUpdate[], userId: string): Promise<BatchOperationResult<Card>> {
    const startTime = Date.now();
    const successful: Card[] = [];
    const failed: Array<{ input: BatchCardUpdate; error: string }> = [];

    try {
      // Validate all updates first
      const validatedUpdates = CardValidator.validateBatchCardUpdates(updates);

      // Process updates in a transaction
      await database.transaction(async (trx) => {
        for (const update of validatedUpdates) {
          try {
            // Check version for optimistic locking
            const existingCard = await trx(this.tableName)
              .where('id', update.cardId)
              .first();

            if (!existingCard) {
              failed.push({
                input: update,
                error: `Card ${update.cardId} not found`,
              });
              continue;
            }

            if (existingCard.version !== update.version) {
              failed.push({
                input: update,
                error: `Version conflict: expected ${update.version}, got ${existingCard.version}`,
              });
              continue;
            }

            // Prepare update data
            const updateData: any = {
              updated_at: new Date(),
              last_modified_by: userId,
              version: existingCard.version + 1,
              is_dirty: true,
            };

            const input = update.updates;

            if (input.title !== undefined) {
              updateData.title = input.title;
            }

            if (input.content !== undefined) {
              updateData.content = CardValidator.sanitizeContent(
                input.content, 
                existingCard.type
              );
            }

            if (input.position !== undefined) {
              updateData.position_x = input.position.x;
              updateData.position_y = input.position.y;
              updateData.z_index = input.position.z;
            }

            if (input.dimensions !== undefined) {
              updateData.width = input.dimensions.width;
              updateData.height = input.dimensions.height;
            }

            if (input.metadata !== undefined) {
              updateData.metadata = JSON.stringify(input.metadata);
            }

            if (input.tags !== undefined) {
              updateData.tags = JSON.stringify(input.tags);
            }

            if (input.status !== undefined) {
              updateData.status = input.status;
            }

            // Update card
            const [updatedDbCard] = await trx(this.tableName)
              .where('id', update.cardId)
              .update(updateData)
              .returning('*');

            const updatedCard = CardMapper.mapDbCardToCard(updatedDbCard);
            successful.push(updatedCard);

          } catch (error) {
            failed.push({
              input: update,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Batch card update completed', {
        totalProcessed: updates.length,
        successful: successful.length,
        failed: failed.length,
        processingTimeMs,
      });

      return {
        successful,
        failed,
        totalProcessed: updates.length,
        processingTimeMs,
      };

    } catch (error) {
      logger.error('Batch card update failed', {
        updateCount: updates.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Batch delete cards
   */
  async batchDeleteCards(cardIds: string[], userId: string): Promise<BatchOperationResult<string>> {
    const startTime = Date.now();
    const successful: string[] = [];
    const failed: Array<{ input: string; error: string }> = [];

    try {
      // Process deletes in a transaction
      await database.transaction(async (trx) => {
        for (const cardId of cardIds) {
          try {
            // Check if card exists
            const existingCard = await trx(this.tableName)
              .where('id', cardId)
              .where('status', '!=', CardStatus.DELETED)
              .first();

            if (!existingCard) {
              failed.push({
                input: cardId,
                error: `Card ${cardId} not found or already deleted`,
              });
              continue;
            }

            // Soft delete
            await trx(this.tableName)
              .where('id', cardId)
              .update({
                status: CardStatus.DELETED,
                updated_at: new Date(),
                last_modified_by: userId,
                version: existingCard.version + 1,
              });

            successful.push(cardId);

          } catch (error) {
            failed.push({
              input: cardId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Batch delete completed', {
        totalProcessed: cardIds.length,
        successful: successful.length,
        failed: failed.length,
        processingTimeMs,
      });

      return {
        successful,
        failed,
        totalProcessed: cardIds.length,
        processingTimeMs,
      };

    } catch (error) {
      logger.error('Batch delete failed', {
        cardIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Import multiple cards
   */
  async importCards(workspaceId: string, cards: ImportCardData[], userId: string): Promise<BatchOperationResult<Card>> {
    const startTime = Date.now();
    const successful: Card[] = [];
    const failed: Array<{ input: ImportCardData; error: string }> = [];

    try {
      // Validate import data
      const validatedData = CardValidator.validateImportCards({ workspaceId, cards });

      // Get existing cards in workspace for collision detection
      const existingCards = await this.getWorkspaceCards(workspaceId);

      // Process imports in a transaction
      await database.transaction(async (trx) => {
        for (const cardData of validatedData.cards) {
          try {
            // Find non-overlapping position if needed
            const position = CardGeometry.findNonOverlappingPosition(
              cardData.dimensions,
              existingCards.cards,
              cardData.position
            );

            // Sanitize content
            const sanitizedContent = CardValidator.sanitizeContent(
              cardData.content, 
              cardData.type
            );

            const insertData = {
              workspace_id: workspaceId,
              type: cardData.type,
              title: cardData.title,
              content: sanitizedContent,
              position_x: position.x,
              position_y: position.y,
              z_index: position.z,
              width: cardData.dimensions.width,
              height: cardData.dimensions.height,
              metadata: JSON.stringify(cardData.metadata || {}),
              tags: JSON.stringify(cardData.tags || []),
              status: CardStatus.ACTIVE,
              version: 1,
              created_by: userId,
              last_modified_by: userId,
              is_dirty: false,
              last_saved_at: new Date(),
            };

            const [dbCard] = await trx(this.tableName)
              .insert(insertData)
              .returning('*');

            const card = CardMapper.mapDbCardToCard(dbCard);
            successful.push(card);

            // Add to existing cards for next collision check
            existingCards.cards.push(card);

          } catch (error) {
            failed.push({
              input: cardData,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Card import completed', {
        workspaceId,
        totalProcessed: cards.length,
        successful: successful.length,
        failed: failed.length,
        processingTimeMs,
      });

      return {
        successful,
        failed,
        totalProcessed: cards.length,
        processingTimeMs,
      };

    } catch (error) {
      logger.error('Card import failed', {
        workspaceId,
        cardCount: cards.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Auto-save cards (mark as saved and clean)
   */
  async autoSaveCards(cardIds: string[]): Promise<Card[]> {
    try {
      const updatedDbCards = await database.query<any[]>(
        knex(this.tableName)
          .whereIn('id', cardIds)
          .where('is_dirty', true)
          .update({
            is_dirty: false,
            last_saved_at: new Date(),
          })
          .returning('*'),
        'cards_auto_save'
      );

      const cards = updatedDbCards.map(dbCard => CardMapper.mapDbCardToCard(dbCard));

      logger.info('Auto-save completed', {
        cardIds,
        savedCount: cards.length,
      });

      return cards;

    } catch (error) {
      logger.error('Auto-save failed', {
        cardIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get dirty (unsaved) cards in workspace
   */
  async getDirtyCards(workspaceId: string): Promise<Card[]> {
    try {
      const dbCards = await database.query<any[]>(
        knex(this.tableName)
          .where('workspace_id', workspaceId)
          .where('is_dirty', true)
          .where('status', '!=', CardStatus.DELETED)
          .orderBy('updated_at', 'asc'),
        'cards_get_dirty'
      );

      return dbCards.map(dbCard => CardMapper.mapDbCardToCard(dbCard));

    } catch (error) {
      logger.error('Failed to get dirty cards', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Search cards in workspace using text search
   */
  async searchCards(
    workspaceId: string, 
    query: string, 
    limit: number = 50
  ): Promise<Card[]> {
    try {
      const dbCards = await database.query<any[]>(
        knex(this.tableName)
          .where('workspace_id', workspaceId)
          .where('status', '!=', CardStatus.DELETED)
          .where(function() {
            this.whereILike('title', `%${query}%`)
                .orWhereILike('content', `%${query}%`)
                .orWhereRaw('tags::text ILIKE ?', [`%${query}%`]);
          })
          .orderBy('updated_at', 'desc')
          .limit(limit),
        'cards_search'
      );

      return dbCards.map(dbCard => CardMapper.mapDbCardToCard(dbCard));

    } catch (error) {
      logger.error('Card search failed', {
        workspaceId,
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
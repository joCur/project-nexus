import { database, knex } from '@/database/connection';
import { 
  Connection, 
  CreateConnectionInput, 
  UpdateConnectionInput, 
  ConnectionFilter,
  BatchConnectionUpdate,
  BatchConnectionResult,
  ConnectionQuery,
  DbConnection,
  DEFAULT_CONNECTION_STYLE
} from '@/types/ConnectionTypes';
import { ConnectionType } from '@/types/CardTypes';
import { 
  NotFoundError, 
  ValidationError,
  UniqueConstraintError
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { 
  sanitizeMetadata,
  sanitizeConnectionStyle,
  sanitizeConnectionLabel
} from '@/utils/jsonSecurity';
import { 
  validateCreateConnection,
  validateUpdateConnection, 
  validateConnectionQuery,
  validateBatchCreateConnections,
  validateBatchUpdateConnections,
  validateBatchDeleteConnections
} from '@/validators/ConnectionValidators';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { z } from 'zod';

/**
 * Connection Service - Repository layer for connection management
 * Implements connection CRUD operations with validation, authorization, and batch processing
 */

const logger = createContextLogger({ service: 'ConnectionService' });

/**
 * Database transformation utilities for connections
 */
export class ConnectionMapper {
  /**
   * Map database connection record to Connection interface with security sanitization
   */
  static mapDbConnectionToConnection(dbConnection: DbConnection): Connection {
    return {
      id: dbConnection.id,
      sourceCardId: dbConnection.source_card_id,
      targetCardId: dbConnection.target_card_id,
      type: dbConnection.type as ConnectionType,
      confidence: dbConnection.confidence,
      // SECURITY FIX: Sanitize JSON fields to prevent XSS and pollution attacks
      style: sanitizeConnectionStyle(this.parseJsonSafely(dbConnection.style, DEFAULT_CONNECTION_STYLE)),
      label: sanitizeConnectionLabel(this.parseJsonSafely(dbConnection.label, undefined)),
      metadata: sanitizeMetadata(this.parseJsonSafely(dbConnection.metadata, {})),
      createdBy: dbConnection.created_by,
      isVisible: dbConnection.is_visible,
      aiReasoning: dbConnection.ai_reasoning,
      keywords: dbConnection.keywords || [],
      concepts: dbConnection.concepts || [],
      createdAt: new Date(dbConnection.created_at),
      updatedAt: new Date(dbConnection.updated_at),
    };
  }

  /**
   * Map Connection interface to database record
   */
  static mapConnectionToDbConnection(connection: Connection): Omit<DbConnection, 'created_at' | 'updated_at'> {
    return {
      id: connection.id,
      source_card_id: connection.sourceCardId,
      target_card_id: connection.targetCardId,
      type: connection.type,
      confidence: connection.confidence,
      style: JSON.stringify(connection.style),
      label: connection.label ? JSON.stringify(connection.label) : undefined,
      metadata: JSON.stringify(connection.metadata),
      created_by: connection.createdBy,
      is_visible: connection.isVisible,
      ai_reasoning: connection.aiReasoning,
      keywords: connection.keywords,
      concepts: connection.concepts,
    };
  }

  /**
   * Safely parse JSON with fallback
   */
  private static parseJsonSafely<T>(jsonString: string | undefined, fallback: T): T {
    if (!jsonString) return fallback;
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  }
}

export class ConnectionService {
  private readonly tableName = 'connections';
  private readonly bidirectionalViewName = 'bidirectional_connections';
  private workspaceAuth: WorkspaceAuthorizationService;

  constructor() {
    this.workspaceAuth = new WorkspaceAuthorizationService();
  }

  /**
   * Create a new connection with duplicate prevention and validation
   */
  async createConnection(input: CreateConnectionInput, userId: string): Promise<Connection> {
    try {
      // Validate input
      const validatedInput = validateCreateConnection(input);

      // Prevent self-connections
      if (validatedInput.sourceCardId === validatedInput.targetCardId) {
        throw new ValidationError('Cannot create connection from card to itself');
      }

      // Check for duplicate connections (both directions)
      const existingConnection = await this.checkForDuplicateConnection(
        validatedInput.sourceCardId, 
        validatedInput.targetCardId
      );
      
      if (existingConnection) {
        throw new UniqueConstraintError(
          'Connection already exists between these cards',
          'DUPLICATE_CONNECTION'
        );
      }

      // Get source and target cards to validate workspace access
      const [sourceCard, targetCard] = await Promise.all([
        this.getCardById(validatedInput.sourceCardId),
        this.getCardById(validatedInput.targetCardId)
      ]);

      if (!sourceCard || !targetCard) {
        throw new NotFoundError(
          'Card', 
          !sourceCard ? validatedInput.sourceCardId : validatedInput.targetCardId
        );
      }

      // Validate workspace access for both cards
      await Promise.all([
        this.workspaceAuth.requirePermission(
          userId,
          sourceCard.workspace_id,
          'connection:create',
          'Cannot create connection in source card workspace'
        ),
        this.workspaceAuth.requirePermission(
          userId,
          targetCard.workspace_id,
          'connection:create',
          'Cannot create connection in target card workspace'
        )
      ]);

      // SECURITY FIX: Sanitize inputs before processing
      const sanitizedStyle = sanitizeConnectionStyle({
        ...DEFAULT_CONNECTION_STYLE,
        ...(validatedInput.style || {})
      });

      const sanitizedLabel = validatedInput.label ? sanitizeConnectionLabel(validatedInput.label) : undefined;
      const sanitizedMetadata = sanitizeMetadata(validatedInput.metadata || {});

      const connectionData = {
        source_card_id: validatedInput.sourceCardId,
        target_card_id: validatedInput.targetCardId,
        type: validatedInput.type,
        confidence: validatedInput.confidence ?? 1.0,
        style: JSON.stringify(sanitizedStyle),
        label: sanitizedLabel ? JSON.stringify(sanitizedLabel) : undefined,
        metadata: JSON.stringify(sanitizedMetadata),
        created_by: userId,
        is_visible: true,
        ai_reasoning: validatedInput.aiReasoning,
        keywords: validatedInput.keywords || [],
        concepts: validatedInput.concepts || []
      };

      const [dbConnection] = await database.query<any[]>(
        knex(this.tableName)
          .insert(connectionData)
          .returning('*'),
        'connection_create'
      );

      const connection = ConnectionMapper.mapDbConnectionToConnection(dbConnection);

      logger.info('Connection created', {
        connectionId: connection.id,
        sourceCardId: connection.sourceCardId,
        targetCardId: connection.targetCardId,
        type: connection.type,
        userId,
      });

      return connection;

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.issues[0]?.message || 'Validation failed');
      }

      logger.error('Failed to create connection', {
        sourceCardId: input.sourceCardId,
        targetCardId: input.targetCardId,
        type: input.type,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get connection by ID with simple fetch
   */
  async getConnection(connectionId: string): Promise<Connection | null> {
    try {
      const dbConnection = await database.query<any>(
        knex(this.tableName)
          .where('id', connectionId)
          .first(),
        'connection_get'
      );

      return dbConnection ? ConnectionMapper.mapDbConnectionToConnection(dbConnection) : null;

    } catch (error) {
      logger.error('Failed to get connection', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get multiple connections by IDs
   */
  async getConnectionsByIds(connectionIds: string[]): Promise<Connection[]> {
    try {
      const dbConnections = await database.query<any[]>(
        knex(this.tableName)
          .whereIn('id', connectionIds),
        'connections_get_by_ids'
      );

      return dbConnections.map(dbConn => ConnectionMapper.mapDbConnectionToConnection(dbConn));

    } catch (error) {
      logger.error('Failed to get connections by IDs', {
        connectionIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get connections for a specific card using bidirectional view
   */
  async getConnectionsByCardId(
    cardId: string, 
    options?: { 
      includeBidirectional?: boolean; 
      limit?: number; 
      offset?: number 
    }
  ): Promise<Connection[]> {
    try {
      const { includeBidirectional = true, limit = 100, offset = 0 } = options || {};

      let query = knex(this.bidirectionalViewName);

      if (includeBidirectional) {
        // Use bidirectional view to get connections in both directions
        query = query.where('source_card_id', cardId).orWhere('target_card_id', cardId);
      } else {
        // Only connections where this card is the source
        query = query.where('source_card_id', cardId);
      }

      const dbConnections = await database.query<any[]>(
        query
          .where('is_visible', true)
          .orderBy('created_at', 'desc')
          .limit(limit)
          .offset(offset),
        'connections_get_by_card'
      );

      return dbConnections.map(dbConn => ConnectionMapper.mapDbConnectionToConnection(dbConn));

    } catch (error) {
      logger.error('Failed to get connections by card ID', {
        cardId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update connection with existence check
   */
  async updateConnection(
    connectionId: string, 
    input: UpdateConnectionInput, 
    userId: string
  ): Promise<Connection> {
    try {
      // Validate input
      const validatedInput = validateUpdateConnection(input);

      // Check if connection exists
      const existingConnection = await this.getConnection(connectionId);
      if (!existingConnection) {
        throw new NotFoundError('Connection', connectionId);
      }

      // Get source and target cards for workspace validation
      const [sourceCard, targetCard] = await Promise.all([
        this.getCardById(existingConnection.sourceCardId),
        this.getCardById(existingConnection.targetCardId)
      ]);

      if (!sourceCard || !targetCard) {
        throw new NotFoundError('Card', 'associated with connection');
      }

      // Validate workspace access
      await Promise.all([
        this.workspaceAuth.requirePermission(
          userId,
          sourceCard.workspace_id,
          'connection:update',
          'Cannot update connection in source card workspace'
        ),
        this.workspaceAuth.requirePermission(
          userId,
          targetCard.workspace_id,
          'connection:update',
          'Cannot update connection in target card workspace'
        )
      ]);

      // Prepare update data
      const updateData: any = {
        updated_at: new Date()
      };

      if (validatedInput.type !== undefined) {
        updateData.type = validatedInput.type;
      }

      if (validatedInput.confidence !== undefined) {
        updateData.confidence = validatedInput.confidence;
      }

      // SECURITY FIX: Sanitize inputs before updating
      if (validatedInput.style !== undefined) {
        const mergedStyle = {
          ...existingConnection.style,
          ...validatedInput.style
        };
        const sanitizedStyle = sanitizeConnectionStyle(mergedStyle);
        updateData.style = JSON.stringify(sanitizedStyle);
      }

      if (validatedInput.label !== undefined) {
        const sanitizedLabel = validatedInput.label ? sanitizeConnectionLabel(validatedInput.label) : null;
        updateData.label = sanitizedLabel ? JSON.stringify(sanitizedLabel) : null;
      }

      if (validatedInput.metadata !== undefined) {
        const sanitizedMetadata = sanitizeMetadata(validatedInput.metadata);
        updateData.metadata = JSON.stringify(sanitizedMetadata);
      }

      if (validatedInput.isVisible !== undefined) {
        updateData.is_visible = validatedInput.isVisible;
      }

      if (validatedInput.aiReasoning !== undefined) {
        updateData.ai_reasoning = validatedInput.aiReasoning;
      }

      if (validatedInput.keywords !== undefined) {
        updateData.keywords = validatedInput.keywords;
      }

      if (validatedInput.concepts !== undefined) {
        updateData.concepts = validatedInput.concepts;
      }

      const [updatedDbConnection] = await database.query<any[]>(
        knex(this.tableName)
          .where('id', connectionId)
          .update(updateData)
          .returning('*'),
        'connection_update'
      );

      const updatedConnection = ConnectionMapper.mapDbConnectionToConnection(updatedDbConnection);

      logger.info('Connection updated', {
        connectionId,
        userId,
        updatedFields: Object.keys(updateData),
      });

      return updatedConnection;

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.issues[0]?.message || 'Validation failed');
      }

      logger.error('Failed to update connection', {
        connectionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Delete connection (hard delete with existence check)
   */
  async deleteConnection(connectionId: string, userId: string): Promise<boolean> {
    try {
      // Check if connection exists
      const existingConnection = await this.getConnection(connectionId);
      if (!existingConnection) {
        throw new NotFoundError('Connection', connectionId);
      }

      // Get source and target cards for workspace validation
      const [sourceCard, targetCard] = await Promise.all([
        this.getCardById(existingConnection.sourceCardId),
        this.getCardById(existingConnection.targetCardId)
      ]);

      if (!sourceCard || !targetCard) {
        throw new NotFoundError('Card', 'associated with connection');
      }

      // Validate workspace access
      await Promise.all([
        this.workspaceAuth.requirePermission(
          userId,
          sourceCard.workspace_id,
          'connection:delete',
          'Cannot delete connection in source card workspace'
        ),
        this.workspaceAuth.requirePermission(
          userId,
          targetCard.workspace_id,
          'connection:delete',
          'Cannot delete connection in target card workspace'
        )
      ]);

      await database.query(
        knex(this.tableName)
          .where('id', connectionId)
          .del(),
        'connection_delete'
      );

      logger.info('Connection deleted', {
        connectionId,
        sourceCardId: existingConnection.sourceCardId,
        targetCardId: existingConnection.targetCardId,
        userId,
      });

      return true;

    } catch (error) {
      logger.error('Failed to delete connection', {
        connectionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Batch create connections with transaction-based individual error handling
   */
  async batchCreateConnections(
    connections: CreateConnectionInput[], 
    userId: string
  ): Promise<BatchConnectionResult<Connection>> {
    const startTime = Date.now();
    const successful: Connection[] = [];
    const failed: Array<{ input: any; error: string }> = [];

    try {
      // Validate all connections first
      const validatedConnections = validateBatchCreateConnections({ connections }).connections;

      // Process connections in a transaction
      await database.transaction(async (trx) => {
        for (const connectionInput of validatedConnections) {
          try {
            // Check for self-connection
            if (connectionInput.sourceCardId === connectionInput.targetCardId) {
              failed.push({
                input: connectionInput,
                error: 'Cannot create connection from card to itself',
              });
              continue;
            }

            // Check for duplicate (use the transaction context)
            const existingConnection = await trx(this.tableName)
              .where(function() {
                this.where('source_card_id', connectionInput.sourceCardId)
                    .andWhere('target_card_id', connectionInput.targetCardId);
              })
              .orWhere(function() {
                this.where('source_card_id', connectionInput.targetCardId)
                    .andWhere('target_card_id', connectionInput.sourceCardId);
              })
              .first();

            if (existingConnection) {
              failed.push({
                input: connectionInput,
                error: 'Connection already exists between these cards',
              });
              continue;
            }

            // Get cards for workspace validation
            const [sourceCard, targetCard] = await Promise.all([
              trx('cards').where('id', connectionInput.sourceCardId).first(),
              trx('cards').where('id', connectionInput.targetCardId).first()
            ]);

            if (!sourceCard || !targetCard) {
              failed.push({
                input: connectionInput,
                error: `Card not found: ${!sourceCard ? connectionInput.sourceCardId : connectionInput.targetCardId}`,
              });
              continue;
            }

            // Validate workspace access (this should be done outside transaction in practice)
            const hasSourceAccess = await this.workspaceAuth.hasWorkspaceAccess(
              userId, 
              sourceCard.workspace_id, 
              'connection:create'
            );
            const hasTargetAccess = await this.workspaceAuth.hasWorkspaceAccess(
              userId, 
              targetCard.workspace_id, 
              'connection:create'
            );

            if (!hasSourceAccess || !hasTargetAccess) {
              failed.push({
                input: connectionInput,
                error: 'Insufficient permissions for one or both card workspaces',
              });
              continue;
            }

            // SECURITY FIX: Sanitize inputs for batch creation
            const sanitizedStyle = sanitizeConnectionStyle({
              ...DEFAULT_CONNECTION_STYLE,
              ...(connectionInput.style || {})
            });

            const sanitizedLabel = connectionInput.label ? sanitizeConnectionLabel(connectionInput.label) : undefined;
            const sanitizedMetadata = sanitizeMetadata(connectionInput.metadata || {});

            const connectionData = {
              source_card_id: connectionInput.sourceCardId,
              target_card_id: connectionInput.targetCardId,
              type: connectionInput.type,
              confidence: connectionInput.confidence ?? 1.0,
              style: JSON.stringify(sanitizedStyle),
              label: sanitizedLabel ? JSON.stringify(sanitizedLabel) : undefined,
              metadata: JSON.stringify(sanitizedMetadata),
              created_by: userId,
              is_visible: true,
              ai_reasoning: connectionInput.aiReasoning,
              keywords: connectionInput.keywords || [],
              concepts: connectionInput.concepts || []
            };

            const [dbConnection] = await trx(this.tableName)
              .insert(connectionData)
              .returning('*');

            const connection = ConnectionMapper.mapDbConnectionToConnection(dbConnection);
            successful.push(connection);

          } catch (error) {
            failed.push({
              input: connectionInput,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Batch connection create completed', {
        totalProcessed: connections.length,
        successful: successful.length,
        failed: failed.length,
        processingTimeMs,
      });

      return {
        successful,
        failed,
        totalProcessed: connections.length,
        processingTimeMs,
      };

    } catch (error) {
      logger.error('Batch connection create failed', {
        connectionCount: connections.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Batch update connections with rollback support
   */
  async batchUpdateConnections(
    updates: BatchConnectionUpdate[], 
    userId: string
  ): Promise<BatchConnectionResult<Connection>> {
    const startTime = Date.now();
    const successful: Connection[] = [];
    const failed: Array<{ input: any; error: string }> = [];

    try {
      // Validate all updates first
      const validatedUpdates = validateBatchUpdateConnections({ updates }).updates;

      // Process updates in a transaction
      await database.transaction(async (trx) => {
        for (const update of validatedUpdates) {
          try {
            // Check if connection exists
            const existingConnection = await trx(this.tableName)
              .where('id', update.connectionId)
              .first();

            if (!existingConnection) {
              failed.push({
                input: update,
                error: `Connection ${update.connectionId} not found`,
              });
              continue;
            }

            // Get cards for workspace validation
            const [sourceCard, targetCard] = await Promise.all([
              trx('cards').where('id', existingConnection.source_card_id).first(),
              trx('cards').where('id', existingConnection.target_card_id).first()
            ]);

            if (!sourceCard || !targetCard) {
              failed.push({
                input: update,
                error: 'Associated card not found',
              });
              continue;
            }

            // Validate workspace access
            const hasSourceAccess = await this.workspaceAuth.hasWorkspaceAccess(
              userId, 
              sourceCard.workspace_id, 
              'connection:update'
            );
            const hasTargetAccess = await this.workspaceAuth.hasWorkspaceAccess(
              userId, 
              targetCard.workspace_id, 
              'connection:update'
            );

            if (!hasSourceAccess || !hasTargetAccess) {
              failed.push({
                input: update,
                error: 'Insufficient permissions for workspace access',
              });
              continue;
            }

            // Prepare update data
            const updateData: any = {
              updated_at: new Date()
            };

            const input = update.updates;

            if (input.type !== undefined) {
              updateData.type = input.type;
            }

            if (input.confidence !== undefined) {
              updateData.confidence = input.confidence;
            }

            // SECURITY FIX: Sanitize inputs for batch updates
            if (input.style !== undefined) {
              const existingStyle = this.parseJsonSafely(existingConnection.style, DEFAULT_CONNECTION_STYLE);
              const mergedStyle = { ...existingStyle, ...input.style };
              const sanitizedStyle = sanitizeConnectionStyle(mergedStyle);
              updateData.style = JSON.stringify(sanitizedStyle);
            }

            if (input.label !== undefined) {
              const sanitizedLabel = input.label ? sanitizeConnectionLabel(input.label) : null;
              updateData.label = sanitizedLabel ? JSON.stringify(sanitizedLabel) : null;
            }

            if (input.metadata !== undefined) {
              const sanitizedMetadata = sanitizeMetadata(input.metadata);
              updateData.metadata = JSON.stringify(sanitizedMetadata);
            }

            if (input.isVisible !== undefined) {
              updateData.is_visible = input.isVisible;
            }

            if (input.aiReasoning !== undefined) {
              updateData.ai_reasoning = input.aiReasoning;
            }

            if (input.keywords !== undefined) {
              updateData.keywords = input.keywords;
            }

            if (input.concepts !== undefined) {
              updateData.concepts = input.concepts;
            }

            // Update connection
            const [updatedDbConnection] = await trx(this.tableName)
              .where('id', update.connectionId)
              .update(updateData)
              .returning('*');

            const updatedConnection = ConnectionMapper.mapDbConnectionToConnection(updatedDbConnection);
            successful.push(updatedConnection);

          } catch (error) {
            failed.push({
              input: update,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Batch connection update completed', {
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
      logger.error('Batch connection update failed', {
        updateCount: updates.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Batch delete connections with transaction safety
   */
  async batchDeleteConnections(
    connectionIds: string[], 
    userId: string
  ): Promise<BatchConnectionResult<string>> {
    const startTime = Date.now();
    const successful: string[] = [];
    const failed: Array<{ input: any; error: string }> = [];

    try {
      // Validate input
      validateBatchDeleteConnections({ connectionIds });

      // Process deletes in a transaction
      await database.transaction(async (trx) => {
        for (const connectionId of connectionIds) {
          try {
            // Check if connection exists
            const existingConnection = await trx(this.tableName)
              .where('id', connectionId)
              .first();

            if (!existingConnection) {
              failed.push({
                input: connectionId,
                error: `Connection ${connectionId} not found`,
              });
              continue;
            }

            // Get cards for workspace validation
            const [sourceCard, targetCard] = await Promise.all([
              trx('cards').where('id', existingConnection.source_card_id).first(),
              trx('cards').where('id', existingConnection.target_card_id).first()
            ]);

            if (!sourceCard || !targetCard) {
              failed.push({
                input: connectionId,
                error: 'Associated card not found',
              });
              continue;
            }

            // Validate workspace access
            const hasSourceAccess = await this.workspaceAuth.hasWorkspaceAccess(
              userId, 
              sourceCard.workspace_id, 
              'connection:delete'
            );
            const hasTargetAccess = await this.workspaceAuth.hasWorkspaceAccess(
              userId, 
              targetCard.workspace_id, 
              'connection:delete'
            );

            if (!hasSourceAccess || !hasTargetAccess) {
              failed.push({
                input: connectionId,
                error: 'Insufficient permissions for workspace access',
              });
              continue;
            }

            // Hard delete
            await trx(this.tableName)
              .where('id', connectionId)
              .del();

            successful.push(connectionId);

          } catch (error) {
            failed.push({
              input: connectionId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });

      const processingTimeMs = Date.now() - startTime;

      logger.info('Batch delete completed', {
        totalProcessed: connectionIds.length,
        successful: successful.length,
        failed: failed.length,
        processingTimeMs,
      });

      return {
        successful,
        failed,
        totalProcessed: connectionIds.length,
        processingTimeMs,
      };

    } catch (error) {
      logger.error('Batch delete failed', {
        connectionIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Advanced querying with comprehensive filtering and sorting
   */
  async getConnectionsWithFilter(query: ConnectionQuery): Promise<{
    connections: Connection[];
    totalCount: number;
  }> {
    try {
      const validatedQuery = validateConnectionQuery(query);
      const { filter, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = validatedQuery;

      let dbQuery = knex(this.bidirectionalViewName).where('is_visible', true);

      // Apply specific card filtering
      if (validatedQuery.cardId) {
        dbQuery = dbQuery.where(function() {
          this.where('source_card_id', validatedQuery.cardId!)
              .orWhere('target_card_id', validatedQuery.cardId!);
        });
      }

      if (validatedQuery.cardIds && validatedQuery.cardIds.length > 0) {
        dbQuery = dbQuery.where(function() {
          this.whereIn('source_card_id', validatedQuery.cardIds!)
              .orWhereIn('target_card_id', validatedQuery.cardIds!);
        });
      }

      // Apply filters
      if (filter) {
        dbQuery = this.applyFilters(dbQuery, filter);
      }

      // Get total count
      const [{ count }] = await database.query<[{ count: string }]>(
        dbQuery.clone().count('id as count'),
        'connections_count'
      );

      const totalCount = parseInt(count, 10);

      // Get paginated results
      const dbConnections = await database.query<any[]>(
        dbQuery
          .orderBy(sortBy, sortOrder)
          .limit(limit)
          .offset(offset),
        'connections_filtered_list'
      );

      const connections = dbConnections.map(dbConn => 
        ConnectionMapper.mapDbConnectionToConnection(dbConn)
      );

      return { connections, totalCount };

    } catch (error) {
      logger.error('Failed to get connections with filter', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get connections in workspace with workspace-scoped queries
   */
  async getConnectionsInWorkspace(
    workspaceId: string, 
    filter?: ConnectionFilter,
    userId?: string
  ): Promise<{
    connections: Connection[];
    totalCount: number;
  }> {
    try {
      // Validate workspace access if user provided
      if (userId) {
        await this.workspaceAuth.requirePermission(
          userId,
          workspaceId,
          'connection:read',
          'Cannot read connections in this workspace'
        );
      }

      // Build query that joins with cards to filter by workspace
      let query = knex(this.bidirectionalViewName + ' as c')
        .join('cards as source', 'c.source_card_id', 'source.id')
        .join('cards as target', 'c.target_card_id', 'target.id')
        .where('source.workspace_id', workspaceId)
        .andWhere('target.workspace_id', workspaceId)
        .andWhere('c.is_visible', true)
        .select('c.*');

      // Apply additional filters
      if (filter) {
        query = this.applyFilters(query, filter);
      }

      // Get total count
      const [{ count }] = await database.query<[{ count: string }]>(
        query.clone().count('c.id as count'),
        'workspace_connections_count'
      );

      const totalCount = parseInt(count, 10);

      // Get connections
      const dbConnections = await database.query<any[]>(
        query
          .orderBy('c.created_at', 'desc')
          .limit(100), // Default workspace limit
        'workspace_connections_list'
      );

      const connections = dbConnections.map(dbConn => 
        ConnectionMapper.mapDbConnectionToConnection(dbConn)
      );

      return { connections, totalCount };

    } catch (error) {
      logger.error('Failed to get workspace connections', {
        workspaceId,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private method to apply filters to a query
   */
  private applyFilters(query: any, filter: ConnectionFilter): any {
    if (filter.types && filter.types.length > 0) {
      query = query.whereIn('type', filter.types);
    }

    if (filter.minConfidence !== undefined) {
      query = query.where('confidence', '>=', filter.minConfidence);
    }

    if (filter.maxConfidence !== undefined) {
      query = query.where('confidence', '<=', filter.maxConfidence);
    }

    if (filter.sourceCardIds && filter.sourceCardIds.length > 0) {
      query = query.whereIn('source_card_id', filter.sourceCardIds);
    }

    if (filter.targetCardIds && filter.targetCardIds.length > 0) {
      query = query.whereIn('target_card_id', filter.targetCardIds);
    }

    if (filter.createdBy) {
      query = query.where('created_by', filter.createdBy);
    }

    if (filter.isVisible !== undefined) {
      query = query.where('is_visible', filter.isVisible);
    }

    if (filter.createdAfter) {
      query = query.where('created_at', '>=', filter.createdAfter);
    }

    if (filter.createdBefore) {
      query = query.where('created_at', '<=', filter.createdBefore);
    }

    if (filter.hasAIReasoning !== undefined) {
      if (filter.hasAIReasoning) {
        query = query.whereNotNull('ai_reasoning');
      } else {
        query = query.whereNull('ai_reasoning');
      }
    }

    // SECURITY FIX: Use safe parameterized queries for PostgreSQL array operations
    if (filter.keywords && filter.keywords.length > 0) {
      // Use parameterized query with proper escaping for PostgreSQL array overlap operator
      const sanitizedKeywords = filter.keywords.filter(keyword => 
        typeof keyword === 'string' && keyword.trim().length > 0
      );
      if (sanitizedKeywords.length > 0) {
        query = query.where(knex.raw('keywords && ?::text[]', [sanitizedKeywords]));
      }
    }

    if (filter.concepts && filter.concepts.length > 0) {
      // Use parameterized query with proper escaping for PostgreSQL array overlap operator
      const sanitizedConcepts = filter.concepts.filter(concept => 
        typeof concept === 'string' && concept.trim().length > 0
      );
      if (sanitizedConcepts.length > 0) {
        query = query.where(knex.raw('concepts && ?::text[]', [sanitizedConcepts]));
      }
    }

    return query;
  }

  /**
   * Helper method to check for duplicate connections (bidirectional)
   */
  private async checkForDuplicateConnection(
    sourceCardId: string, 
    targetCardId: string
  ): Promise<boolean> {
    const existingConnection = await database.query<any>(
      knex(this.tableName)
        .where(function() {
          this.where('source_card_id', sourceCardId)
              .andWhere('target_card_id', targetCardId);
        })
        .orWhere(function() {
          this.where('source_card_id', targetCardId)
              .andWhere('target_card_id', sourceCardId);
        })
        .first(),
      'connection_duplicate_check'
    );

    return !!existingConnection;
  }

  /**
   * Helper method to get card by ID for workspace validation
   */
  async getCardById(cardId: string): Promise<{ workspace_id: string } | null> {
    return database.query<{ workspace_id: string } | null>(
      knex('cards')
        .where('id', cardId)
        .select('workspace_id')
        .first(),
      'card_get_for_workspace'
    );
  }

  /**
   * Safely parse JSON with fallback
   */
  private parseJsonSafely<T>(jsonString: string | undefined, fallback: T): T {
    if (!jsonString) return fallback;
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  }
}

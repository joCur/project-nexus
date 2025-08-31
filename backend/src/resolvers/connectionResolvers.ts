import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';
import { ConnectionService } from '@/services/ConnectionService';
import { CardService } from '@/services/CardService';
import { WorkspaceAuthorizationService } from '@/services/workspaceAuthorization';
import { 
  Connection, 
  CreateConnectionInput, 
  UpdateConnectionInput, 
  ConnectionFilter,
  BatchConnectionUpdate 
} from '@/types/ConnectionTypes';
import { 
  SubscriptionService, 
  CONNECTION_EVENTS,
  pubSub 
} from '@/services/subscriptionService';
import { withFilter } from 'graphql-subscriptions';

/**
 * GraphQL resolvers for connection management operations
 * Implements comprehensive connection CRUD with real-time updates and batch operations
 * Follows authorization patterns from cardResolvers for workspace-scoped access control
 */

const logger = createContextLogger({ service: 'ConnectionResolvers' });

export const connectionResolvers = {
  Query: {
    /**
     * Get single connection by ID with workspace authorization
     */
    connection: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<Connection | null> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const connectionService = new ConnectionService();
        const connection = await connectionService.getConnection(id);

        if (!connection) {
          return null;
        }

        // Authorization check - users can only access connections where both cards are in their workspaces
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;
        const [sourceCard, targetCard] = await Promise.all([
          connectionService.getCardById(connection.sourceCardId),
          connectionService.getCardById(connection.targetCardId)
        ]);

        if (!sourceCard || !targetCard) {
          throw new NotFoundError('Card', 'associated with connection');
        }

        // Check access to both card workspaces
        const hasSourceAccess = await workspaceAuth.hasPermissionInWorkspace(
          context.user!.id,
          sourceCard.workspace_id,
          'connection:read'
        );
        const hasTargetAccess = await workspaceAuth.hasPermissionInWorkspace(
          context.user!.id,
          targetCard.workspace_id,
          'connection:read'
        );

        if (!hasSourceAccess || !hasTargetAccess) {
          // Get user permissions for error reporting
          const userPermissionsByWorkspace = await workspaceAuth.getUserPermissionsForContext(context.user!.id);
          const flatUserPermissions = Object.values(userPermissionsByWorkspace).flat();
          throw new AuthorizationError(
            'Cannot access connections between cards in other user workspaces',
            'INSUFFICIENT_PERMISSIONS',
            'connection:read',
            flatUserPermissions
          );
        }

        logger.info('Connection retrieved via GraphQL', {
          connectionId: id,
          sourceCardId: connection.sourceCardId,
          targetCardId: connection.targetCardId,
          userId: context.user?.id,
        });

        return connection;

      } catch (error) {
        logger.error('Failed to get connection via GraphQL', {
          connectionId: id,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get connections with filtering and pagination, scoped to workspace
     */
    connections: async (
      _: any,
      { 
        workspaceId, 
        filter, 
        pagination 
      }: { 
        workspaceId: string; 
        filter?: ConnectionFilter; 
        pagination?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC' } 
      },
      context: GraphQLContext
    ) => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check - users can only access their own workspaces
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;
        const hasAccess = await workspaceAuth.hasPermissionInWorkspace(
          context.user!.id,
          workspaceId,
          'connection:read'
        );
        
        if (!hasAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, workspaceId);
          throw new AuthorizationError(
            'Cannot access connections in other user workspaces',
            'INSUFFICIENT_PERMISSIONS',
            'connection:read',
            userPermissions
          );
        }

        const connectionService = new ConnectionService();
        const page = pagination?.page || 1;
        const limit = Math.min(pagination?.limit || 20, 100); // Cap at 100
        const offset = (page - 1) * limit;

        const { connections, totalCount } = await connectionService.getConnectionsInWorkspace(
          workspaceId,
          filter,
          context.user!.id
        );

        // Apply pagination manually if service doesn't handle it
        const paginatedConnections = connections.slice(offset, offset + limit);
        const totalPages = Math.ceil(totalCount / limit);

        logger.info('Connections retrieved via GraphQL', {
          workspaceId,
          userId: context.user?.id,
          totalCount,
          page,
          limit,
          filterApplied: !!filter,
        });

        return {
          items: paginatedConnections,
          totalCount,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        };

      } catch (error) {
        logger.error('Failed to get connections via GraphQL', {
          workspaceId,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get all connections for a specific card
     */
    cardConnections: async (
      _: any,
      { cardId }: { cardId: string },
      context: GraphQLContext
    ): Promise<Connection[]> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const connectionService = new ConnectionService();
        
        // Get card to check workspace access
        const card = await connectionService.getCardById(cardId);
        if (!card) {
          throw new NotFoundError('Card', cardId);
        }

        // Authorization check
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;
        const hasAccess = await workspaceAuth.hasPermissionInWorkspace(
          context.user!.id,
          card.workspace_id,
          'connection:read'
        );
        
        if (!hasAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, card.workspace_id);
          throw new AuthorizationError(
            'Cannot access connections for cards in other user workspaces',
            'INSUFFICIENT_PERMISSIONS',
            'connection:read',
            userPermissions
          );
        }

        const connections = await connectionService.getConnectionsByCardId(cardId, {
          includeBidirectional: true,
          limit: 1000 // High limit for card connections
        });

        logger.info('Card connections retrieved via GraphQL', {
          cardId,
          connectionCount: connections.length,
          userId: context.user?.id,
        });

        return connections;

      } catch (error) {
        logger.error('Failed to get card connections via GraphQL', {
          cardId,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get connection count for workspace
     */
    connectionCount: async (
      _: any,
      { workspaceId }: { workspaceId: string },
      context: GraphQLContext
    ): Promise<number> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // Authorization check
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;
        const hasAccess = await workspaceAuth.hasPermissionInWorkspace(
          context.user!.id,
          workspaceId,
          'connection:read'
        );
        
        if (!hasAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, workspaceId);
          throw new AuthorizationError(
            'Cannot access connection count for other user workspaces',
            'INSUFFICIENT_PERMISSIONS',
            'connection:read',
            userPermissions
          );
        }

        const connectionService = new ConnectionService();
        const { totalCount } = await connectionService.getConnectionsInWorkspace(
          workspaceId,
          undefined,
          context.user!.id
        );

        logger.info('Connection count retrieved via GraphQL', {
          workspaceId,
          totalCount,
          userId: context.user?.id,
        });

        return totalCount;

      } catch (error) {
        logger.error('Failed to get connection count via GraphQL', {
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
     * Create new connection with workspace authorization for both cards
     */
    createConnection: async (
      _: any,
      { input }: { input: CreateConnectionInput },
      context: GraphQLContext
    ): Promise<Connection> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const connectionService = new ConnectionService();
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;

        // Get both cards to validate workspace access
        const [sourceCard, targetCard] = await Promise.all([
          connectionService.getCardById(input.sourceCardId),
          connectionService.getCardById(input.targetCardId)
        ]);

        if (!sourceCard || !targetCard) {
          throw new NotFoundError(
            'Card', 
            !sourceCard ? input.sourceCardId : input.targetCardId
          );
        }

        // Validate workspace access for both cards
        const [hasSourceAccess, hasTargetAccess] = await Promise.all([
          workspaceAuth.hasPermissionInWorkspace(
            context.user!.id,
            sourceCard.workspace_id,
            'connection:create'
          ),
          workspaceAuth.hasPermissionInWorkspace(
            context.user!.id,
            targetCard.workspace_id,
            'connection:create'
          )
        ]);
        
        if (!hasSourceAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, sourceCard.workspace_id);
          throw new AuthorizationError(
            'Cannot create connection in source card workspace',
            'INSUFFICIENT_PERMISSIONS',
            'connection:create',
            userPermissions
          );
        }
        
        if (!hasTargetAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, targetCard.workspace_id);
          throw new AuthorizationError(
            'Cannot create connection in target card workspace',
            'INSUFFICIENT_PERMISSIONS',
            'connection:create',
            userPermissions
          );
        }

        const connection = await connectionService.createConnection(input, context.user!.id);

        // Publish real-time event
        await pubSub.publish(CONNECTION_EVENTS.CONNECTION_CREATED, {
          connectionCreated: connection,
          workspaceId: sourceCard.workspace_id, // Use source card workspace for event routing
        });

        logger.info('Connection created via GraphQL', {
          connectionId: connection.id,
          sourceCardId: connection.sourceCardId,
          targetCardId: connection.targetCardId,
          type: connection.type,
          userId: context.user!.id,
        });

        return connection;

      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }

        logger.error('Failed to create connection via GraphQL', {
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Update existing connection with workspace authorization
     */
    updateConnection: async (
      _: any,
      { id, input }: { id: string; input: UpdateConnectionInput },
      context: GraphQLContext
    ): Promise<Connection> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const connectionService = new ConnectionService();
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;
        
        // Check if connection exists and get associated cards
        const existingConnection = await connectionService.getConnection(id);
        if (!existingConnection) {
          throw new NotFoundError('Connection', id);
        }

        const [sourceCard, targetCard] = await Promise.all([
          connectionService.getCardById(existingConnection.sourceCardId),
          connectionService.getCardById(existingConnection.targetCardId)
        ]);

        if (!sourceCard || !targetCard) {
          throw new NotFoundError('Card', 'associated with connection');
        }

        // Validate workspace access for both cards
        const [hasSourceAccess, hasTargetAccess] = await Promise.all([
          workspaceAuth.hasPermissionInWorkspace(
            context.user!.id,
            sourceCard.workspace_id,
            'connection:update'
          ),
          workspaceAuth.hasPermissionInWorkspace(
            context.user!.id,
            targetCard.workspace_id,
            'connection:update'
          )
        ]);
        
        if (!hasSourceAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, sourceCard.workspace_id);
          throw new AuthorizationError(
            'Cannot update connection in source card workspace',
            'INSUFFICIENT_PERMISSIONS',
            'connection:update',
            userPermissions
          );
        }
        
        if (!hasTargetAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, targetCard.workspace_id);
          throw new AuthorizationError(
            'Cannot update connection in target card workspace',
            'INSUFFICIENT_PERMISSIONS',
            'connection:update',
            userPermissions
          );
        }

        const updatedConnection = await connectionService.updateConnection(id, input, context.user!.id);

        // Publish real-time event
        await pubSub.publish(CONNECTION_EVENTS.CONNECTION_UPDATED, {
          connectionUpdated: updatedConnection,
          workspaceId: sourceCard.workspace_id,
        });

        logger.info('Connection updated via GraphQL', {
          connectionId: id,
          userId: context.user!.id,
          updatedFields: Object.keys(input),
        });

        return updatedConnection;

      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          throw error;
        }

        logger.error('Failed to update connection via GraphQL', {
          connectionId: id,
          input,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Delete connection with workspace authorization
     */
    deleteConnection: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const connectionService = new ConnectionService();
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;
        
        // Check if connection exists and get associated cards
        const existingConnection = await connectionService.getConnection(id);
        if (!existingConnection) {
          throw new NotFoundError('Connection', id);
        }

        const [sourceCard, targetCard] = await Promise.all([
          connectionService.getCardById(existingConnection.sourceCardId),
          connectionService.getCardById(existingConnection.targetCardId)
        ]);

        if (!sourceCard || !targetCard) {
          throw new NotFoundError('Card', 'associated with connection');
        }

        // Validate workspace access for both cards
        const [hasSourceAccess, hasTargetAccess] = await Promise.all([
          workspaceAuth.hasPermissionInWorkspace(
            context.user!.id,
            sourceCard.workspace_id,
            'connection:delete'
          ),
          workspaceAuth.hasPermissionInWorkspace(
            context.user!.id,
            targetCard.workspace_id,
            'connection:delete'
          )
        ]);
        
        if (!hasSourceAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, sourceCard.workspace_id);
          throw new AuthorizationError(
            'Cannot delete connection in source card workspace',
            'INSUFFICIENT_PERMISSIONS',
            'connection:delete',
            userPermissions
          );
        }
        
        if (!hasTargetAccess) {
          const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, targetCard.workspace_id);
          throw new AuthorizationError(
            'Cannot delete connection in target card workspace',
            'INSUFFICIENT_PERMISSIONS',
            'connection:delete',
            userPermissions
          );
        }

        const success = await connectionService.deleteConnection(id, context.user!.id);

        if (success) {
          // Publish real-time event
          await pubSub.publish(CONNECTION_EVENTS.CONNECTION_DELETED, {
            connectionDeleted: id,
            workspaceId: sourceCard.workspace_id,
          });
        }

        logger.info('Connection deleted via GraphQL', {
          connectionId: id,
          userId: context.user!.id,
          success,
        });

        return success;

      } catch (error) {
        if (error instanceof NotFoundError) {
          throw error;
        }

        logger.error('Failed to delete connection via GraphQL', {
          connectionId: id,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },

    /**
     * Batch create multiple connections with validation and authorization
     */
    batchCreateConnections: async (
      _: any,
      { connections }: { connections: CreateConnectionInput[] },
      context: GraphQLContext
    ): Promise<any> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const connectionService = new ConnectionService();
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;

        // SECURITY FIX: Validate workspace authorization for each connection before batch processing
        for (const connectionInput of connections) {
          // Get both cards to validate workspace access
          const [sourceCard, targetCard] = await Promise.all([
            connectionService.getCardById(connectionInput.sourceCardId),
            connectionService.getCardById(connectionInput.targetCardId)
          ]);

          if (!sourceCard || !targetCard) {
            throw new NotFoundError(
              'Card', 
              !sourceCard ? connectionInput.sourceCardId : connectionInput.targetCardId
            );
          }

          // Validate workspace access for both cards
          const [hasSourceAccess, hasTargetAccess] = await Promise.all([
            workspaceAuth.hasPermissionInWorkspace(
              context.user!.id,
              sourceCard.workspace_id,
              'connection:create'
            ),
            workspaceAuth.hasPermissionInWorkspace(
              context.user!.id,
              targetCard.workspace_id,
              'connection:create'
            )
          ]);
          
          if (!hasSourceAccess) {
            const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, sourceCard.workspace_id);
            throw new AuthorizationError(
              'Cannot create connection in source card workspace',
              'INSUFFICIENT_PERMISSIONS',
              'connection:create',
              userPermissions
            );
          }
          
          if (!hasTargetAccess) {
            const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, targetCard.workspace_id);
            throw new AuthorizationError(
              'Cannot create connection in target card workspace',
              'INSUFFICIENT_PERMISSIONS',
              'connection:create',
              userPermissions
            );
          }
        }

        const result = await connectionService.batchCreateConnections(connections, context.user!.id);

        // Publish real-time events for successful connections
        if (result.successful.length > 0) {
          // Group by workspace for event publishing
          const workspaceGroups: { [workspaceId: string]: Connection[] } = {};
          
          for (const connection of result.successful) {
            const sourceCard = await connectionService.getCardById(connection.sourceCardId);
            if (sourceCard) {
              if (!workspaceGroups[sourceCard.workspace_id]) {
                workspaceGroups[sourceCard.workspace_id] = [];
              }
              workspaceGroups[sourceCard.workspace_id].push(connection);
            }
          }

          // Publish events for each workspace
          for (const [workspaceId, connections] of Object.entries(workspaceGroups)) {
            for (const connection of connections) {
              await pubSub.publish(CONNECTION_EVENTS.CONNECTION_CREATED, {
                connectionCreated: connection,
                workspaceId,
              });
            }
          }
        }

        logger.info('Batch connection create completed via GraphQL', {
          userId: context.user!.id,
          totalProcessed: connections.length,
          successful: result.successful.length,
          failed: result.failed.length,
          processingTimeMs: result.processingTimeMs,
        });

        if (result.failed.length > 0) {
          logger.warn('Some connection creations failed', {
            userId: context.user!.id,
            failedConnections: result.failed,
          });
        }

        return result;

      } catch (error) {
        logger.error('Failed to batch create connections via GraphQL', {
          connectionCount: connections.length,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Batch update multiple connections with authorization
     */
    batchUpdateConnections: async (
      _: any,
      { updates }: { updates: BatchConnectionUpdate[] },
      context: GraphQLContext
    ): Promise<any> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        const connectionService = new ConnectionService();
        const workspaceAuth = context.dataSources.workspaceAuthorizationService;

        // SECURITY FIX: Validate workspace authorization for each connection before batch processing
        for (const update of updates) {
          // Check if connection exists and get associated cards
          const existingConnection = await connectionService.getConnection(update.connectionId);
          if (!existingConnection) {
            throw new NotFoundError('Connection', update.connectionId);
          }

          const [sourceCard, targetCard] = await Promise.all([
            connectionService.getCardById(existingConnection.sourceCardId),
            connectionService.getCardById(existingConnection.targetCardId)
          ]);

          if (!sourceCard || !targetCard) {
            throw new NotFoundError('Card', 'associated with connection');
          }

          // Validate workspace access for both cards
          const [hasSourceAccess, hasTargetAccess] = await Promise.all([
            workspaceAuth.hasPermissionInWorkspace(
              context.user!.id,
              sourceCard.workspace_id,
              'connection:update'
            ),
            workspaceAuth.hasPermissionInWorkspace(
              context.user!.id,
              targetCard.workspace_id,
              'connection:update'
            )
          ]);
          
          if (!hasSourceAccess) {
            const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, sourceCard.workspace_id);
            throw new AuthorizationError(
              'Cannot update connection in source card workspace',
              'INSUFFICIENT_PERMISSIONS',
              'connection:update',
              userPermissions
            );
          }
          
          if (!hasTargetAccess) {
            const userPermissions = await workspaceAuth.getUserPermissionsInWorkspace(context.user!.id, targetCard.workspace_id);
            throw new AuthorizationError(
              'Cannot update connection in target card workspace',
              'INSUFFICIENT_PERMISSIONS',
              'connection:update',
              userPermissions
            );
          }
        }

        const result = await connectionService.batchUpdateConnections(updates, context.user!.id);

        // Publish real-time events for successful updates
        if (result.successful.length > 0) {
          for (const connection of result.successful) {
            const sourceCard = await connectionService.getCardById(connection.sourceCardId);
            if (sourceCard) {
              await pubSub.publish(CONNECTION_EVENTS.CONNECTION_UPDATED, {
                connectionUpdated: connection,
                workspaceId: sourceCard.workspace_id,
              });
            }
          }
        }

        logger.info('Batch connection update completed via GraphQL', {
          userId: context.user!.id,
          totalProcessed: updates.length,
          successful: result.successful.length,
          failed: result.failed.length,
          processingTimeMs: result.processingTimeMs,
        });

        if (result.failed.length > 0) {
          logger.warn('Some connection updates failed', {
            userId: context.user!.id,
            failedUpdates: result.failed,
          });
        }

        return result;

      } catch (error) {
        logger.error('Failed to batch update connections via GraphQL', {
          updateCount: updates.length,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Batch delete multiple connections with authorization and secure event publishing
     */
    batchDeleteConnections: async (
      _: any,
      { connectionIds }: { connectionIds: string[] },
      context: GraphQLContext
    ): Promise<any> => {
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      try {
        // SECURITY FIX: Get workspace information BEFORE deletion for secure event publishing
        const connectionService = new ConnectionService();
        const connections = await connectionService.getConnectionsByIds(connectionIds);
        
        // Build workspace mapping for secure event publishing
        const cardIds = [...new Set([
          ...connections.map(c => c.sourceCardId),
          ...connections.map(c => c.targetCardId)
        ])];
        
        const cardService = new CardService();
        const cards = await cardService.getCardsByIds(cardIds);
        const cardToWorkspaceMap = new Map(cards.map(card => [card.id, card.workspaceId]));
        
        // Create secure connection to workspace mapping
        const connectionWorkspaceMap = new Map();
        connections.forEach(connection => {
          const sourceWorkspace = cardToWorkspaceMap.get(connection.sourceCardId);
          const targetWorkspace = cardToWorkspaceMap.get(connection.targetCardId);
          // Use source workspace as primary workspace for the connection
          connectionWorkspaceMap.set(connection.id, sourceWorkspace || targetWorkspace);
        });
        
        const workspaceIds = [...new Set(cards.map(card => card.workspaceId))];
        
        // Validate workspace access for all affected workspaces
        const authService = context.dataSources.workspaceAuthorizationService;
        for (const workspaceId of workspaceIds) {
          const hasAccess = await authService.hasPermissionInWorkspace(
            context.user!.id,
            workspaceId,
            'connection:delete'
          );
          
          if (!hasAccess) {
            const userPermissions = await authService.getUserPermissionsInWorkspace(context.user!.id, workspaceId);
            throw new AuthorizationError(
              `Cannot delete connections in workspace ${workspaceId}`,
              'INSUFFICIENT_PERMISSIONS',
              'connection:delete',
              userPermissions
            );
          }
        }

        const result = await connectionService.batchDeleteConnections(connectionIds, context.user!.id);

        // Publish secure real-time events for successful deletions
        if (result.successful.length > 0) {
          for (const connectionId of result.successful) {
            const workspaceId = connectionWorkspaceMap.get(connectionId);
            if (workspaceId) {
              await pubSub.publish(CONNECTION_EVENTS.CONNECTION_DELETED, {
                connectionDeleted: connectionId,
                workspaceId,
              });
            }
          }
        }

        logger.info('Batch connection delete completed via GraphQL', {
          userId: context.user!.id,
          totalProcessed: connectionIds.length,
          successful: result.successful.length,
          failed: result.failed.length,
          processingTimeMs: result.processingTimeMs,
        });

        if (result.failed.length > 0) {
          logger.warn('Some connection deletions failed', {
            userId: context.user!.id,
            failedDeletions: result.failed,
          });
        }

        return result;

      } catch (error) {
        logger.error('Failed to batch delete connections via GraphQL', {
          connectionIds,
          userId: context.user!.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  Subscription: {
    /**
     * Subscribe to connection created events in a workspace
     */
    connectionCreated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CONNECTION_EVENTS.CONNECTION_CREATED]),
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
     * Subscribe to connection updated events in a workspace
     */
    connectionUpdated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CONNECTION_EVENTS.CONNECTION_UPDATED]),
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
     * Subscribe to connection deleted events in a workspace
     */
    connectionDeleted: {
      subscribe: withFilter(
        () => pubSub.asyncIterator([CONNECTION_EVENTS.CONNECTION_DELETED]),
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

  // Field resolvers for Connection type
  Connection: {
    /**
     * Resolve source card for Connection type
     */
    sourceCard: async (connection: Connection, _: any, _context: GraphQLContext) => {
      const { CardService } = await import('@/services/CardService');
      const cardService = new CardService();
      return await cardService.getCard(connection.sourceCardId);
    },

    /**
     * Resolve target card for Connection type
     */
    targetCard: async (connection: Connection, _: any, _context: GraphQLContext) => {
      const { CardService } = await import('@/services/CardService');
      const cardService = new CardService();
      return await cardService.getCard(connection.targetCardId);
    },

    /**
     * Resolve creator user for Connection type
     */
    createdBy: async (connection: Connection, _: any, context: GraphQLContext) => {
      const userService = context.dataSources.userService;
      return await userService.findById(connection.createdBy);
    },
  },
};
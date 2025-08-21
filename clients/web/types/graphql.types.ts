/**
 * GraphQL Integration Types
 * 
 * Type definitions for GraphQL operations, mutations, queries, and subscriptions
 * used by the canvas system with proper codegen compatibility.
 */

import type { CanvasPosition } from './canvas.types';
import type { Card } from './card.types';
import type { Connection } from './connection.types';
import type { EntityId } from './common.types';

// ============================================================================
// GRAPHQL OPERATION TYPES
// ============================================================================

/**
 * GraphQL operation status
 */
export type OperationStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Base GraphQL response
 */
export interface BaseGraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: Array<string | number>;
    extensions?: Record<string, any>;
  }>;
  loading: boolean;
  networkStatus: number;
}

// ============================================================================
// CARD OPERATIONS
// ============================================================================

/**
 * Create card input
 */
export interface CreateCardInput {
  workspaceId: EntityId;
  type: Card['content']['type'];
  position: CanvasPosition;
  content: Card['content'];
  title?: string;
  tags?: string[];
}

/**
 * Update card input
 */
export interface UpdateCardInput {
  id: EntityId;
  title?: string;
  content?: Partial<Card['content']>;
  position?: CanvasPosition;
  dimensions?: Card['dimensions'];
  tags?: string[];
}

/**
 * Card filter input
 */
export interface CardFilterInput {
  workspaceId: EntityId;
  types?: Card['content']['type'][];
  tags?: string[];
  searchQuery?: string;
  boundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * Card mutations
 */
export interface CardMutations {
  createCard: (input: CreateCardInput) => Promise<Card>;
  updateCard: (input: UpdateCardInput) => Promise<Card>;
  deleteCard: (id: EntityId) => Promise<boolean>;
  duplicateCard: (id: EntityId, position?: CanvasPosition) => Promise<Card>;
}

/**
 * Card queries  
 */
export interface CardQueries {
  getCard: (id: EntityId) => Promise<Card | null>;
  getWorkspaceCards: (filter: CardFilterInput) => Promise<Card[]>;
  searchCards: (workspaceId: EntityId, query: string) => Promise<Card[]>;
}

/**
 * Card subscriptions
 */
export interface CardSubscriptions {
  cardUpdated: (workspaceId: EntityId) => AsyncIterable<Card>;
  cardDeleted: (workspaceId: EntityId) => AsyncIterable<EntityId>;
  cardCreated: (workspaceId: EntityId) => AsyncIterable<Card>;
}

// ============================================================================
// CONNECTION OPERATIONS
// ============================================================================

/**
 * Create connection input
 */
export interface CreateConnectionInput {
  sourceCardId: EntityId;
  targetCardId: EntityId;
  type: Connection['type'];
  strength?: number;
  metadata?: Record<string, any>;
}

/**
 * Update connection input
 */
export interface UpdateConnectionInput {
  id: EntityId;
  type?: Connection['type'];
  strength?: number;
  metadata?: Record<string, any>;
}

/**
 * Connection mutations
 */
export interface ConnectionMutations {
  createConnection: (input: CreateConnectionInput) => Promise<Connection>;
  updateConnection: (input: UpdateConnectionInput) => Promise<Connection>;
  deleteConnection: (id: EntityId) => Promise<boolean>;
}

/**
 * Connection queries
 */
export interface ConnectionQueries {
  getConnection: (id: EntityId) => Promise<Connection | null>;
  getCardConnections: (cardId: EntityId) => Promise<Connection[]>;
  getWorkspaceConnections: (workspaceId: EntityId) => Promise<Connection[]>;
}

/**
 * Connection subscriptions
 */
export interface ConnectionSubscriptions {
  connectionCreated: (workspaceId: EntityId) => AsyncIterable<Connection>;
  connectionUpdated: (workspaceId: EntityId) => AsyncIterable<Connection>;
  connectionDeleted: (workspaceId: EntityId) => AsyncIterable<EntityId>;
}

// ============================================================================
// WORKSPACE OPERATIONS
// ============================================================================

/**
 * Workspace canvas settings input
 */
export interface WorkspaceCanvasSettingsInput {
  workspaceId: EntityId;
  gridEnabled?: boolean;
  gridSize?: number;
  defaultZoom?: number;
  autoSave?: boolean;
}

/**
 * Workspace operations
 */
export interface WorkspaceOperations {
  updateCanvasSettings: (input: WorkspaceCanvasSettingsInput) => Promise<boolean>;
  getCanvasSettings: (workspaceId: EntityId) => Promise<Record<string, any>>;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch card position update
 */
export interface BatchCardPositionInput {
  updates: Array<{
    id: EntityId;
    position: CanvasPosition;
  }>;
}

/**
 * Batch operations
 */
export interface BatchOperations {
  updateCardPositions: (input: BatchCardPositionInput) => Promise<Card[]>;
  deleteCards: (ids: EntityId[]) => Promise<boolean>;
  duplicateCards: (ids: EntityId[], offset?: CanvasPosition) => Promise<Card[]>;
}

// ============================================================================
// GRAPHQL CLIENT INTERFACE
// ============================================================================

/**
 * Complete GraphQL client interface for canvas operations
 */
export interface CanvasGraphQLClient extends 
  CardMutations, 
  CardQueries, 
  CardSubscriptions,
  ConnectionMutations,
  ConnectionQueries, 
  ConnectionSubscriptions,
  WorkspaceOperations,
  BatchOperations {
  
  // Client management
  clearCache: () => void;
  refetchQueries: (queries: string[]) => Promise<void>;
  
  // Error handling
  onError: (handler: (error: Error) => void) => void;
  
  // Loading states
  isLoading: (operationType: string) => boolean;
}

// ============================================================================
// OPERATION RESULT TYPES
// ============================================================================

/**
 * Mutation result with optimistic updates support
 */
export interface MutationResult<T = any> {
  data?: T;
  error?: Error;
  loading: boolean;
  called: boolean;
}

/**
 * Query result with caching support
 */
export interface QueryResult<T = any> {
  data?: T;
  error?: Error;
  loading: boolean;
  networkStatus: number;
  refetch: () => Promise<QueryResult<T>>;
  fetchMore: (options: any) => Promise<QueryResult<T>>;
}

/**
 * Subscription result
 */
export interface SubscriptionResult<T = any> {
  data?: T;
  error?: Error;
  loading: boolean;
}
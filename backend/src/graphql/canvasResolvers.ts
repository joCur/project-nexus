/**
 * Canvas GraphQL Resolver Type Definitions (NEX-96)
 * 
 * Defines TypeScript interfaces for GraphQL resolvers implementing
 * canvas operations. Provides type safety for resolver implementations.
 * 
 * This file defines the resolver interface contracts that will be
 * implemented by actual resolver functions in NEX-115, NEX-116, NEX-117.
 */

import { GraphQLContext } from '../types';

// ============================================================================
// RESOLVER ARGUMENT TYPES
// ============================================================================

// Card resolver arguments
export interface CardResolverArgs {
  id: string;
}

export interface CardsResolverArgs {
  workspaceId: string;
  filter?: CardFilterInput;
  pagination?: PaginationInput;
}

export interface SearchCardsResolverArgs {
  workspaceId: string;
  query: string;
  limit?: number;
}

export interface CardsInBoundsResolverArgs {
  workspaceId: string;
  bounds: CanvasBoundsInput;
}

export interface CreateCardResolverArgs {
  input: CreateCardInput;
}

export interface UpdateCardResolverArgs {
  id: string;
  input: UpdateCardInput;
}

export interface DeleteCardResolverArgs {
  id: string;
}

export interface DuplicateCardResolverArgs {
  id: string;
  offset?: PositionInput;
}

export interface BatchUpdateCardPositionsResolverArgs {
  updates: CardPositionUpdate[];
}

// Connection resolver arguments  
export interface ConnectionResolverArgs {
  id: string;
}

export interface ConnectionsResolverArgs {
  workspaceId: string;
  filter?: ConnectionFilterInput;
  pagination?: PaginationInput;
}

export interface CardConnectionsResolverArgs {
  cardId: string;
}

export interface CreateConnectionResolverArgs {
  input: CreateConnectionInput;
}

export interface UpdateConnectionResolverArgs {
  id: string;
  input: UpdateConnectionInput;
}

export interface DeleteConnectionResolverArgs {
  id: string;
}

// Canvas settings resolver arguments
export interface CanvasSettingsResolverArgs {
  workspaceId: string;
}

export interface UpdateCanvasSettingsResolverArgs {
  workspaceId: string;
  input: CanvasSettingsInput;
}

// Subscription arguments
export interface WorkspaceSubscriptionArgs {
  workspaceId: string;
}

// ============================================================================
// INPUT TYPE INTERFACES (matching GraphQL schema)
// ============================================================================

export interface PositionInput {
  x: number;
  y: number;
}

export interface DimensionsInput {
  width: number;
  height: number;
}

export interface CanvasBoundsInput {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CardStyleInput {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  shadow?: boolean;
}

export interface CreateCardInput {
  workspaceId: string;
  type: CardType;
  title: string;
  content?: string;
  position: PositionInput;
  dimensions?: DimensionsInput;
  style?: CardStyleInput;
  tags?: string[];
  metadata?: Record<string, any>;
  priority?: CardPriority;
}

export interface UpdateCardInput {
  title?: string;
  content?: string;
  position?: PositionInput;
  dimensions?: DimensionsInput;
  style?: CardStyleInput;
  tags?: string[];
  metadata?: Record<string, any>;
  status?: CardStatus;
  priority?: CardPriority;
  zIndex?: number;
}

export interface CardPositionUpdate {
  cardId: string;
  position: PositionInput;
}

export interface CreateConnectionInput {
  sourceCardId: string;
  targetCardId: string;
  type: ConnectionType;
  confidence?: number;
  metadata?: Record<string, any>;
  reason?: string;
}

export interface UpdateConnectionInput {
  type?: ConnectionType;
  confidence?: number;
  metadata?: Record<string, any>;
  reason?: string;
  isVisible?: boolean;
}

export interface CanvasSettingsInput {
  gridEnabled?: boolean;
  gridSize?: number;
  gridColor?: string;
  gridOpacity?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  enableCulling?: boolean;
  enableVirtualization?: boolean;
  maxVisibleCards?: number;
  lastViewport?: Record<string, any>;
}

export interface CardFilterInput {
  types?: CardType[];
  status?: CardStatus[];
  priority?: CardPriority[];
  tags?: string[];
  searchQuery?: string;
  bounds?: CanvasBoundsInput;
  createdDateRange?: DateRangeInput;
  updatedDateRange?: DateRangeInput;
  ownerId?: string;
}

export interface DateRangeInput {
  start: Date;
  end: Date;
}

export interface ConnectionFilterInput {
  types?: ConnectionType[];
  minConfidence?: number;
  sourceCardId?: string;
  targetCardId?: string;
  createdBy?: string;
}

export interface PaginationInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// ============================================================================
// ENUM TYPES (matching GraphQL schema)
// ============================================================================

export enum CardType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE', 
  LINK = 'LINK',
  CODE = 'CODE'
}

export enum CardStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED'
}

export enum CardPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum ConnectionType {
  MANUAL = 'MANUAL',
  AI_SUGGESTED = 'AI_SUGGESTED',
  AI_GENERATED = 'AI_GENERATED',
  REFERENCE = 'REFERENCE',
  DEPENDENCY = 'DEPENDENCY',
  SIMILARITY = 'SIMILARITY',
  RELATED = 'RELATED'
}

// ============================================================================
// ENTITY TYPE INTERFACES (matching GraphQL schema)
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CardStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  shadow: boolean;
}

export interface Card {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  content?: string;
  type: CardType;
  position: Position;
  dimensions: Dimensions;
  zIndex: number;
  style: CardStyle;
  tags: string[];
  metadata: Record<string, any>;
  status: CardStatus;
  priority: CardPriority;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  embeddingModel?: string;
  contentHash?: string;
  embeddingUpdatedAt?: Date;
}

export interface Connection {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  type: ConnectionType;
  confidence: number;
  metadata: Record<string, any>;
  reason?: string;
  createdAt: Date;
  isVisible: boolean;
  createdBy: string;
}

export interface CanvasSettings {
  workspaceId: string;
  gridEnabled: boolean;
  gridSize: number;
  gridColor: string;
  gridOpacity: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  enableCulling: boolean;
  enableVirtualization: boolean;
  maxVisibleCards: number;
  lastViewport?: Record<string, any>;
  updatedAt: Date;
}

export interface CardConnection {
  items: Card[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ConnectionConnection {
  items: Connection[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CanvasStats {
  totalCards: number;
  totalConnections: number;
  cardsByType: CardTypeCount[];
  connectionsByType: ConnectionTypeCount[];
  lastActivity?: Date;
}

export interface CardTypeCount {
  type: CardType;
  count: number;
}

export interface ConnectionTypeCount {
  type: ConnectionType;
  count: number;
}

export interface CursorPosition {
  userId: string;
  position: Position;
  timestamp: Date;
}

// ============================================================================
// RESOLVER INTERFACE DEFINITIONS
// ============================================================================

/**
 * Query resolver interface for canvas operations
 */
export interface CanvasQueryResolvers {
  // Card queries
  card: (parent: any, args: CardResolverArgs, context: GraphQLContext) => Promise<Card | null>;
  cards: (parent: any, args: CardsResolverArgs, context: GraphQLContext) => Promise<CardConnection>;
  searchCards: (parent: any, args: SearchCardsResolverArgs, context: GraphQLContext) => Promise<Card[]>;
  cardsInBounds: (parent: any, args: CardsInBoundsResolverArgs, context: GraphQLContext) => Promise<Card[]>;
  
  // Connection queries
  connection: (parent: any, args: ConnectionResolverArgs, context: GraphQLContext) => Promise<Connection | null>;
  connections: (parent: any, args: ConnectionsResolverArgs, context: GraphQLContext) => Promise<ConnectionConnection>;
  cardConnections: (parent: any, args: CardConnectionsResolverArgs, context: GraphQLContext) => Promise<Connection[]>;
  
  // Canvas settings
  canvasSettings: (parent: any, args: CanvasSettingsResolverArgs, context: GraphQLContext) => Promise<CanvasSettings | null>;
  
  // Analytics
  cardCount: (parent: any, args: CanvasSettingsResolverArgs, context: GraphQLContext) => Promise<number>;
  connectionCount: (parent: any, args: CanvasSettingsResolverArgs, context: GraphQLContext) => Promise<number>;
  canvasStats: (parent: any, args: CanvasSettingsResolverArgs, context: GraphQLContext) => Promise<CanvasStats>;
}

/**
 * Mutation resolver interface for canvas operations
 */
export interface CanvasMutationResolvers {
  // Card CRUD operations
  createCard: (parent: any, args: CreateCardResolverArgs, context: GraphQLContext) => Promise<Card>;
  updateCard: (parent: any, args: UpdateCardResolverArgs, context: GraphQLContext) => Promise<Card>;
  deleteCard: (parent: any, args: DeleteCardResolverArgs, context: GraphQLContext) => Promise<boolean>;
  duplicateCard: (parent: any, args: DuplicateCardResolverArgs, context: GraphQLContext) => Promise<Card>;
  
  // Batch operations
  createCards: (parent: any, args: { inputs: CreateCardInput[] }, context: GraphQLContext) => Promise<Card[]>;
  updateCards: (parent: any, args: { updates: UpdateCardInput[] }, context: GraphQLContext) => Promise<Card[]>;
  deleteCards: (parent: any, args: { ids: string[] }, context: GraphQLContext) => Promise<boolean>;
  batchUpdateCardPositions: (parent: any, args: BatchUpdateCardPositionsResolverArgs, context: GraphQLContext) => Promise<Card[]>;
  
  // Connection CRUD operations  
  createConnection: (parent: any, args: CreateConnectionResolverArgs, context: GraphQLContext) => Promise<Connection>;
  updateConnection: (parent: any, args: UpdateConnectionResolverArgs, context: GraphQLContext) => Promise<Connection>;
  deleteConnection: (parent: any, args: DeleteConnectionResolverArgs, context: GraphQLContext) => Promise<boolean>;
  deleteConnections: (parent: any, args: { ids: string[] }, context: GraphQLContext) => Promise<boolean>;
  
  // Canvas settings
  updateCanvasSettings: (parent: any, args: UpdateCanvasSettingsResolverArgs, context: GraphQLContext) => Promise<CanvasSettings>;
  resetCanvasSettings: (parent: any, args: CanvasSettingsResolverArgs, context: GraphQLContext) => Promise<CanvasSettings>;
  
  // AI features
  generateCardEmbeddings: (parent: any, args: { cardIds: string[] }, context: GraphQLContext) => Promise<boolean>;
  suggestConnections: (parent: any, args: { cardId: string; limit?: number }, context: GraphQLContext) => Promise<Connection[]>;
}

/**
 * Subscription resolver interface for real-time canvas updates
 */
export interface CanvasSubscriptionResolvers {
  // Card subscriptions
  cardCreated: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<Card>;
  cardUpdated: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<Card>;
  cardDeleted: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<string>;
  cardMoved: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<Card>;
  
  // Connection subscriptions
  connectionCreated: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<Connection>;
  connectionUpdated: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<Connection>;
  connectionDeleted: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<string>;
  
  // Canvas settings subscriptions
  canvasSettingsUpdated: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<CanvasSettings>;
  
  // Collaborative editing
  userJoinedCanvas: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<any>;
  userLeftCanvas: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<string>;
  cursorPositionUpdated: (parent: any, args: WorkspaceSubscriptionArgs, context: GraphQLContext) => AsyncIterableIterator<CursorPosition>;
}

/**
 * Field resolver interface for canvas entities
 */
export interface CanvasFieldResolvers {
  Card: {
    workspace: (parent: Card, args: any, context: GraphQLContext) => Promise<any>;
    owner: (parent: Card, args: any, context: GraphQLContext) => Promise<any>;
  };
  
  Connection: {
    sourceCard: (parent: Connection, args: any, context: GraphQLContext) => Promise<Card>;
    targetCard: (parent: Connection, args: any, context: GraphQLContext) => Promise<Card>;
    createdBy: (parent: Connection, args: any, context: GraphQLContext) => Promise<any>;
  };
}

/**
 * Complete canvas resolver interface combining all resolver types
 */
export interface CanvasResolvers {
  Query: CanvasQueryResolvers;
  Mutation: CanvasMutationResolvers;
  Subscription: CanvasSubscriptionResolvers;
  
  // Field resolvers
  Card: CanvasFieldResolvers['Card'];
  Connection: CanvasFieldResolvers['Connection'];
}

// ============================================================================
// UTILITY TYPES FOR RESOLVER IMPLEMENTATIONS
// ============================================================================

/**
 * Database model interfaces (to be implemented by data layer)
 */
export interface CardModel {
  findById(id: string): Promise<Card | null>;
  findByWorkspace(workspaceId: string, filter?: CardFilterInput, pagination?: PaginationInput): Promise<CardConnection>;
  create(data: CreateCardInput, ownerId: string): Promise<Card>;
  update(id: string, data: UpdateCardInput): Promise<Card>;
  delete(id: string): Promise<boolean>;
  search(workspaceId: string, query: string, limit?: number): Promise<Card[]>;
  findInBounds(workspaceId: string, bounds: CanvasBounds): Promise<Card[]>;
  batchUpdatePositions(updates: CardPositionUpdate[]): Promise<Card[]>;
}

export interface ConnectionModel {
  findById(id: string): Promise<Connection | null>;
  findByWorkspace(workspaceId: string, filter?: ConnectionFilterInput, pagination?: PaginationInput): Promise<ConnectionConnection>;
  findByCard(cardId: string): Promise<Connection[]>;
  create(data: CreateConnectionInput, createdBy: string): Promise<Connection>;
  update(id: string, data: UpdateConnectionInput): Promise<Connection>;
  delete(id: string): Promise<boolean>;
  deleteMultiple(ids: string[]): Promise<boolean>;
}

export interface CanvasSettingsModel {
  findByWorkspace(workspaceId: string): Promise<CanvasSettings | null>;
  upsert(workspaceId: string, data: CanvasSettingsInput): Promise<CanvasSettings>;
  reset(workspaceId: string): Promise<CanvasSettings>;
}

/**
 * Service interfaces for business logic
 */
export interface CardService {
  validateCardData(data: CreateCardInput | UpdateCardInput): Promise<void>;
  generateEmbeddings(cardIds: string[]): Promise<boolean>;
  calculateStats(workspaceId: string): Promise<CanvasStats>;
}

export interface ConnectionService {
  validateConnection(sourceCardId: string, targetCardId: string): Promise<void>;
  suggestConnections(cardId: string, limit: number): Promise<Connection[]>;
  calculateConnectionStrength(sourceCard: Card, targetCard: Card): Promise<number>;
}

export interface CanvasPermissionService {
  canReadWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  canWriteWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  canDeleteCard(userId: string, cardId: string): Promise<boolean>;
  canModifyConnection(userId: string, connectionId: string): Promise<boolean>;
}
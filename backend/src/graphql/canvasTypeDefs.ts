import { gql } from 'apollo-server-express';

/**
 * Canvas GraphQL Type Definitions (NEX-96)
 * 
 * Defines GraphQL schema for canvas operations including cards, connections,
 * and workspace canvas settings. Aligns with frontend types from NEX-94
 * and database schema from NEX-95.
 * 
 * Key Alignments:
 * - Frontend CardType enum → GraphQL CardType enum  
 * - Frontend ConnectionType enum → GraphQL ConnectionType enum
 * - Frontend CanvasPosition → GraphQL Position type
 * - Database snake_case → GraphQL camelCase field names
 */

export const canvasTypeDefs = gql`
  # ============================================================================
  # CORE CANVAS TYPES
  # ============================================================================

  # Canvas position coordinates (aligns with frontend CanvasPosition)
  type Position {
    x: Float!
    y: Float!
    z: Float!
  }

  # Card dimensions (aligns with frontend Dimensions)
  type Dimensions {
    width: Float!
    height: Float!
  }

  # Canvas bounds for viewport and queries
  type CanvasBounds {
    minX: Float!
    minY: Float!
    maxX: Float!
    maxY: Float!
  }

  # ============================================================================
  # CARD TYPES AND ENUMS
  # ============================================================================

  # Card types (aligns with frontend CardType)
  enum CardType {
    TEXT         # Matches frontend 'text'
    IMAGE        # Matches frontend 'image' 
    LINK         # Matches frontend 'link'
    CODE         # Matches frontend 'code'
  }

  # Card status for lifecycle management
  enum CardStatus {
    DRAFT
    ACTIVE
    ARCHIVED
    DELETED
  }

  # Card priority levels
  enum CardPriority {
    LOW
    NORMAL
    HIGH
    URGENT
  }

  # Card styling properties (simplified for GraphQL)
  type CardStyle {
    backgroundColor: String!
    borderColor: String!
    textColor: String!
    borderWidth: Int!
    borderRadius: Int!
    opacity: Float!
    shadow: Boolean!
  }

  # Main card type (aligns with frontend Card interface)
  type Card {
    id: ID!
    workspaceId: ID!
    ownerId: ID!
    
    # Content fields
    title: String!
    content: String
    type: CardType!
    
    # Canvas positioning (aligns with frontend)
    position: Position!
    dimensions: Dimensions!
    
    # Visual styling
    style: CardStyle!
    
    # Metadata and organization
    tags: [String!]!
    metadata: JSON!
    status: CardStatus!
    priority: CardPriority!
    
    # Relationships
    workspace: Workspace!
    owner: User!
    
    # Audit fields
    createdAt: DateTime!
    updatedAt: DateTime!
    version: Int!
    
    # Vector embeddings (for AI features)
    embeddingModel: String
    contentHash: String
    embeddingUpdatedAt: DateTime
  }

  # ============================================================================
  # CONNECTION TYPES AND ENUMS  
  # ============================================================================

  # Connection types (aligns with frontend ConnectionType enum)
  enum ConnectionType {
    MANUAL           # Matches frontend ConnectionType.MANUAL
    AI_SUGGESTED     # Matches frontend ConnectionType.AI_SUGGESTED
    AI_GENERATED     # Matches frontend ConnectionType.AI_GENERATED
    REFERENCE        # Matches frontend ConnectionType.REFERENCE
    DEPENDENCY       # Matches frontend ConnectionType.DEPENDENCY
    SIMILARITY       # Matches frontend ConnectionType.SIMILARITY
    RELATED          # Matches frontend ConnectionType.RELATED
  }

  # Connection visual styling (aligns with frontend ConnectionStyle)
  type ConnectionStyle {
    color: String!
    width: Int!
    opacity: Float!
    dashArray: String
    curve: String!         # 'straight' | 'curved' | 'stepped'
    showArrow: Boolean!
    showLabel: Boolean!
  }

  # Connection label configuration (aligns with frontend ConnectionLabel)
  type ConnectionLabel {
    text: String!
    position: String!      # 'start' | 'middle' | 'end'
    backgroundColor: String
    textColor: String
    fontSize: Int!
  }

  # Connection entity (aligns with frontend Connection interface)
  type Connection {
    id: ID!
    sourceCardId: ID!      # Aligns with frontend sourceCardId
    targetCardId: ID!      # Aligns with frontend targetCardId
    type: ConnectionType!
    confidence: Float!     # Aligns with frontend confidence (0.0-1.0)
    
    # Visual styling (aligns with frontend)
    style: ConnectionStyle!
    label: ConnectionLabel
    
    # Relationships
    sourceCard: Card!
    targetCard: Card!
    createdBy: User!
    
    # Metadata and AI fields (aligns with frontend)
    metadata: JSON!
    isVisible: Boolean!
    aiReasoning: String    # AI explanation for connection
    keywords: [String!]    # Keywords that triggered connection
    concepts: [String!]    # Concepts linking the cards
    
    # Audit fields
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # ============================================================================
  # WORKSPACE CANVAS SETTINGS
  # ============================================================================

  # Canvas configuration for workspace
  type CanvasSettings {
    workspaceId: ID!
    
    # Grid settings
    gridEnabled: Boolean!
    gridSize: Int!
    gridColor: String!
    gridOpacity: Float!
    
    # Zoom configuration
    minZoom: Float!
    maxZoom: Float!
    zoomStep: Float!
    
    # Performance settings
    enableCulling: Boolean!
    enableVirtualization: Boolean!
    maxVisibleCards: Int!
    
    # Last viewport state
    lastViewport: JSON
    
    updatedAt: DateTime!
  }

  # ============================================================================
  # INPUT TYPES FOR MUTATIONS
  # ============================================================================

  # Position input
  input PositionInput {
    x: Float!
    y: Float!
    z: Float!
  }

  # Dimensions input
  input DimensionsInput {
    width: Float!
    height: Float!
  }

  # Canvas bounds input
  input CanvasBoundsInput {
    minX: Float!
    minY: Float!
    maxX: Float!
    maxY: Float!
  }

  # Card style input
  input CardStyleInput {
    backgroundColor: String
    borderColor: String
    textColor: String
    borderWidth: Int
    borderRadius: Int
    opacity: Float
    shadow: Boolean
  }

  # Card creation input (aligns with frontend CreateCardParams)
  input CreateCardInput {
    workspaceId: ID!
    type: CardType!
    title: String!
    content: String
    position: PositionInput!
    dimensions: DimensionsInput
    style: CardStyleInput
    tags: [String!]
    metadata: JSON
    priority: CardPriority
  }

  # Card update input (aligns with frontend UpdateCardParams) 
  input UpdateCardInput {
    title: String
    content: String
    position: PositionInput
    dimensions: DimensionsInput
    style: CardStyleInput
    tags: [String!]
    metadata: JSON
    status: CardStatus
    priority: CardPriority
  }

  # Batch position update for performance
  input CardPositionUpdate {
    cardId: ID!
    position: PositionInput!
  }

  # Connection style input (aligns with frontend ConnectionStyle)
  input ConnectionStyleInput {
    color: String
    width: Int
    opacity: Float
    dashArray: String
    curve: String         # 'straight' | 'curved' | 'stepped'
    showArrow: Boolean
    showLabel: Boolean
  }

  # Connection label input (aligns with frontend ConnectionLabel)
  input ConnectionLabelInput {
    text: String!
    position: String!      # 'start' | 'middle' | 'end'
    backgroundColor: String
    textColor: String
    fontSize: Int!
  }

  # Connection creation input (aligns with frontend ConnectionActions.createConnection)
  input CreateConnectionInput {
    sourceCardId: ID!
    targetCardId: ID!
    type: ConnectionType = MANUAL
    confidence: Float
    style: ConnectionStyleInput
    label: ConnectionLabelInput
    metadata: JSON
    aiReasoning: String    # AI explanation for connection
    keywords: [String!]    # Keywords that triggered connection
    concepts: [String!]    # Concepts linking the cards
  }

  # Connection update input (aligns with frontend ConnectionActions.updateConnection)
  input UpdateConnectionInput {
    type: ConnectionType
    confidence: Float
    style: ConnectionStyleInput
    label: ConnectionLabelInput
    metadata: JSON
    isVisible: Boolean
    aiReasoning: String    # AI explanation for connection
    keywords: [String!]    # Keywords that triggered connection
    concepts: [String!]    # Concepts linking the cards
  }

  # Batch connection operations
  input BatchConnectionUpdate {
    connectionId: ID!
    updates: UpdateConnectionInput!
  }

  # Canvas settings input
  input CanvasSettingsInput {
    gridEnabled: Boolean
    gridSize: Int
    gridColor: String
    gridOpacity: Float
    minZoom: Float
    maxZoom: Float
    zoomStep: Float
    enableCulling: Boolean
    enableVirtualization: Boolean
    maxVisibleCards: Int
    lastViewport: JSON
  }

  # ============================================================================
  # FILTER AND PAGINATION TYPES
  # ============================================================================

  # Card filtering options (aligns with frontend CardFilter)
  input CardFilter {
    types: [CardType!]
    status: [CardStatus!]
    priority: [CardPriority!]
    tags: [String!]
    searchQuery: String
    bounds: CanvasBoundsInput
    createdDateRange: DateRangeInput
    updatedDateRange: DateRangeInput
    ownerId: ID
  }

  # Date range filter
  input DateRangeInput {
    start: DateTime!
    end: DateTime!
  }

  # Connection filter options (aligns with backend ConnectionFilter)
  input ConnectionFilter {
    types: [ConnectionType!]
    minConfidence: Float
    maxConfidence: Float
    sourceCardIds: [ID!]
    targetCardIds: [ID!]
    createdBy: ID
    isVisible: Boolean
    createdAfter: DateTime
    createdBefore: DateTime
    hasAIReasoning: Boolean
    keywords: [String!]
    concepts: [String!]
  }

  # Paginated card results
  type CardConnection {
    items: [Card!]!
    totalCount: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # Paginated connection results  
  type ConnectionConnection {
    items: [Connection!]!
    totalCount: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # ============================================================================
  # QUERY EXTENSIONS
  # ============================================================================

  extend type Query {
    # Card queries (aligns with frontend CardActions)
    card(id: ID!): Card
    cards(
      workspaceId: ID!
      filter: CardFilter
      pagination: PaginationInput
    ): CardConnection! @auth
    
    # Card search and filtering
    searchCards(
      workspaceId: ID!
      query: String!
      limit: Int = 20
    ): [Card!]! @auth
    
    cardsInBounds(
      workspaceId: ID!
      bounds: CanvasBoundsInput!
    ): [Card!]! @auth
    
    # Connection queries
    connection(id: ID!): Connection
    connections(
      workspaceId: ID!
      filter: ConnectionFilter
      pagination: PaginationInput
    ): ConnectionConnection! @auth
    
    cardConnections(cardId: ID!): [Connection!]! @auth
    
    # Canvas settings
    canvasSettings(workspaceId: ID!): CanvasSettings @auth
    
    # Analytics and insights
    cardCount(workspaceId: ID!): Int! @auth
    connectionCount(workspaceId: ID!): Int! @auth
    canvasStats(workspaceId: ID!): CanvasStats! @auth
  }

  # Canvas statistics
  type CanvasStats {
    totalCards: Int!
    totalConnections: Int!
    cardsByType: [CardTypeCount!]!
    connectionsByType: [ConnectionTypeCount!]!
    lastActivity: DateTime
  }

  type CardTypeCount {
    type: CardType!
    count: Int!
  }

  type ConnectionTypeCount {
    type: ConnectionType!
    count: Int!
  }

  # ============================================================================
  # MUTATION EXTENSIONS
  # ============================================================================

  extend type Mutation {
    # Card CRUD operations (aligns with frontend CardActions)
    createCard(input: CreateCardInput!): Card! @auth
    updateCard(id: ID!, input: UpdateCardInput!): Card! @auth
    deleteCard(id: ID!): Boolean! @auth
    duplicateCard(id: ID!, offset: PositionInput): Card! @auth
    
    # Batch card operations for performance
    createCards(inputs: [CreateCardInput!]!): [Card!]! @auth
    updateCards(updates: [UpdateCardInput!]!): [Card!]! @auth
    deleteCards(ids: [ID!]!): Boolean! @auth
    batchUpdateCardPositions(updates: [CardPositionUpdate!]!): [Card!]! @auth
    
    # Connection CRUD operations (aligns with frontend ConnectionActions)
    createConnection(input: CreateConnectionInput!): Connection! @auth
    updateConnection(id: ID!, input: UpdateConnectionInput!): Connection! @auth
    deleteConnection(id: ID!): Boolean! @auth
    
    # Batch connection operations for performance
    batchCreateConnections(connections: [CreateConnectionInput!]!): [Connection!]! @auth
    batchUpdateConnections(updates: [BatchConnectionUpdate!]!): [Connection!]! @auth
    batchDeleteConnections(connectionIds: [ID!]!): Boolean! @auth
    
    # Canvas settings management
    updateCanvasSettings(
      workspaceId: ID!
      input: CanvasSettingsInput!
    ): CanvasSettings! @auth
    
    resetCanvasSettings(workspaceId: ID!): CanvasSettings! @auth
    
    # AI and automation features (future expansion)
    generateCardEmbeddings(cardIds: [ID!]!): Boolean! @auth
    suggestConnections(cardId: ID!, limit: Int = 10): [Connection!]! @auth
  }

  # ============================================================================
  # SUBSCRIPTION EXTENSIONS (Real-time Canvas Updates)
  # ============================================================================

  extend type Subscription {
    # Card real-time updates (aligns with frontend card state management)
    cardCreated(workspaceId: ID!): Card! @auth
    cardUpdated(workspaceId: ID!): Card! @auth
    cardDeleted(workspaceId: ID!): ID! @auth
    cardMoved(workspaceId: ID!): Card! @auth
    
    # Connection real-time updates
    connectionCreated(workspaceId: ID!): Connection! @auth
    connectionUpdated(workspaceId: ID!): Connection! @auth
    connectionDeleted(workspaceId: ID!): ID! @auth
    
    # Canvas settings updates
    canvasSettingsUpdated(workspaceId: ID!): CanvasSettings! @auth
    
    # Collaborative editing events
    userJoinedCanvas(workspaceId: ID!): User! @auth
    userLeftCanvas(workspaceId: ID!): ID! @auth
    cursorPositionUpdated(workspaceId: ID!): CursorPosition! @auth
  }

  # Cursor position for collaborative editing
  type CursorPosition {
    userId: ID!
    user: User!
    position: Position!
    timestamp: DateTime!
  }

  # ============================================================================
  # ERROR TYPES
  # ============================================================================

  # Canvas-specific error types
  type CardNotFoundError {
    cardId: ID!
    message: String!
  }

  type ConnectionNotFoundError {
    connectionId: ID!
    message: String!
  }

  type CanvasValidationError {
    field: String!
    message: String!
    value: String
  }

  # Union types for error handling
  union CardResult = Card | CardNotFoundError | CanvasValidationError
  union ConnectionResult = Connection | ConnectionNotFoundError | CanvasValidationError
`;
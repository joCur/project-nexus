/**
 * GraphQL operations for card management
 * Integrates with backend card resolvers and aligns with CardActions interface
 */

import { gql } from '@apollo/client';

// ============================================================================
// FRAGMENTS
// ============================================================================

/**
 * Core card fragment with all essential fields
 * Matches backend Card type and frontend discriminated union expectations
 */
const CARD_CORE_FIELDS = gql`
  fragment CardCoreFields on Card {
    id
    workspaceId
    ownerId
    title
    content
    type
    position {
      x
      y
      z
    }
    dimensions {
      width
      height
    }
    style {
      backgroundColor
      borderColor
      textColor
      borderWidth
      borderRadius
      opacity
      shadow
    }
    tags
    metadata
    status
    priority
    createdAt
    updatedAt
    version
  }
`;

/**
 * Extended card fragment with relationships
 */
const CARD_WITH_RELATIONS = gql`
  ${CARD_CORE_FIELDS}
  fragment CardWithRelations on Card {
    ...CardCoreFields
    workspace {
      id
      name
      ownerId
    }
    owner {
      id
      email
      displayName
      avatarUrl
    }
  }
`;

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get single card by ID
 * Aligns with CardActions.getCard()
 */
export const GET_CARD = gql`
  ${CARD_WITH_RELATIONS}
  query GetCard($id: ID!) {
    card(id: $id) {
      ...CardWithRelations
    }
  }
`;

/**
 * Get cards with filtering and pagination
 * Aligns with CardActions.getCards()
 */
export const GET_CARDS = gql`
  ${CARD_CORE_FIELDS}
  query GetCards(
    $workspaceId: ID!
    $filter: CardFilter
    $pagination: PaginationInput
  ) {
    cards(
      workspaceId: $workspaceId
      filter: $filter
      pagination: $pagination
    ) {
      items {
        ...CardCoreFields
      }
      totalCount
      page
      limit
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
`;

/**
 * Search cards by text query
 * Aligns with CardActions.searchCards()
 */
export const SEARCH_CARDS = gql`
  ${CARD_CORE_FIELDS}
  query SearchCards(
    $workspaceId: ID!
    $query: String!
    $limit: Int
  ) {
    searchCards(
      workspaceId: $workspaceId
      query: $query
      limit: $limit
    ) {
      ...CardCoreFields
    }
  }
`;

/**
 * Get cards within canvas bounds
 * For viewport-based loading optimization
 */
export const GET_CARDS_IN_BOUNDS = gql`
  ${CARD_CORE_FIELDS}
  query GetCardsInBounds(
    $workspaceId: ID!
    $bounds: CanvasBoundsInput!
  ) {
    cardsInBounds(
      workspaceId: $workspaceId
      bounds: $bounds
    ) {
      ...CardCoreFields
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create new card
 * Aligns with CardActions.createCard()
 */
export const CREATE_CARD = gql`
  ${CARD_CORE_FIELDS}
  mutation CreateCard($input: CreateCardInput!) {
    createCard(input: $input) {
      ...CardCoreFields
    }
  }
`;

/**
 * Update existing card
 * Aligns with CardActions.updateCard()
 */
export const UPDATE_CARD = gql`
  ${CARD_CORE_FIELDS}
  mutation UpdateCard($id: ID!, $input: UpdateCardInput!) {
    updateCard(id: $id, input: $input) {
      ...CardCoreFields
    }
  }
`;

/**
 * Delete card
 * Aligns with CardActions.deleteCard()
 */
export const DELETE_CARD = gql`
  mutation DeleteCard($id: ID!) {
    deleteCard(id: $id)
  }
`;

/**
 * Duplicate card with optional offset
 * Aligns with CardActions.duplicateCard()
 */
export const DUPLICATE_CARD = gql`
  ${CARD_CORE_FIELDS}
  mutation DuplicateCard($id: ID!, $offset: PositionInput) {
    duplicateCard(id: $id, offset: $offset) {
      ...CardCoreFields
    }
  }
`;

/**
 * Batch update card positions for performance
 * Aligns with frontend bulk operations
 */
export const BATCH_UPDATE_CARD_POSITIONS = gql`
  ${CARD_CORE_FIELDS}
  mutation BatchUpdateCardPositions($updates: [CardPositionUpdate!]!) {
    batchUpdateCardPositions(updates: $updates) {
      ...CardCoreFields
    }
  }
`;

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to card created events
 * Aligns with frontend real-time store updates
 */
export const CARD_CREATED_SUBSCRIPTION = gql`
  ${CARD_CORE_FIELDS}
  subscription CardCreated($workspaceId: ID!) {
    cardCreated(workspaceId: $workspaceId) {
      ...CardCoreFields
    }
  }
`;

/**
 * Subscribe to card updated events
 * Aligns with frontend real-time store updates
 */
export const CARD_UPDATED_SUBSCRIPTION = gql`
  ${CARD_CORE_FIELDS}
  subscription CardUpdated($workspaceId: ID!) {
    cardUpdated(workspaceId: $workspaceId) {
      ...CardCoreFields
    }
  }
`;

/**
 * Subscribe to card deleted events
 * Aligns with frontend card store deletion handling
 */
export const CARD_DELETED_SUBSCRIPTION = gql`
  subscription CardDeleted($workspaceId: ID!) {
    cardDeleted(workspaceId: $workspaceId)
  }
`;

/**
 * Subscribe to card moved events (position-only updates)
 * For performance optimization
 */
export const CARD_MOVED_SUBSCRIPTION = gql`
  ${CARD_CORE_FIELDS}
  subscription CardMoved($workspaceId: ID!) {
    cardMoved(workspaceId: $workspaceId) {
      id
      position {
        x
        y
        z
      }
      version
    }
  }
`;

/**
 * Subscribe to user canvas events for collaborative editing
 */
export const USER_JOINED_CANVAS_SUBSCRIPTION = gql`
  subscription UserJoinedCanvas($workspaceId: ID!) {
    userJoinedCanvas(workspaceId: $workspaceId) {
      id
      email
      displayName
      avatarUrl
    }
  }
`;

export const USER_LEFT_CANVAS_SUBSCRIPTION = gql`
  subscription UserLeftCanvas($workspaceId: ID!) {
    userLeftCanvas(workspaceId: $workspaceId)
  }
`;

// ============================================================================
// TYPE DEFINITIONS FOR TYPESCRIPT
// ============================================================================

export interface CardQueryVariables {
  id: string;
}

export interface CardsQueryVariables {
  workspaceId: string;
  filter?: {
    types?: ('TEXT' | 'IMAGE' | 'LINK' | 'CODE')[];
    status?: ('DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'DELETED')[];
    priority?: ('LOW' | 'NORMAL' | 'HIGH' | 'URGENT')[];
    tags?: string[];
    searchQuery?: string;
    bounds?: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    };
    createdDateRange?: {
      start: string;
      end: string;
    };
    updatedDateRange?: {
      start: string;
      end: string;
    };
    ownerId?: string;
  };
  pagination?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  };
}

export interface SearchCardsQueryVariables {
  workspaceId: string;
  query: string;
  limit?: number;
}

export interface CardsInBoundsQueryVariables {
  workspaceId: string;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface CreateCardMutationVariables {
  input: {
    workspaceId: string;
    type: 'text' | 'image' | 'link' | 'code' | 'file' | 'drawing';
    title?: string;
    content?: string;
    position: {
      x: number;
      y: number;
      z: number;
    };
    dimensions?: {
      width: number;
      height: number;
    };
    style?: {
      backgroundColor?: string;
      borderColor?: string;
      textColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      opacity?: number;
      shadow?: boolean;
    };
    tags?: string[];
    metadata?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  };
}

export interface UpdateCardMutationVariables {
  id: string;
  input: {
    title?: string;
    content?: string;
    position?: {
      x: number;
      y: number;
      z: number;
    };
    dimensions?: {
      width: number;
      height: number;
    };
    style?: {
      backgroundColor?: string;
      borderColor?: string;
      textColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      opacity?: number;
      shadow?: boolean;
    };
    tags?: string[];
    metadata?: Record<string, any>;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'DELETED';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  };
}

export interface DeleteCardMutationVariables {
  id: string;
}

export interface DuplicateCardMutationVariables {
  id: string;
  offset?: {
    x: number;
    y: number;
  };
}

export interface BatchUpdateCardPositionsMutationVariables {
  updates: Array<{
    cardId: string;
    position: {
      x: number;
      y: number;
    };
  }>;
}

export interface CardSubscriptionVariables {
  workspaceId: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface CardResponse {
  id: string;
  workspaceId: string;
  ownerId: string;
  title?: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'LINK' | 'CODE';
  position: {
    x: number;
    y: number;
    z: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  style: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
    shadow: boolean;
  };
  tags: string[];
  metadata: Record<string, any>;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  version: number;
  workspace?: {
    id: string;
    name: string;
    ownerId: string;
  };
  owner?: {
    id: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface CardsConnectionResponse {
  items: CardResponse[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export {
  CARD_CORE_FIELDS,
  CARD_WITH_RELATIONS,
};
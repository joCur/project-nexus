/**
 * GraphQL operations for connection management
 * Integrates with backend connection resolvers and aligns with ConnectionActions interface
 * 
 * Key Features:
 * - Comprehensive fragments for reusability
 * - Full CRUD operations with proper authorization
 * - Batch operations for performance
 * - Real-time subscriptions for collaborative features
 * - TypeScript typing for type safety
 */

import { gql } from '@apollo/client';

// ============================================================================
// FRAGMENTS
// ============================================================================

/**
 * Core connection fields fragment
 * Essential fields for all connection queries
 */
export const CONNECTION_FRAGMENT = gql`
  fragment ConnectionFragment on Connection {
    id
    sourceCardId
    targetCardId
    type
    confidence
    metadata
    isVisible
    aiReasoning
    keywords
    concepts
    createdAt
    updatedAt
  }
`;

/**
 * Connection styling fragment
 * Visual styling properties for connection rendering
 */
export const CONNECTION_STYLE_FRAGMENT = gql`
  fragment ConnectionStyleFragment on ConnectionStyle {
    color
    width
    opacity
    dashArray
    curve
    showArrow
    showLabel
  }
`;

/**
 * Connection label fragment
 * Label configuration for connection text display
 */
export const CONNECTION_LABEL_FRAGMENT = gql`
  fragment ConnectionLabelFragment on ConnectionLabel {
    text
    position
    backgroundColor
    textColor
    fontSize
  }
`;

/**
 * Complete connection fragment with relationships
 * Includes all connection data plus related entities
 */
export const FULL_CONNECTION_FRAGMENT = gql`
  ${CONNECTION_FRAGMENT}
  ${CONNECTION_STYLE_FRAGMENT}
  ${CONNECTION_LABEL_FRAGMENT}
  fragment FullConnectionFragment on Connection {
    ...ConnectionFragment
    style {
      ...ConnectionStyleFragment
    }
    label {
      ...ConnectionLabelFragment
    }
    sourceCard {
      id
      title
      type
      position {
        x
        y
        z
      }
    }
    targetCard {
      id
      title
      type
      position {
        x
        y
        z
      }
    }
    createdBy {
      id
      email
      displayName
      avatarUrl
    }
  }
`;

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Get single connection by ID
 * Aligns with ConnectionActions.getConnection()
 */
export const GET_CONNECTION = gql`
  ${FULL_CONNECTION_FRAGMENT}
  query GetConnection($id: ID!) {
    connection(id: $id) {
      ...FullConnectionFragment
    }
  }
`;

/**
 * Get connections with filtering and pagination
 * Aligns with ConnectionActions.getConnections()
 */
export const GET_CONNECTIONS = gql`
  ${CONNECTION_FRAGMENT}
  ${CONNECTION_STYLE_FRAGMENT}
  ${CONNECTION_LABEL_FRAGMENT}
  query GetConnections(
    $workspaceId: ID!
    $filter: ConnectionFilter
    $pagination: PaginationInput
  ) {
    connections(
      workspaceId: $workspaceId
      filter: $filter
      pagination: $pagination
    ) {
      items {
        ...ConnectionFragment
        style {
          ...ConnectionStyleFragment
        }
        label {
          ...ConnectionLabelFragment
        }
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
 * Get all connections for a specific card
 * For card-centric connection management
 */
export const GET_CARD_CONNECTIONS = gql`
  ${CONNECTION_FRAGMENT}
  ${CONNECTION_STYLE_FRAGMENT}
  ${CONNECTION_LABEL_FRAGMENT}
  query GetCardConnections($cardId: ID!) {
    cardConnections(cardId: $cardId) {
      ...ConnectionFragment
      style {
        ...ConnectionStyleFragment
      }
      label {
        ...ConnectionLabelFragment
      }
      sourceCard {
        id
        title
        type
      }
      targetCard {
        id
        title
        type
      }
    }
  }
`;

/**
 * Get connection count for workspace
 * For analytics and workspace overview
 */
export const GET_CONNECTION_COUNT = gql`
  query GetConnectionCount($workspaceId: ID!) {
    connectionCount(workspaceId: $workspaceId)
  }
`;

// ============================================================================
// MUTATION OPERATIONS
// ============================================================================

/**
 * Create new connection
 * Aligns with ConnectionActions.createConnection()
 */
export const CREATE_CONNECTION = gql`
  ${FULL_CONNECTION_FRAGMENT}
  mutation CreateConnection($input: CreateConnectionInput!) {
    createConnection(input: $input) {
      ...FullConnectionFragment
    }
  }
`;

/**
 * Update existing connection
 * Aligns with ConnectionActions.updateConnection()
 */
export const UPDATE_CONNECTION = gql`
  ${FULL_CONNECTION_FRAGMENT}
  mutation UpdateConnection($id: ID!, $input: UpdateConnectionInput!) {
    updateConnection(id: $id, input: $input) {
      ...FullConnectionFragment
    }
  }
`;

/**
 * Delete connection
 * Aligns with ConnectionActions.deleteConnection()
 */
export const DELETE_CONNECTION = gql`
  mutation DeleteConnection($id: ID!) {
    deleteConnection(id: $id)
  }
`;

/**
 * Batch create multiple connections
 * For performance optimization with bulk operations
 */
export const BATCH_CREATE_CONNECTIONS = gql`
  ${CONNECTION_FRAGMENT}
  ${CONNECTION_STYLE_FRAGMENT}
  ${CONNECTION_LABEL_FRAGMENT}
  mutation BatchCreateConnections($connections: [CreateConnectionInput!]!) {
    batchCreateConnections(connections: $connections) {
      successful {
        ...ConnectionFragment
        style {
          ...ConnectionStyleFragment
        }
        label {
          ...ConnectionLabelFragment
        }
      }
      failed {
        input
        error
      }
      totalProcessed
      processingTimeMs
    }
  }
`;

/**
 * Batch update multiple connections
 * For performance optimization with bulk operations
 */
export const BATCH_UPDATE_CONNECTIONS = gql`
  ${CONNECTION_FRAGMENT}
  ${CONNECTION_STYLE_FRAGMENT}
  ${CONNECTION_LABEL_FRAGMENT}
  mutation BatchUpdateConnections($updates: [BatchConnectionUpdate!]!) {
    batchUpdateConnections(updates: $updates) {
      successful {
        ...ConnectionFragment
        style {
          ...ConnectionStyleFragment
        }
        label {
          ...ConnectionLabelFragment
        }
      }
      failed {
        input
        error
      }
      totalProcessed
      processingTimeMs
    }
  }
`;

/**
 * Batch delete multiple connections
 * For performance optimization with bulk operations
 */
export const BATCH_DELETE_CONNECTIONS = gql`
  mutation BatchDeleteConnections($connectionIds: [ID!]!) {
    batchDeleteConnections(connectionIds: $connectionIds) {
      successful
      failed {
        input
        error
      }
      totalProcessed
      processingTimeMs
    }
  }
`;

// ============================================================================
// SUBSCRIPTION OPERATIONS
// ============================================================================

/**
 * Subscribe to connection created events
 * For real-time connection creation updates
 */
export const CONNECTION_CREATED_SUBSCRIPTION = gql`
  ${FULL_CONNECTION_FRAGMENT}
  subscription ConnectionCreated($workspaceId: ID!) {
    connectionCreated(workspaceId: $workspaceId) {
      ...FullConnectionFragment
    }
  }
`;

/**
 * Subscribe to connection updated events
 * For real-time connection modification updates
 */
export const CONNECTION_UPDATED_SUBSCRIPTION = gql`
  ${FULL_CONNECTION_FRAGMENT}
  subscription ConnectionUpdated($workspaceId: ID!) {
    connectionUpdated(workspaceId: $workspaceId) {
      ...FullConnectionFragment
    }
  }
`;

/**
 * Subscribe to connection deleted events
 * For real-time connection deletion updates
 */
export const CONNECTION_DELETED_SUBSCRIPTION = gql`
  subscription ConnectionDeleted($workspaceId: ID!) {
    connectionDeleted(workspaceId: $workspaceId)
  }
`;

// ============================================================================
// TYPESCRIPT VARIABLE TYPES
// ============================================================================

// Query Variables
export interface ConnectionQueryVariables {
  id: string;
}

export interface ConnectionsQueryVariables {
  workspaceId: string;
  filter?: {
    types?: ('MANUAL' | 'AI_SUGGESTED' | 'AI_GENERATED' | 'REFERENCE' | 'DEPENDENCY' | 'SIMILARITY' | 'RELATED')[];
    minConfidence?: number;
    maxConfidence?: number;
    sourceCardIds?: string[];
    targetCardIds?: string[];
    createdBy?: string;
    isVisible?: boolean;
    createdAfter?: string;
    createdBefore?: string;
    hasAIReasoning?: boolean;
    keywords?: string[];
    concepts?: string[];
  };
  pagination?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  };
}

export interface CardConnectionsQueryVariables {
  cardId: string;
}

export interface ConnectionCountQueryVariables {
  workspaceId: string;
}

// Mutation Variables
export interface CreateConnectionMutationVariables {
  input: {
    sourceCardId: string;
    targetCardId: string;
    type?: 'MANUAL' | 'AI_SUGGESTED' | 'AI_GENERATED' | 'REFERENCE' | 'DEPENDENCY' | 'SIMILARITY' | 'RELATED';
    confidence?: number;
    style?: {
      color?: string;
      width?: number;
      opacity?: number;
      dashArray?: string;
      curve?: string;
      showArrow?: boolean;
      showLabel?: boolean;
    };
    label?: {
      text: string;
      position: string;
      backgroundColor?: string;
      textColor?: string;
      fontSize: number;
    };
    metadata?: Record<string, any>;
    aiReasoning?: string;
    keywords?: string[];
    concepts?: string[];
  };
}

export interface UpdateConnectionMutationVariables {
  id: string;
  input: {
    type?: 'MANUAL' | 'AI_SUGGESTED' | 'AI_GENERATED' | 'REFERENCE' | 'DEPENDENCY' | 'SIMILARITY' | 'RELATED';
    confidence?: number;
    style?: {
      color?: string;
      width?: number;
      opacity?: number;
      dashArray?: string;
      curve?: string;
      showArrow?: boolean;
      showLabel?: boolean;
    };
    label?: {
      text: string;
      position: string;
      backgroundColor?: string;
      textColor?: string;
      fontSize: number;
    };
    metadata?: Record<string, any>;
    isVisible?: boolean;
    aiReasoning?: string;
    keywords?: string[];
    concepts?: string[];
  };
}

export interface DeleteConnectionMutationVariables {
  id: string;
}

export interface BatchCreateConnectionsMutationVariables {
  connections: Array<{
    sourceCardId: string;
    targetCardId: string;
    type?: 'MANUAL' | 'AI_SUGGESTED' | 'AI_GENERATED' | 'REFERENCE' | 'DEPENDENCY' | 'SIMILARITY' | 'RELATED';
    confidence?: number;
    style?: {
      color?: string;
      width?: number;
      opacity?: number;
      dashArray?: string;
      curve?: string;
      showArrow?: boolean;
      showLabel?: boolean;
    };
    label?: {
      text: string;
      position: string;
      backgroundColor?: string;
      textColor?: string;
      fontSize: number;
    };
    metadata?: Record<string, any>;
    aiReasoning?: string;
    keywords?: string[];
    concepts?: string[];
  }>;
}

export interface BatchUpdateConnectionsMutationVariables {
  updates: Array<{
    connectionId: string;
    updates: {
      type?: 'MANUAL' | 'AI_SUGGESTED' | 'AI_GENERATED' | 'REFERENCE' | 'DEPENDENCY' | 'SIMILARITY' | 'RELATED';
      confidence?: number;
      style?: {
        color?: string;
        width?: number;
        opacity?: number;
        dashArray?: string;
        curve?: string;
        showArrow?: boolean;
        showLabel?: boolean;
      };
      label?: {
        text: string;
        position: string;
        backgroundColor?: string;
        textColor?: string;
        fontSize: number;
      };
      metadata?: Record<string, any>;
      isVisible?: boolean;
      aiReasoning?: string;
      keywords?: string[];
      concepts?: string[];
    };
  }>;
}

export interface BatchDeleteConnectionsMutationVariables {
  connectionIds: string[];
}

// Subscription Variables
export interface ConnectionSubscriptionVariables {
  workspaceId: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ConnectionResponse {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  type: 'MANUAL' | 'AI_SUGGESTED' | 'AI_GENERATED' | 'REFERENCE' | 'DEPENDENCY' | 'SIMILARITY' | 'RELATED';
  confidence: number;
  style: {
    color: string;
    width: number;
    opacity: number;
    dashArray?: string;
    curve: string;
    showArrow: boolean;
    showLabel: boolean;
  };
  label?: {
    text: string;
    position: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize: number;
  };
  metadata: Record<string, any>;
  isVisible: boolean;
  aiReasoning?: string;
  keywords: string[];
  concepts: string[];
  createdAt: string;
  updatedAt: string;
  sourceCard?: {
    id: string;
    title?: string;
    type: string;
    position?: {
      x: number;
      y: number;
      z: number;
    };
  };
  targetCard?: {
    id: string;
    title?: string;
    type: string;
    position?: {
      x: number;
      y: number;
      z: number;
    };
  };
  createdBy?: {
    id: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface ConnectionsConnectionResponse {
  items: ConnectionResponse[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BatchConnectionResult<T> {
  successful: T[];
  failed: Array<{
    input: any;
    error: string;
  }>;
  totalProcessed: number;
  processingTimeMs: number;
}

// All fragments and operations are already exported with 'export const' above
// No need for separate export block
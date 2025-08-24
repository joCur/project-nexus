/**
 * Optimized GraphQL Canvas Operations (NEX-177)
 * 
 * Performance-optimized GraphQL operations for multi-canvas functionality including:
 * - Query batching and deduplication
 * - Fragment optimization
 * - Pagination improvements
 * - Cache management
 * - Real-time subscription optimization
 */

import { gql, TypedDocumentNode } from '@apollo/client';
import { 
  Canvas, 
  Card, 
  Connection,
  PaginatedCanvasResponse,
  CanvasFilter,
  PaginationInput 
} from '@/types/canvas.types';
import type { EntityId } from '@/types/common.types';
import type { CanvasId } from '@/types/workspace.types';

// Optimized fragments for better caching
export const CANVAS_CORE_FRAGMENT = gql`
  fragment CanvasCore on Canvas {
    id
    workspaceId
    name
    description
    version
    createdAt
    updatedAt
  }
`;

export const CANVAS_SETTINGS_FRAGMENT = gql`
  fragment CanvasSettings on Canvas {
    settings {
      isDefault
      position {
        x
        y
        z
      }
      zoom
      grid {
        enabled
        size
        color
        opacity
      }
      background {
        type
        color
        image
        opacity
      }
    }
  }
`;

export const CANVAS_METADATA_FRAGMENT = gql`
  fragment CanvasMetadata on Canvas {
    metadata
    stats {
      cardCount
      connectionCount
      lastActivity
      collaborators
    }
  }
`;

export const CANVAS_FULL_FRAGMENT = gql`
  fragment CanvasFull on Canvas {
    ...CanvasCore
    ...CanvasSettings
    ...CanvasMetadata
  }
  ${CANVAS_CORE_FRAGMENT}
  ${CANVAS_SETTINGS_FRAGMENT}
  ${CANVAS_METADATA_FRAGMENT}
`;

export const CARD_CORE_FRAGMENT = gql`
  fragment CardCore on Card {
    id
    canvasId
    workspaceId
    type
    title
    content
    version
    createdAt
    updatedAt
  }
`;

export const CARD_POSITION_FRAGMENT = gql`
  fragment CardPosition on Card {
    position {
      x
      y
      z
    }
    size {
      width
      height
    }
  }
`;

export const CARD_STYLE_FRAGMENT = gql`
  fragment CardStyle on Card {
    style {
      backgroundColor
      textColor
      borderColor
      borderWidth
      borderRadius
      fontFamily
      fontSize
      fontWeight
      textAlign
    }
  }
`;

export const CARD_FULL_FRAGMENT = gql`
  fragment CardFull on Card {
    ...CardCore
    ...CardPosition
    ...CardStyle
    metadata
    tags
  }
  ${CARD_CORE_FRAGMENT}
  ${CARD_POSITION_FRAGMENT}
  ${CARD_STYLE_FRAGMENT}
`;

// Optimized queries with proper fragmentation
export const GET_WORKSPACE_CANVASES_OPTIMIZED: TypedDocumentNode<
  { workspaceCanvases: PaginatedCanvasResponse },
  { 
    workspaceId: EntityId; 
    filter?: CanvasFilter;
    pagination?: PaginationInput;
    includeStats?: boolean;
  }
> = gql`
  query GetWorkspaceCanvasesOptimized(
    $workspaceId: ID!
    $filter: CanvasFilter
    $pagination: PaginationInput
    $includeStats: Boolean = false
  ) {
    workspaceCanvases(
      workspaceId: $workspaceId
      filter: $filter
      pagination: $pagination
    ) {
      items {
        ...CanvasCore
        ...CanvasSettings
        ...CanvasMetadata @include(if: $includeStats)
      }
      totalCount
      page
      limit
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
  ${CANVAS_CORE_FRAGMENT}
  ${CANVAS_SETTINGS_FRAGMENT}
  ${CANVAS_METADATA_FRAGMENT}
`;

export const GET_CANVAS_LIGHTWEIGHT: TypedDocumentNode<
  { canvas: Canvas },
  { id: CanvasId }
> = gql`
  query GetCanvasLightweight($id: ID!) {
    canvas(id: $id) {
      ...CanvasCore
      ...CanvasSettings
    }
  }
  ${CANVAS_CORE_FRAGMENT}
  ${CANVAS_SETTINGS_FRAGMENT}
`;

export const GET_CANVAS_WITH_STATS: TypedDocumentNode<
  { canvas: Canvas },
  { id: CanvasId }
> = gql`
  query GetCanvasWithStats($id: ID!) {
    canvas(id: $id) {
      ...CanvasFull
    }
  }
  ${CANVAS_FULL_FRAGMENT}
`;

export const GET_MULTIPLE_CANVASES: TypedDocumentNode<
  { canvases: Canvas[] },
  { ids: CanvasId[] }
> = gql`
  query GetMultipleCanvases($ids: [ID!]!) {
    canvases(ids: $ids) {
      ...CanvasCore
      ...CanvasSettings
    }
  }
  ${CANVAS_CORE_FRAGMENT}
  ${CANVAS_SETTINGS_FRAGMENT}
`;

export const GET_CANVAS_CARDS_PAGINATED: TypedDocumentNode<
  { canvasCards: { items: Card[]; totalCount: number; hasNextPage: boolean } },
  { 
    canvasId: CanvasId; 
    pagination?: PaginationInput;
    viewport?: { x: number; y: number; width: number; height: number };
  }
> = gql`
  query GetCanvasCardsPaginated(
    $canvasId: ID!
    $pagination: PaginationInput
    $viewport: ViewportInput
  ) {
    canvasCards(
      canvasId: $canvasId
      pagination: $pagination
      viewport: $viewport
    ) {
      items {
        ...CardFull
      }
      totalCount
      hasNextPage
    }
  }
  ${CARD_FULL_FRAGMENT}
`;

export const GET_CANVAS_CARDS_IN_VIEWPORT: TypedDocumentNode<
  { canvasCardsInViewport: Card[] },
  { 
    canvasId: CanvasId; 
    viewport: { x: number; y: number; width: number; height: number; buffer?: number };
  }
> = gql`
  query GetCanvasCardsInViewport($canvasId: ID!, $viewport: ViewportInput!) {
    canvasCardsInViewport(canvasId: $canvasId, viewport: $viewport) {
      ...CardCore
      ...CardPosition
    }
  }
  ${CARD_CORE_FRAGMENT}
  ${CARD_POSITION_FRAGMENT}
`;

// Batch query for initial canvas load
export const GET_CANVAS_INITIAL_DATA: TypedDocumentNode<
  {
    canvas: Canvas;
    canvasCards: { items: Card[]; totalCount: number };
    canvasConnections: Connection[];
  },
  { 
    canvasId: CanvasId;
    viewport?: { x: number; y: number; width: number; height: number };
  }
> = gql`
  query GetCanvasInitialData($canvasId: ID!, $viewport: ViewportInput) {
    canvas(id: $canvasId) {
      ...CanvasFull
    }
    canvasCards(canvasId: $canvasId, viewport: $viewport, pagination: { limit: 50 }) {
      items {
        ...CardFull
      }
      totalCount
    }
    canvasConnections(canvasId: $canvasId) {
      id
      canvasId
      sourceCardId
      targetCardId
      type
      properties
    }
  }
  ${CANVAS_FULL_FRAGMENT}
  ${CARD_FULL_FRAGMENT}
`;

// Optimized mutations with minimal return data
export const CREATE_CANVAS_OPTIMIZED: TypedDocumentNode<
  { createCanvas: Canvas },
  { input: any }
> = gql`
  mutation CreateCanvasOptimized($input: CreateCanvasInput!) {
    createCanvas(input: $input) {
      ...CanvasCore
      ...CanvasSettings
    }
  }
  ${CANVAS_CORE_FRAGMENT}
  ${CANVAS_SETTINGS_FRAGMENT}
`;

export const UPDATE_CANVAS_SETTINGS_OPTIMIZED: TypedDocumentNode<
  { updateCanvasSettings: Canvas },
  { id: CanvasId; settings: any }
> = gql`
  mutation UpdateCanvasSettingsOptimized($id: ID!, $settings: CanvasSettingsInput!) {
    updateCanvasSettings(id: $id, settings: $settings) {
      id
      version
      ...CanvasSettings
    }
  }
  ${CANVAS_SETTINGS_FRAGMENT}
`;

export const BULK_UPDATE_CARDS: TypedDocumentNode<
  { bulkUpdateCards: Card[] },
  { updates: Array<{ id: EntityId; changes: any }> }
> = gql`
  mutation BulkUpdateCards($updates: [CardUpdateInput!]!) {
    bulkUpdateCards(updates: $updates) {
      ...CardCore
      ...CardPosition
      version
    }
  }
  ${CARD_CORE_FRAGMENT}
  ${CARD_POSITION_FRAGMENT}
`;

// Real-time subscriptions with optimized payloads
export const CANVAS_CHANGES_SUBSCRIPTION: TypedDocumentNode<
  { canvasChanged: { type: string; canvas?: Canvas; cardId?: EntityId } },
  { workspaceId: EntityId; canvasIds?: CanvasId[] }
> = gql`
  subscription CanvasChangesSubscription($workspaceId: ID!, $canvasIds: [ID!]) {
    canvasChanged(workspaceId: $workspaceId, canvasIds: $canvasIds) {
      type
      canvas {
        ...CanvasCore
        ...CanvasSettings
      }
      cardId
      timestamp
    }
  }
  ${CANVAS_CORE_FRAGMENT}
  ${CANVAS_SETTINGS_FRAGMENT}
`;

export const CANVAS_COLLABORATION_SUBSCRIPTION: TypedDocumentNode<
  { 
    canvasCollaboration: {
      type: 'user_joined' | 'user_left' | 'cursor_moved' | 'selection_changed';
      userId: string;
      canvasId: CanvasId;
      data?: any;
    }
  },
  { canvasId: CanvasId }
> = gql`
  subscription CanvasCollaborationSubscription($canvasId: ID!) {
    canvasCollaboration(canvasId: $canvasId) {
      type
      userId
      canvasId
      data
      timestamp
    }
  }
`;

// Optimized query builders
export class OptimizedCanvasQueries {
  // Build paginated canvas query with smart defaults
  static buildCanvasListQuery(
    workspaceId: EntityId,
    options: {
      includeStats?: boolean;
      pageSize?: number;
      filter?: CanvasFilter;
    } = {}
  ) {
    const { includeStats = false, pageSize = 20, filter } = options;

    return {
      query: GET_WORKSPACE_CANVASES_OPTIMIZED,
      variables: {
        workspaceId,
        filter,
        pagination: { limit: pageSize, page: 0 },
        includeStats,
      },
      fetchPolicy: 'cache-first' as const,
      nextFetchPolicy: 'cache-first' as const,
    };
  }

  // Build viewport-aware card query
  static buildViewportCardQuery(
    canvasId: CanvasId,
    viewport: { x: number; y: number; width: number; height: number },
    buffer: number = 200
  ) {
    return {
      query: GET_CANVAS_CARDS_IN_VIEWPORT,
      variables: {
        canvasId,
        viewport: {
          x: viewport.x - buffer,
          y: viewport.y - buffer,
          width: viewport.width + buffer * 2,
          height: viewport.height + buffer * 2,
          buffer,
        },
      },
      fetchPolicy: 'cache-first' as const,
    };
  }

  // Build batch query for canvas switching
  static buildCanvasSwitchQuery(fromCanvasId: CanvasId, toCanvasId: CanvasId) {
    return {
      query: GET_MULTIPLE_CANVASES,
      variables: {
        ids: [fromCanvasId, toCanvasId],
      },
      fetchPolicy: 'cache-first' as const,
    };
  }

  // Build optimized initial load query
  static buildInitialLoadQuery(
    canvasId: CanvasId,
    viewport?: { x: number; y: number; width: number; height: number }
  ) {
    return {
      query: GET_CANVAS_INITIAL_DATA,
      variables: {
        canvasId,
        viewport,
      },
      fetchPolicy: 'cache-and-network' as const,
      errorPolicy: 'all' as const,
    };
  }
}

// Cache management utilities
export class CanvasCacheManager {
  static evictCanvasCache(client: any, canvasId: CanvasId) {
    client.cache.evict({
      id: client.cache.identify({ __typename: 'Canvas', id: canvasId }),
    });
  }

  static updateCanvasInCache(
    client: any,
    canvasId: CanvasId,
    updater: (existingCanvas: Canvas) => Canvas
  ) {
    const canvasRef = client.cache.writeFragment({
      id: client.cache.identify({ __typename: 'Canvas', id: canvasId }),
      fragment: CANVAS_CORE_FRAGMENT,
      data: updater,
    });

    return canvasRef;
  }

  static optimisticUpdateCanvas(
    client: any,
    canvasId: CanvasId,
    optimisticData: Partial<Canvas>
  ) {
    client.cache.writeFragment({
      id: client.cache.identify({ __typename: 'Canvas', id: canvasId }),
      fragment: CANVAS_CORE_FRAGMENT,
      data: {
        __typename: 'Canvas',
        id: canvasId,
        ...optimisticData,
      },
    });
  }

  static prefetchCanvasData(client: any, canvasId: CanvasId) {
    return client.query({
      query: GET_CANVAS_LIGHTWEIGHT,
      variables: { id: canvasId },
      fetchPolicy: 'cache-first',
    });
  }

  static warmCanvasCache(client: any, canvasIds: CanvasId[]) {
    return Promise.all(
      canvasIds.map(canvasId => this.prefetchCanvasData(client, canvasId))
    );
  }
}

// Query planning utilities
export class QueryPlanner {
  static planCanvasTransition(
    fromCanvasId: CanvasId | null,
    toCanvasId: CanvasId,
    client: any
  ) {
    const plan = {
      prefetchQueries: [] as any[],
      cacheWarming: [] as any[],
      subscriptions: [] as any[],
    };

    // 1. Prefetch target canvas if not in cache
    const canvasInCache = client.cache.readFragment({
      id: client.cache.identify({ __typename: 'Canvas', id: toCanvasId }),
      fragment: CANVAS_CORE_FRAGMENT,
    });

    if (!canvasInCache) {
      plan.prefetchQueries.push({
        query: GET_CANVAS_LIGHTWEIGHT,
        variables: { id: toCanvasId },
      });
    }

    // 2. Warm cache with initial viewport data
    plan.cacheWarming.push({
      query: GET_CANVAS_CARDS_IN_VIEWPORT,
      variables: {
        canvasId: toCanvasId,
        viewport: { x: 0, y: 0, width: 1920, height: 1080, buffer: 500 },
      },
    });

    // 3. Set up subscriptions for real-time updates
    plan.subscriptions.push({
      subscription: CANVAS_CHANGES_SUBSCRIPTION,
      variables: { canvasIds: [toCanvasId] },
    });

    return plan;
  }

  static estimateQueryCost(queryDoc: any, variables: any): number {
    // Simple heuristic for query complexity
    const queryString = queryDoc.loc?.source?.body || '';
    const fieldCount = (queryString.match(/\{/g) || []).length;
    const fragmentCount = (queryString.match(/\.\.\./g) || []).length;
    
    let cost = fieldCount * 1;
    cost += fragmentCount * 0.5;
    
    // Adjust based on variables
    if (variables) {
      if (variables.pagination?.limit) {
        cost += variables.pagination.limit * 0.1;
      }
      if (variables.includeStats) {
        cost += 5;
      }
    }

    return Math.ceil(cost);
  }
}

export default {
  // Fragments
  CANVAS_CORE_FRAGMENT,
  CANVAS_SETTINGS_FRAGMENT,
  CANVAS_METADATA_FRAGMENT,
  CANVAS_FULL_FRAGMENT,
  CARD_CORE_FRAGMENT,
  CARD_POSITION_FRAGMENT,
  CARD_STYLE_FRAGMENT,
  CARD_FULL_FRAGMENT,

  // Optimized queries
  GET_WORKSPACE_CANVASES_OPTIMIZED,
  GET_CANVAS_LIGHTWEIGHT,
  GET_CANVAS_WITH_STATS,
  GET_MULTIPLE_CANVASES,
  GET_CANVAS_CARDS_PAGINATED,
  GET_CANVAS_CARDS_IN_VIEWPORT,
  GET_CANVAS_INITIAL_DATA,

  // Optimized mutations
  CREATE_CANVAS_OPTIMIZED,
  UPDATE_CANVAS_SETTINGS_OPTIMIZED,
  BULK_UPDATE_CARDS,

  // Subscriptions
  CANVAS_CHANGES_SUBSCRIPTION,
  CANVAS_COLLABORATION_SUBSCRIPTION,

  // Utilities
  OptimizedCanvasQueries,
  CanvasCacheManager,
  QueryPlanner,
};
/**
 * GraphQL operations for canvas management
 * Integrates with backend canvas resolvers and aligns with CanvasActions interface
 */

import { gql } from '@apollo/client';

// ============================================================================
// FRAGMENTS
// ============================================================================

/**
 * Core canvas fragment with all essential fields
 * Matches backend Canvas type and frontend expectations
 */
const CANVAS_CORE_FIELDS = gql`
  fragment CanvasCoreFields on Canvas {
    id
    workspaceId
    name
    description
    isDefault
    position
    createdBy
    createdAt
    updatedAt
  }
`;

/**
 * Extended canvas fragment with relationships
 */
const CANVAS_WITH_RELATIONS = gql`
  ${CANVAS_CORE_FIELDS}
  fragment CanvasWithRelations on Canvas {
    ...CanvasCoreFields
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
 * Get workspace canvases with pagination and filtering
 * Aligns with CanvasActions.getWorkspaceCanvases()
 */
export const GET_WORKSPACE_CANVASES = gql`
  ${CANVAS_CORE_FIELDS}
  query GetWorkspaceCanvases(
    $workspaceId: ID!
    $filter: CanvasFilter
    $pagination: PaginationInput
  ) {
    workspaceCanvases(
      workspaceId: $workspaceId
      filter: $filter
      pagination: $pagination
    ) {
      items {
        ...CanvasCoreFields
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
 * Get single canvas by ID
 * Aligns with CanvasActions.getCanvas()
 */
export const GET_CANVAS = gql`
  ${CANVAS_WITH_RELATIONS}
  query GetCanvas($id: ID!) {
    canvas(id: $id) {
      ...CanvasWithRelations
    }
  }
`;

/**
 * Get default canvas for workspace
 * Aligns with CanvasActions.getDefaultCanvas()
 */
export const GET_DEFAULT_CANVAS = gql`
  ${CANVAS_CORE_FIELDS}
  query GetDefaultCanvas($workspaceId: ID!) {
    defaultCanvas(workspaceId: $workspaceId) {
      ...CanvasCoreFields
    }
  }
`;

/**
 * Search canvases by text query
 * For canvas discovery and navigation
 */
export const SEARCH_CANVASES = gql`
  ${CANVAS_CORE_FIELDS}
  query SearchCanvases(
    $workspaceId: ID!
    $query: String!
    $limit: Int
  ) {
    searchCanvases(
      workspaceId: $workspaceId
      query: $query
      limit: $limit
    ) {
      ...CanvasCoreFields
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create new canvas
 * Aligns with CanvasActions.createCanvas()
 */
export const CREATE_CANVAS = gql`
  ${CANVAS_CORE_FIELDS}
  mutation CreateCanvas($input: CreateCanvasInput!) {
    createCanvas(input: $input) {
      ...CanvasCoreFields
    }
  }
`;

/**
 * Update existing canvas
 * Aligns with CanvasActions.updateCanvas()
 */
export const UPDATE_CANVAS = gql`
  ${CANVAS_CORE_FIELDS}
  mutation UpdateCanvas($id: ID!, $input: UpdateCanvasInput!) {
    updateCanvas(id: $id, input: $input) {
      ...CanvasCoreFields
    }
  }
`;

/**
 * Delete canvas
 * Aligns with CanvasActions.deleteCanvas()
 */
export const DELETE_CANVAS = gql`
  mutation DeleteCanvas($id: ID!) {
    deleteCanvas(id: $id)
  }
`;

/**
 * Set default canvas for workspace
 * Aligns with CanvasActions.setDefaultCanvas()
 */
export const SET_DEFAULT_CANVAS = gql`
  ${CANVAS_CORE_FIELDS}
  mutation SetDefaultCanvas($workspaceId: ID!, $canvasId: ID!) {
    setDefaultCanvas(workspaceId: $workspaceId, canvasId: $canvasId) {
      ...CanvasCoreFields
    }
  }
`;

/**
 * Duplicate canvas with optional modifications
 * Aligns with CanvasActions.duplicateCanvas()
 */
export const DUPLICATE_CANVAS = gql`
  ${CANVAS_CORE_FIELDS}
  mutation DuplicateCanvas($id: ID!, $input: DuplicateCanvasInput!) {
    duplicateCanvas(id: $id, input: $input) {
      ...CanvasCoreFields
    }
  }
`;

// Note: Canvas settings operations will be added when backend supports them

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to canvas created events
 * Aligns with frontend real-time workspace updates
 */
export const CANVAS_CREATED_SUBSCRIPTION = gql`
  ${CANVAS_CORE_FIELDS}
  subscription CanvasCreated($workspaceId: ID!) {
    canvasCreated(workspaceId: $workspaceId) {
      ...CanvasCoreFields
    }
  }
`;

/**
 * Subscribe to canvas updated events
 * Aligns with frontend real-time workspace updates
 */
export const CANVAS_UPDATED_SUBSCRIPTION = gql`
  ${CANVAS_CORE_FIELDS}
  subscription CanvasUpdated($workspaceId: ID!) {
    canvasUpdated(workspaceId: $workspaceId) {
      ...CanvasCoreFields
    }
  }
`;

/**
 * Subscribe to canvas deleted events
 * Aligns with frontend canvas store deletion handling
 */
export const CANVAS_DELETED_SUBSCRIPTION = gql`
  subscription CanvasDeleted($workspaceId: ID!) {
    canvasDeleted(workspaceId: $workspaceId)
  }
`;

// Note: Canvas settings subscriptions will be added when backend supports them

/**
 * Subscribe to default canvas changed events
 */
export const DEFAULT_CANVAS_CHANGED_SUBSCRIPTION = gql`
  subscription DefaultCanvasChanged($workspaceId: ID!) {
    defaultCanvasChanged(workspaceId: $workspaceId)
  }
`;

// ============================================================================
// TYPE DEFINITIONS FOR TYPESCRIPT
// ============================================================================

export interface CanvasQueryVariables {
  id: string;
}

export interface WorkspaceCanvasesQueryVariables {
  workspaceId: string;
  filter?: {
    isDefault?: boolean;
    searchQuery?: string;
    createdDateRange?: {
      start: string;
      end: string;
    };
    updatedDateRange?: {
      start: string;
      end: string;
    };
  };
  pagination?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  };
}

export interface DefaultCanvasQueryVariables {
  workspaceId: string;
}

export interface SearchCanvasesQueryVariables {
  workspaceId: string;
  query: string;
  limit?: number;
}

export interface CreateCanvasMutationVariables {
  input: {
    workspaceId: string;
    name: string;
    description?: string;
    isDefault?: boolean;
    position?: number;
  };
}

export interface UpdateCanvasMutationVariables {
  id: string;
  input: {
    name?: string;
    description?: string;
    isDefault?: boolean;
    position?: number;
  };
}

export interface DeleteCanvasMutationVariables {
  id: string;
}

export interface SetDefaultCanvasMutationVariables {
  workspaceId: string;
  canvasId: string;
}

export interface DuplicateCanvasMutationVariables {
  id: string;
  input: {
    name: string;
    description?: string;
    includeCards?: boolean;
    includeConnections?: boolean;
  };
}

// Note: Canvas settings types will be added when backend supports them

export interface CanvasSubscriptionVariables {
  workspaceId: string;
}

export interface CanvasSettingsSubscriptionVariables {
  canvasId: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface CanvasResponse {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  workspace?: {
    id: string;
    name: string;
    ownerId: string;
  };
  createdByUser?: {
    id: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface CanvasesConnectionResponse {
  items: CanvasResponse[];
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
  CANVAS_CORE_FIELDS,
  CANVAS_WITH_RELATIONS,
};
/**
 * Workspace and Canvas Type Definitions
 * 
 * Comprehensive types for workspace management, canvas operations,
 * and the relationship between workspaces and canvases.
 */

import type { EntityId, Color } from './common.types';
import type { CanvasPosition } from './canvas.types';

// ============================================================================
// CORE CANVAS TYPES
// ============================================================================

/**
 * Canvas ID type for strong typing
 */
export type CanvasId = EntityId & { readonly __brand: 'CanvasId' };

/**
 * Create a canvas ID with proper typing
 */
export const createCanvasId = (id: string): CanvasId => id as CanvasId;

/**
 * Canvas background configuration
 */
export interface CanvasBackground {
  type: 'COLOR' | 'IMAGE';
  color?: Color;
  imageUrl?: string;
  opacity: number;
}

/**
 * Canvas grid configuration
 */
export interface CanvasGrid {
  enabled: boolean;
  size: number;
  color: Color;
  opacity: number;
}

/**
 * Canvas settings for viewport and display options
 */
export interface CanvasSettings {
  isDefault: boolean;
  position: CanvasPosition;
  zoom: number;
  grid: CanvasGrid;
  background: CanvasBackground;
}

/**
 * Canvas status enumeration
 */
export type CanvasStatus = 'active' | 'archived' | 'draft';

/**
 * Canvas priority enumeration
 */
export type CanvasPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Complete Canvas interface
 */
export interface Canvas {
  id: CanvasId;
  workspaceId: EntityId;
  name: string;
  description?: string;
  settings: CanvasSettings;
  status: CanvasStatus;
  priority: CanvasPriority;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// ============================================================================
// WORKSPACE TYPES
// ============================================================================

/**
 * Workspace context state
 */
export interface WorkspaceContext {
  currentWorkspaceId?: EntityId;
  currentCanvasId?: CanvasId;
  workspaceName?: string;
  canvasName?: string;
}

/**
 * Canvas management state
 */
export interface CanvasManagement {
  canvases: Map<CanvasId, Canvas>;
  defaultCanvasId?: CanvasId;
  loadingStates: {
    fetchingCanvases: boolean;
    creatingCanvas: boolean;
    updatingCanvas: boolean;
    deletingCanvas: boolean;
    settingDefault: boolean;
    duplicatingCanvas: boolean;
  };
  errors: {
    fetchError?: string;
    mutationError?: string;
  };
}

// ============================================================================
// OPERATION TYPES
// ============================================================================

/**
 * Parameters for creating a new canvas
 */
export interface CreateCanvasParams {
  workspaceId: EntityId;
  name: string;
  description?: string;
  settings?: Partial<CanvasSettings>;
  tags?: string[];
  metadata?: Record<string, any>;
  priority?: CanvasPriority;
}

/**
 * Parameters for updating a canvas
 */
export interface UpdateCanvasParams {
  id: CanvasId;
  updates: {
    name?: string;
    description?: string;
    settings?: Partial<CanvasSettings>;
    status?: CanvasStatus;
    priority?: CanvasPriority;
    tags?: string[];
    metadata?: Record<string, any>;
  };
}

/**
 * Parameters for duplicating a canvas
 */
export interface DuplicateCanvasParams {
  id: CanvasId;
  name: string;
  description?: string;
  includeCards?: boolean;
  includeConnections?: boolean;
}

/**
 * Canvas filter criteria
 */
export interface CanvasFilter {
  status?: CanvasStatus[];
  priority?: CanvasPriority[];
  tags?: string[];
  searchQuery?: string;
  isDefault?: boolean;
  createdDateRange?: {
    start: string;
    end: string;
  };
  updatedDateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Canvas sorting options
 */
export interface CanvasSort {
  field: 'name' | 'createdAt' | 'updatedAt' | 'priority';
  order: 'asc' | 'desc';
}

// ============================================================================
// STORE INTERFACES
// ============================================================================

/**
 * Workspace store state
 */
export interface WorkspaceState {
  context: WorkspaceContext;
  canvasManagement: CanvasManagement;
  isInitialized: boolean;
}

/**
 * Workspace store actions
 */
export interface WorkspaceActions {
  // Context management
  setCurrentWorkspace: (workspaceId: EntityId, workspaceName?: string) => void;
  setCurrentCanvas: (canvasId: CanvasId, canvasName?: string) => void;
  switchCanvas: (canvasId: CanvasId) => Promise<void>;
  clearContext: () => void;

  // Canvas CRUD operations
  createCanvas: (params: CreateCanvasParams) => Promise<CanvasId | null>;
  updateCanvas: (params: UpdateCanvasParams) => Promise<boolean>;
  deleteCanvas: (canvasId: CanvasId) => Promise<boolean>;
  duplicateCanvas: (params: DuplicateCanvasParams) => Promise<CanvasId | null>;
  
  // Canvas management
  setDefaultCanvas: (workspaceId: EntityId, canvasId: CanvasId) => Promise<boolean>;
  syncCanvasWithBackend: (canvas: Canvas) => void;
  loadWorkspaceCanvases: (workspaceId: EntityId, filter?: CanvasFilter) => Promise<void>;
  refreshCanvases: () => Promise<void>;
  
  // Canvas settings
  updateCanvasSettings: (canvasId: CanvasId, settings: Partial<CanvasSettings>) => Promise<boolean>;
  saveCurrentViewport: (position: CanvasPosition, zoom: number) => Promise<void>;
  
  // Utility
  getCanvas: (canvasId: CanvasId) => Canvas | undefined;
  getDefaultCanvas: () => Canvas | undefined;
  getCurrentCanvas: () => Canvas | undefined;
  getCanvasesByFilter: (filter: CanvasFilter) => Canvas[];
  
  // Error handling
  clearErrors: () => void;
  setError: (type: 'fetch' | 'mutation', error: string) => void;
}

/**
 * Complete workspace store interface
 */
export interface WorkspaceStore extends WorkspaceState, WorkspaceActions {}

// ============================================================================
// CANVAS CONTEXT TYPES
// ============================================================================

/**
 * Canvas context for components
 */
export interface CanvasContextValue {
  canvas: Canvas | undefined;
  isLoading: boolean;
  error?: string;
  switchCanvas: (canvasId: CanvasId) => Promise<void>;
  updateCanvasSettings: (settings: Partial<CanvasSettings>) => Promise<void>;
  saveViewport: (position: CanvasPosition, zoom: number) => Promise<void>;
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/**
 * Return type for useCanvases hook
 */
export interface UseCanvasesReturn {
  canvases: Canvas[];
  loading: boolean;
  error?: string;
  refetch: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * Return type for useCanvas hook
 */
export interface UseCanvasReturn {
  canvas: Canvas | undefined;
  loading: boolean;
  error?: string;
  refetch: () => Promise<void>;
}

/**
 * Return type for canvas mutation hooks
 */
export interface UseCanvasMutationReturn {
  mutate: (...args: any[]) => Promise<any>;
  loading: boolean;
  error?: string;
  reset: () => void;
}

// ============================================================================
// OPTIMIZATION TYPES
// ============================================================================

/**
 * Canvas cache entry for optimization
 */
export interface CanvasCacheEntry {
  canvas: Canvas;
  lastAccessed: number;
  accessCount: number;
}

/**
 * Viewport synchronization debounce settings
 */
export interface ViewportSyncConfig {
  debounceMs: number;
  throttleMs: number;
  batchSize: number;
}

// ============================================================================
// COLLABORATION TYPES
// ============================================================================

/**
 * Canvas collaboration state
 */
export interface CanvasCollaboration {
  activeUsers: Array<{
    userId: EntityId;
    cursor?: CanvasPosition;
    lastSeen: number;
  }>;
  isCollaborativeMode: boolean;
  conflictResolution: 'client' | 'server' | 'manual';
}

// ============================================================================
// EXPORT TYPES (Remove this section since all types are already exported above)
// ============================================================================
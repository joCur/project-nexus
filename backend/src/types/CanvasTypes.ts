/**
 * Canvas-related type definitions for workspace settings and user preferences
 * Aligned with frontend canvas types and database schema
 */

// ============================================================================
// CANVAS CONFIGURATION TYPES
// ============================================================================

export interface CanvasConfig {
  grid: GridSettings;
  zoom: ZoomSettings;
  pan: PanSettings;
  selection: SelectionSettings;
  performance: PerformanceSettings;
}

export interface GridSettings {
  enabled: boolean;
  size: number; // Grid size in pixels
  color: string; // Hex color
  opacity: number; // 0-1
  snap: boolean; // Snap to grid
  snapThreshold: number; // Distance threshold for snapping
}

export interface ZoomSettings {
  min: number; // Minimum zoom level
  max: number; // Maximum zoom level
  wheelSensitivity: number; // Mouse wheel sensitivity
  smoothing: boolean; // Smooth zoom transitions
}

export interface PanSettings {
  enabled: boolean;
  momentum: boolean; // Momentum scrolling
  friction: number; // Friction coefficient for momentum
  boundary: 'none' | 'hard' | 'elastic'; // Boundary behavior
}

export interface SelectionSettings {
  multiSelect: boolean;
  boxSelect: boolean; // Drag to select multiple
  showOutline: boolean;
  color: string; // Selection color
}

export interface PerformanceSettings {
  culling: boolean; // Viewport culling
  cullingPadding: number; // Extra padding for culling
  lodEnabled: boolean; // Level of detail
  lodThreshold: number; // LOD zoom threshold
  animationsEnabled: boolean;
}

// ============================================================================
// VIEWPORT AND POSITION TYPES
// ============================================================================

export interface ViewportState {
  x: number; // Camera X position
  y: number; // Camera Y position
  zoom: number; // Zoom level (1 = 100%)
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  padding: number; // Extra space around content
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

// ============================================================================
// CARD SETTINGS TYPES
// ============================================================================

export interface DefaultCardSettings {
  dimensions: Record<string, CanvasDimensions>; // Per card type
  style: DefaultCardStyle;
}

export interface DefaultCardStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  shadow: boolean;
}

// ============================================================================
// THEME TYPES
// ============================================================================

export interface CanvasTheme {
  mode: 'light' | 'dark' | 'auto';
  background: string; // Canvas background color
  accent: string; // Accent color for UI elements
  customColors: Record<string, string>; // Custom color palette
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export interface CanvasFeatures {
  aiSuggestions: boolean;
  autoLayout: boolean;
  collaboration: boolean;
  versionHistory: boolean;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export interface UserCanvasPreferences {
  // UI preferences
  showMinimap: boolean;
  showToolbar: boolean;
  showSidebar: boolean;
  sidebarPosition: 'left' | 'right';
  
  // Interaction preferences
  scrollDirection: 'normal' | 'inverted';
  clickBehavior: 'select' | 'pan';
  doubleClickAction: 'edit' | 'expand' | 'none';
  
  // Visual preferences
  connectionStyle: 'straight' | 'curved' | 'stepped';
  cardShadows: boolean;
  animations: boolean;
  reducedMotion: boolean;
  
  // Accessibility
  highContrast: boolean;
  fontSize: 'small' | 'normal' | 'large';
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface UserCanvasData {
  recentCards: string[]; // Card IDs
  recentColors: string[]; // Hex color values
  recentTags: string[]; // Tag strings
  customShortcuts: Record<string, string>;
  favoriteTools: string[];
  tutorialCompleted: boolean;
  tipsEnabled: boolean;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface CanvasSession {
  id: string;
  userId: string;
  workspaceId: string;
  viewportState: ViewportState;
  selectionState: SelectionState;
  clipboardState: ClipboardState;
  undoStack: UndoRedoEntry[];
  redoStack: UndoRedoEntry[];
  sessionToken: string;
  isActive: boolean;
  lastActivityAt: Date;
  expiresAt: Date;
}

export interface SelectionState {
  selectedCardIds: string[];
  selectedConnectionIds: string[];
  selectionBounds?: CanvasBounds;
}

export interface ClipboardState {
  cards: string[]; // Card IDs
  connections: string[]; // Connection IDs
  operation: 'copy' | 'cut';
  timestamp: Date;
}

export interface UndoRedoEntry {
  id: string;
  type: 'card' | 'connection' | 'batch';
  action: 'create' | 'update' | 'delete' | 'move';
  entityId: string;
  beforeState?: any;
  afterState?: any;
  timestamp: Date;
}

// ============================================================================
// WORKSPACE CANVAS SETTINGS
// ============================================================================

export interface WorkspaceCanvasSettings {
  workspaceId: string;
  canvasConfig: CanvasConfig;
  defaultCardSettings: DefaultCardSettings;
  canvasBounds: CanvasBounds;
  theme: CanvasTheme;
  features: CanvasFeatures;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCanvasPreferencesData {
  userId: string;
  workspaceId: string;
  lastViewport: ViewportState;
  preferences: UserCanvasPreferences;
  userData: UserCanvasData;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateWorkspaceCanvasSettingsInput {
  workspaceId: string;
  canvasConfig?: Partial<CanvasConfig>;
  defaultCardSettings?: Partial<DefaultCardSettings>;
  canvasBounds?: Partial<CanvasBounds>;
  theme?: Partial<CanvasTheme>;
  features?: Partial<CanvasFeatures>;
}

export interface UpdateWorkspaceCanvasSettingsInput {
  canvasConfig?: Partial<CanvasConfig>;
  defaultCardSettings?: Partial<DefaultCardSettings>;
  canvasBounds?: Partial<CanvasBounds>;
  theme?: Partial<CanvasTheme>;
  features?: Partial<CanvasFeatures>;
}

export interface UpdateUserCanvasPreferencesInput {
  lastViewport?: ViewportState;
  preferences?: Partial<UserCanvasPreferences>;
  userData?: Partial<UserCanvasData>;
}

export interface CreateCanvasSessionInput {
  userId: string;
  workspaceId: string;
  viewportState: ViewportState;
  sessionToken: string;
  expiresAt: Date;
}

export interface UpdateCanvasSessionInput {
  viewportState?: ViewportState;
  selectionState?: SelectionState;
  clipboardState?: ClipboardState;
  undoStack?: UndoRedoEntry[];
  redoStack?: UndoRedoEntry[];
  lastActivityAt?: Date;
}

// ============================================================================
// DATABASE MAPPING TYPES
// ============================================================================

export interface DbWorkspaceCanvasSettings {
  workspace_id: string;
  canvas_config: string; // JSON string
  default_card_settings: string; // JSON string
  canvas_bounds: string; // JSON string
  theme: string; // JSON string
  features: string; // JSON string
  created_at: Date;
  updated_at: Date;
}

export interface DbUserCanvasPreferences {
  user_id: string;
  workspace_id: string;
  last_viewport: string; // JSON string
  preferences: string; // JSON string
  recent_cards: string; // JSON string
  recent_colors: string; // JSON string
  recent_tags: string; // JSON string
  custom_shortcuts: string; // JSON string
  favorite_tools: string; // JSON string
  tutorial_completed: boolean;
  tips_enabled: boolean;
  last_accessed_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DbCanvasSession {
  id: string;
  user_id: string;
  workspace_id: string;
  viewport_state: string; // JSON string
  selection_state: string; // JSON string
  clipboard_state: string; // JSON string
  undo_stack: string; // JSON string
  redo_stack: string; // JSON string
  session_token: string;
  is_active: boolean;
  last_activity_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  grid: {
    enabled: true,
    size: 20,
    color: '#E5E7EB',
    opacity: 0.5,
    snap: true,
    snapThreshold: 10,
  },
  zoom: {
    min: 0.25,
    max: 4.0,
    wheelSensitivity: 0.001,
    smoothing: true,
  },
  pan: {
    enabled: true,
    momentum: true,
    friction: 0.92,
    boundary: 'elastic',
  },
  selection: {
    multiSelect: true,
    boxSelect: true,
    showOutline: true,
    color: '#3B82F6',
  },
  performance: {
    culling: true,
    cullingPadding: 100,
    lodEnabled: true,
    lodThreshold: 0.5,
    animationsEnabled: true,
  },
};

export const DEFAULT_CARD_SETTINGS: DefaultCardSettings = {
  dimensions: {
    text: { width: 250, height: 150 },
    image: { width: 300, height: 200 },
    link: { width: 280, height: 120 },
    code: { width: 400, height: 250 },
  },
  style: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    textColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 8,
    opacity: 1,
    shadow: true,
  },
};

export const DEFAULT_CANVAS_BOUNDS: CanvasBounds = {
  minX: -10000,
  maxX: 10000,
  minY: -10000,
  maxY: 10000,
  padding: 500,
};

export const DEFAULT_CANVAS_THEME: CanvasTheme = {
  mode: 'light',
  background: '#F9FAFB',
  accent: '#3B82F6',
  customColors: {},
};

export const DEFAULT_USER_PREFERENCES: UserCanvasPreferences = {
  showMinimap: true,
  showToolbar: true,
  showSidebar: true,
  sidebarPosition: 'right',
  scrollDirection: 'normal',
  clickBehavior: 'select',
  doubleClickAction: 'edit',
  connectionStyle: 'curved',
  cardShadows: true,
  animations: true,
  reducedMotion: false,
  highContrast: false,
  fontSize: 'normal',
  colorBlindMode: 'none',
};

export const DEFAULT_CANVAS_FEATURES: CanvasFeatures = {
  aiSuggestions: false,
  autoLayout: false,
  collaboration: false,
  versionHistory: false,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const createSessionToken = (): string =>
  `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

export const isViewportValid = (viewport: ViewportState): boolean =>
  viewport.zoom >= 0.1 && viewport.zoom <= 10 &&
  Number.isFinite(viewport.x) && Number.isFinite(viewport.y);

export const clampZoom = (zoom: number, min = 0.25, max = 4.0): number =>
  Math.max(min, Math.min(max, zoom));

export const isPointInBounds = (point: CanvasPosition, bounds: CanvasBounds): boolean =>
  point.x >= bounds.minX && point.x <= bounds.maxX &&
  point.y >= bounds.minY && point.y <= bounds.maxY;

export const expandBounds = (bounds: CanvasBounds, padding: number): CanvasBounds => ({
  minX: bounds.minX - padding,
  maxX: bounds.maxX + padding,
  minY: bounds.minY - padding,
  maxY: bounds.maxY + padding,
  padding: bounds.padding,
});

// ============================================================================
// CONSTANTS
// ============================================================================

export const CanvasConstraints = {
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 10.0,
  DEFAULT_ZOOM: 1.0,
  MIN_GRID_SIZE: 5,
  MAX_GRID_SIZE: 100,
  DEFAULT_GRID_SIZE: 20,
  SESSION_TIMEOUT_HOURS: 24,
  UNDO_STACK_MAX_SIZE: 100,
  CLIPBOARD_TIMEOUT_MINUTES: 30,
} as const;
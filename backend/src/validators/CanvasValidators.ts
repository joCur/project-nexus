/**
 * Zod validation schemas for canvas-related types
 * Provides runtime type safety and input validation for canvas settings and preferences
 */

import { z } from 'zod';
import { CanvasConstraints } from '../types/CanvasTypes';

// ============================================================================
// BASIC TYPE SCHEMAS
// ============================================================================

export const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color');

export const CanvasPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const CanvasDimensionsSchema = z.object({
  width: z.number().min(1).finite(),
  height: z.number().min(1).finite(),
});

export const ViewportStateSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number()
    .min(CanvasConstraints.MIN_ZOOM)
    .max(CanvasConstraints.MAX_ZOOM),
});

// ============================================================================
// CANVAS CONFIGURATION SCHEMAS
// ============================================================================

export const GridSettingsSchema = z.object({
  enabled: z.boolean(),
  size: z.number()
    .min(CanvasConstraints.MIN_GRID_SIZE)
    .max(CanvasConstraints.MAX_GRID_SIZE),
  color: HexColorSchema,
  opacity: z.number().min(0).max(1),
  snap: z.boolean(),
  snapThreshold: z.number().min(1).max(50),
});

export const ZoomSettingsSchema = z.object({
  min: z.number().min(0.1).max(1),
  max: z.number().min(1).max(10),
  wheelSensitivity: z.number().min(0.0001).max(0.1),
  smoothing: z.boolean(),
});

export const PanSettingsSchema = z.object({
  enabled: z.boolean(),
  momentum: z.boolean(),
  friction: z.number().min(0.1).max(1),
  boundary: z.enum(['none', 'hard', 'elastic']),
});

export const SelectionSettingsSchema = z.object({
  multiSelect: z.boolean(),
  boxSelect: z.boolean(),
  showOutline: z.boolean(),
  color: HexColorSchema,
});

export const PerformanceSettingsSchema = z.object({
  culling: z.boolean(),
  cullingPadding: z.number().min(0).max(1000),
  lodEnabled: z.boolean(),
  lodThreshold: z.number().min(0.1).max(2),
  animationsEnabled: z.boolean(),
});

export const CanvasConfigSchema = z.object({
  grid: GridSettingsSchema,
  zoom: ZoomSettingsSchema.refine(
    (data) => data.min < data.max,
    { message: 'Minimum zoom must be less than maximum zoom' }
  ),
  pan: PanSettingsSchema,
  selection: SelectionSettingsSchema,
  performance: PerformanceSettingsSchema,
});

// ============================================================================
// CANVAS BOUNDS AND THEME SCHEMAS
// ============================================================================

export const CanvasBoundsSchema = z.object({
  minX: z.number(),
  maxX: z.number(),
  minY: z.number(),
  maxY: z.number(),
  padding: z.number().min(0),
}).refine(
  (data) => data.minX < data.maxX && data.minY < data.maxY,
  { message: 'Invalid bounds: min values must be less than max values' }
);

export const CanvasThemeSchema = z.object({
  mode: z.enum(['light', 'dark', 'auto']),
  background: HexColorSchema,
  accent: HexColorSchema,
  customColors: z.record(z.string(), HexColorSchema),
});

export const CanvasFeaturesSchema = z.object({
  aiSuggestions: z.boolean(),
  autoLayout: z.boolean(),
  collaboration: z.boolean(),
  versionHistory: z.boolean(),
});

// ============================================================================
// CARD SETTINGS SCHEMAS
// ============================================================================

export const DefaultCardStyleSchema = z.object({
  backgroundColor: HexColorSchema,
  borderColor: HexColorSchema,
  textColor: HexColorSchema,
  borderWidth: z.number().min(0).max(10),
  borderRadius: z.number().min(0).max(50),
  opacity: z.number().min(0.1).max(1),
  shadow: z.boolean(),
});

export const DefaultCardSettingsSchema = z.object({
  dimensions: z.record(z.string(), CanvasDimensionsSchema),
  style: DefaultCardStyleSchema,
});

// ============================================================================
// USER PREFERENCES SCHEMAS
// ============================================================================

export const UserCanvasPreferencesSchema = z.object({
  // UI preferences
  showMinimap: z.boolean(),
  showToolbar: z.boolean(),
  showSidebar: z.boolean(),
  sidebarPosition: z.enum(['left', 'right']),
  
  // Interaction preferences
  scrollDirection: z.enum(['normal', 'inverted']),
  clickBehavior: z.enum(['select', 'pan']),
  doubleClickAction: z.enum(['edit', 'expand', 'none']),
  
  // Visual preferences
  connectionStyle: z.enum(['straight', 'curved', 'stepped']),
  cardShadows: z.boolean(),
  animations: z.boolean(),
  reducedMotion: z.boolean(),
  
  // Accessibility
  highContrast: z.boolean(),
  fontSize: z.enum(['small', 'normal', 'large']),
  colorBlindMode: z.enum(['none', 'protanopia', 'deuteranopia', 'tritanopia']),
});

export const UserCanvasDataSchema = z.object({
  recentCards: z.array(z.string().uuid()).max(50),
  recentColors: z.array(HexColorSchema).max(20),
  recentTags: z.array(z.string()).max(50),
  customShortcuts: z.record(z.string(), z.string()),
  favoriteTools: z.array(z.string()).max(20),
  tutorialCompleted: z.boolean(),
  tipsEnabled: z.boolean(),
});

// ============================================================================
// SESSION SCHEMAS
// ============================================================================

export const SelectionStateSchema = z.object({
  selectedCardIds: z.array(z.string().uuid()),
  selectedConnectionIds: z.array(z.string().uuid()),
  selectionBounds: CanvasBoundsSchema.optional(),
});

export const ClipboardStateSchema = z.object({
  cards: z.array(z.string().uuid()),
  connections: z.array(z.string().uuid()),
  operation: z.enum(['copy', 'cut']),
  timestamp: z.date(),
});

export const UndoRedoEntrySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['card', 'connection', 'batch']),
  action: z.enum(['create', 'update', 'delete', 'move']),
  entityId: z.string().uuid(),
  beforeState: z.any().optional(),
  afterState: z.any().optional(),
  timestamp: z.date(),
});

export const CanvasSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  viewportState: ViewportStateSchema,
  selectionState: SelectionStateSchema,
  clipboardState: ClipboardStateSchema,
  undoStack: z.array(UndoRedoEntrySchema)
    .max(CanvasConstraints.UNDO_STACK_MAX_SIZE),
  redoStack: z.array(UndoRedoEntrySchema)
    .max(CanvasConstraints.UNDO_STACK_MAX_SIZE),
  sessionToken: z.string(),
  isActive: z.boolean(),
  lastActivityAt: z.date(),
  expiresAt: z.date(),
});

// ============================================================================
// WORKSPACE AND USER SETTINGS SCHEMAS
// ============================================================================

export const WorkspaceCanvasSettingsSchema = z.object({
  workspaceId: z.string().uuid(),
  canvasConfig: CanvasConfigSchema,
  defaultCardSettings: DefaultCardSettingsSchema,
  canvasBounds: CanvasBoundsSchema,
  theme: CanvasThemeSchema,
  features: CanvasFeaturesSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UserCanvasPreferencesDataSchema = z.object({
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  lastViewport: ViewportStateSchema,
  preferences: UserCanvasPreferencesSchema,
  userData: UserCanvasDataSchema,
  lastAccessedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

export const CreateWorkspaceCanvasSettingsInputSchema = z.object({
  workspaceId: z.string().uuid(),
  canvasConfig: CanvasConfigSchema.partial().optional(),
  defaultCardSettings: DefaultCardSettingsSchema.partial().optional(),
  canvasBounds: z.object({
    minX: z.number().optional(),
    maxX: z.number().optional(),
    minY: z.number().optional(),
    maxY: z.number().optional(),
    padding: z.number().min(0).optional(),
  }).optional(),
  theme: CanvasThemeSchema.partial().optional(),
  features: CanvasFeaturesSchema.partial().optional(),
});

export const UpdateWorkspaceCanvasSettingsInputSchema = z.object({
  canvasConfig: CanvasConfigSchema.partial().optional(),
  defaultCardSettings: DefaultCardSettingsSchema.partial().optional(),
  canvasBounds: z.object({
    minX: z.number().optional(),
    maxX: z.number().optional(),
    minY: z.number().optional(),
    maxY: z.number().optional(),
    padding: z.number().min(0).optional(),
  }).optional(),
  theme: CanvasThemeSchema.partial().optional(),
  features: CanvasFeaturesSchema.partial().optional(),
});

export const UpdateUserCanvasPreferencesInputSchema = z.object({
  lastViewport: ViewportStateSchema.optional(),
  preferences: UserCanvasPreferencesSchema.partial().optional(),
  userData: UserCanvasDataSchema.partial().optional(),
});

export const CreateCanvasSessionInputSchema = z.object({
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  viewportState: ViewportStateSchema,
  sessionToken: z.string(),
  expiresAt: z.date(),
});

export const UpdateCanvasSessionInputSchema = z.object({
  viewportState: ViewportStateSchema.optional(),
  selectionState: SelectionStateSchema.optional(),
  clipboardState: ClipboardStateSchema.optional(),
  undoStack: z.array(UndoRedoEntrySchema)
    .max(CanvasConstraints.UNDO_STACK_MAX_SIZE)
    .optional(),
  redoStack: z.array(UndoRedoEntrySchema)
    .max(CanvasConstraints.UNDO_STACK_MAX_SIZE)
    .optional(),
  lastActivityAt: z.date().optional(),
});

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export const validateViewportState = (data: unknown) => {
  return ViewportStateSchema.parse(data);
};

export const validateCanvasConfig = (data: unknown) => {
  return CanvasConfigSchema.parse(data);
};

export const validateUserPreferences = (data: unknown) => {
  return UserCanvasPreferencesSchema.parse(data);
};

export const validateCreateWorkspaceSettings = (data: unknown) => {
  return CreateWorkspaceCanvasSettingsInputSchema.parse(data);
};

export const validateUpdateWorkspaceSettings = (data: unknown) => {
  return UpdateWorkspaceCanvasSettingsInputSchema.parse(data);
};

export const validateUpdateUserPreferences = (data: unknown) => {
  return UpdateUserCanvasPreferencesInputSchema.parse(data);
};

export const validateCreateSession = (data: unknown) => {
  return CreateCanvasSessionInputSchema.parse(data);
};

export const validateUpdateSession = (data: unknown) => {
  return UpdateCanvasSessionInputSchema.parse(data);
};

// ============================================================================
// CUSTOM VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that a viewport is within reasonable bounds
 */
export const isViewportReasonable = (viewport: { x: number; y: number; zoom: number }): boolean => {
  const maxPosition = 100000; // 100k pixels
  return Math.abs(viewport.x) <= maxPosition && 
         Math.abs(viewport.y) <= maxPosition &&
         viewport.zoom >= CanvasConstraints.MIN_ZOOM &&
         viewport.zoom <= CanvasConstraints.MAX_ZOOM;
};

/**
 * Validates that canvas bounds are reasonable
 */
export const areCanvasBoundsReasonable = (bounds: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}): boolean => {
  const maxDimension = 1000000; // 1M pixels
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  
  return width > 0 && height > 0 &&
         width <= maxDimension && height <= maxDimension &&
         Math.abs(bounds.minX) <= maxDimension &&
         Math.abs(bounds.maxX) <= maxDimension &&
         Math.abs(bounds.minY) <= maxDimension &&
         Math.abs(bounds.maxY) <= maxDimension;
};

/**
 * Validates session expiration time
 */
export const isValidSessionExpiration = (expiresAt: Date): boolean => {
  const now = new Date();
  const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 hours
  const timeDiff = expiresAt.getTime() - now.getTime();
  
  return timeDiff > 0 && timeDiff <= maxSessionDuration;
};

/**
 * Validates zoom settings consistency
 */
export const validateZoomSettings = (settings: {
  min: number;
  max: number;
  wheelSensitivity: number;
}): string[] => {
  const errors: string[] = [];
  
  if (settings.min >= settings.max) {
    errors.push('Minimum zoom must be less than maximum zoom');
  }
  
  if (settings.min < 0.1) {
    errors.push('Minimum zoom cannot be less than 0.1');
  }
  
  if (settings.max > 10) {
    errors.push('Maximum zoom cannot be greater than 10');
  }
  
  if (settings.wheelSensitivity <= 0 || settings.wheelSensitivity > 0.1) {
    errors.push('Wheel sensitivity must be between 0 and 0.1');
  }
  
  return errors;
};

/**
 * Sanitizes user input for canvas settings
 */
export const sanitizeCanvasInput = <T extends Record<string, any>>(input: T): T => {
  const sanitized = { ...input };
  
  // Remove any null or undefined values
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === null || sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });
  
  return sanitized;
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateWorkspaceCanvasSettingsInput = z.infer<typeof CreateWorkspaceCanvasSettingsInputSchema>;
export type UpdateWorkspaceCanvasSettingsInput = z.infer<typeof UpdateWorkspaceCanvasSettingsInputSchema>;
export type UpdateUserCanvasPreferencesInput = z.infer<typeof UpdateUserCanvasPreferencesInputSchema>;
export type CreateCanvasSessionInput = z.infer<typeof CreateCanvasSessionInputSchema>;
export type UpdateCanvasSessionInput = z.infer<typeof UpdateCanvasSessionInputSchema>;
export type ViewportState = z.infer<typeof ViewportStateSchema>;
export type CanvasConfig = z.infer<typeof CanvasConfigSchema>;
export type UserCanvasPreferences = z.infer<typeof UserCanvasPreferencesSchema>;


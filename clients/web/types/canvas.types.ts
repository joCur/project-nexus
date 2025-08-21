/**
 * Canvas Store Type Definitions
 * 
 * Comprehensive types and interfaces for the infinite canvas system including
 * viewport management, interaction state, grid systems, and performance optimizations.
 */

import type { Position, Dimensions, Bounds, Color, EntityId } from './common.types';

// ============================================================================
// CORE CANVAS TYPES
// ============================================================================

/**
 * Canvas position coordinates
 */
export interface CanvasPosition {
  x: number;
  y: number;
}

/**
 * Screen position coordinates
 */
export interface ScreenPosition {
  x: number;
  y: number;
}

/**
 * Canvas bounds for viewport calculations
 */
export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Zoom level with constraints (0.25x to 4.0x)
 * @minimum 0.25
 * @maximum 4.0
 */
export type ZoomLevel = number;

// ============================================================================
// VIEWPORT AND STATE TYPES
// ============================================================================

/**
 * Viewport state for canvas navigation
 */
export interface ViewportState {
  position: CanvasPosition;
  zoom: ZoomLevel;
  bounds: CanvasBounds;
  isDirty: boolean;
}

/**
 * Canvas configuration settings
 */
export interface CanvasConfig {
  grid: {
    enabled: boolean;
    size: number;
    color: Color;
    opacity: number;
  };
  zoom: {
    min: ZoomLevel;
    max: ZoomLevel;
    step: number;
  };
  performance: {
    enableCulling: boolean;
    enableVirtualization: boolean;
    maxVisibleCards: number;
  };
}

/**
 * Canvas interaction state
 */
export interface CanvasInteraction {
  mode: 'select' | 'pan' | 'drag' | 'resize' | 'connect';
  isActive: boolean;
  startPosition?: CanvasPosition;
  currentPosition?: CanvasPosition;
  selection: {
    selectedIds: Set<EntityId>;
    bounds?: CanvasBounds;
  };
  lastInteractionTime: number;
}

// ============================================================================
// CANVAS STORE INTERFACE
// ============================================================================

/**
 * Canvas store state
 */
export interface CanvasState {
  viewport: ViewportState;
  config: CanvasConfig;
  interaction: CanvasInteraction;
  isInitialized: boolean;
}

/**
 * Canvas store actions
 */
export interface CanvasActions {
  // Viewport actions
  setZoom: (zoom: ZoomLevel) => void;
  setPosition: (position: CanvasPosition) => void;
  panBy: (offset: CanvasPosition) => void;
  zoomToFit: () => void;
  centerView: () => void;
  
  // Configuration actions
  updateConfig: (config: Partial<CanvasConfig>) => void;
  toggleGrid: () => void;
  
  // Interaction actions
  setInteractionMode: (mode: CanvasInteraction['mode']) => void;
  startInteraction: (position: CanvasPosition) => void;
  updateInteraction: (position: CanvasPosition) => void;
  endInteraction: () => void;
  
  // Selection actions
  selectCard: (cardId: EntityId) => void;
  selectMultiple: (cardIds: EntityId[]) => void;
  clearSelection: () => void;
  
  // Utility actions
  reset: () => void;
}

/**
 * Complete canvas store interface
 */
export interface CanvasStore extends CanvasState, CanvasActions {}

// ============================================================================
// COORDINATE TRANSFORMATION TYPES
// ============================================================================

/**
 * Coordinate transformation functions
 */
export interface CoordinateTransform {
  canvasToScreen: (position: CanvasPosition) => ScreenPosition;
  screenToCanvas: (position: ScreenPosition) => CanvasPosition;
  scaleToViewport: (bounds: CanvasBounds) => CanvasBounds;
}

/**
 * Canvas measurement utilities
 */
export interface CanvasMeasurements {
  distance: (from: CanvasPosition, to: CanvasPosition) => number;
  angle: (from: CanvasPosition, to: CanvasPosition) => number;
  containsPoint: (bounds: CanvasBounds, point: CanvasPosition) => boolean;
  intersectsBounds: (bounds1: CanvasBounds, bounds2: CanvasBounds) => boolean;
}
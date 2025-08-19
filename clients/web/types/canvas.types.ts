/**
 * Canvas Store Type Definitions
 * 
 * Types and interfaces for the canvas viewport and interaction state management.
 */

import type { Position, Dimensions, Bounds, Color } from './common.types';

/**
 * Viewport state for canvas navigation
 */
export interface ViewportState {
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Minimum zoom level */
  minZoom: number;
  /** Maximum zoom level */
  maxZoom: number;
  /** Current pan position */
  panOffset: Position;
  /** Canvas center position */
  center: Position;
  /** Viewport bounds in canvas coordinates */
  bounds: Bounds;
}

/**
 * Canvas configuration settings
 */
export interface CanvasConfig {
  /** Canvas background color */
  backgroundColor: Color;
  /** Grid visibility */
  showGrid: boolean;
  /** Grid size in canvas units */
  gridSize: number;
  /** Grid color */
  gridColor: Color;
  /** Snap to grid enabled */
  snapToGrid: boolean;
  /** Performance mode for large canvases */
  performanceMode: boolean;
}

/**
 * Canvas interaction state
 */
export interface CanvasInteraction {
  /** Whether user is currently panning */
  isPanning: boolean;
  /** Whether user is currently selecting */
  isSelecting: boolean;
  /** Selection rectangle */
  selectionRect?: Bounds;
  /** Last interaction position */
  lastInteractionPosition: Position;
}

/**
 * Canvas store state interface
 */
export interface CanvasState {
  viewport: ViewportState;
  config: CanvasConfig;
  interaction: CanvasInteraction;
  isInitialized: boolean;
}

/**
 * Canvas store actions interface
 */
export interface CanvasActions {
  // Viewport management
  setZoom: (zoom: number) => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  resetZoom: () => void;
  setPanOffset: (offset: Position) => void;
  panBy: (delta: Position) => void;
  centerOn: (position: Position) => void;
  fitToContent: () => void;
  
  // Configuration
  updateConfig: (config: Partial<CanvasConfig>) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  
  // Interaction
  startPanning: (position: Position) => void;
  updatePanning: (position: Position) => void;
  endPanning: () => void;
  startSelection: (position: Position) => void;
  updateSelection: (position: Position) => void;
  endSelection: () => void;
  
  // Initialization
  initialize: (canvasDimensions: Dimensions) => void;
  reset: () => void;
}

/**
 * Combined canvas store type
 */
export interface CanvasStore extends CanvasState, CanvasActions {}
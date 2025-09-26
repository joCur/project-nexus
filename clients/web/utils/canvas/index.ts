/**
 * Canvas Utilities Export
 *
 * Central export point for all canvas-related utility functions
 */

// Export overlay positioning utilities
export {
  // Core functions
  konvaToDOM,
  domToKonva,
  getOverlayPosition,
  useOverlayPosition,

  // Utility functions
  calculateDistance,
  isWithinBounds,
  clampToBounds,
  getCanvasViewportBounds,

  // Types
  type DOMPosition,
  type CanvasViewport,
  type OverlayPosition,
  type UseOverlayPositionOptions,

  // Error class
  CoordinateTransformError,
} from './overlayPositioning';

// Re-export existing canvas utilities if they exist
export * from '../canvas-calculations';
export * from '../canvas-performance-optimizations';
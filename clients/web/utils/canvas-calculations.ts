/**
 * Canvas Calculations Utility
 * 
 * Essential coordinate transformations and basic bounds checking
 * for the infinite canvas system.
 */

import type {
  CanvasPosition,
  ScreenPosition,
  CanvasBounds,
  ViewportState,
} from '@/types/canvas.types';

// ============================================================================
// COORDINATE TRANSFORMATIONS
// ============================================================================

/**
 * Convert canvas coordinates to screen coordinates
 */
export const canvasToScreen = (
  canvasPosition: CanvasPosition,
  viewport: ViewportState
): ScreenPosition => {
  return {
    x: (canvasPosition.x - viewport.position.x) * viewport.zoom,
    y: (canvasPosition.y - viewport.position.y) * viewport.zoom,
  };
};

/**
 * Convert screen coordinates to canvas coordinates
 */
export const screenToCanvas = (
  screenPosition: ScreenPosition,
  viewport: ViewportState
): CanvasPosition => {
  return {
    x: screenPosition.x / viewport.zoom + viewport.position.x,
    y: screenPosition.y / viewport.zoom + viewport.position.y,
  };
};

// ============================================================================
// BASIC GEOMETRIC CALCULATIONS
// ============================================================================

/**
 * Calculate distance between two points
 */
export const distance = (from: CanvasPosition, to: CanvasPosition): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Check if a point is within bounds
 */
export const containsPoint = (bounds: CanvasBounds, point: CanvasPosition): boolean => {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
};

/**
 * Check if two bounds intersect
 */
export const intersectsBounds = (bounds1: CanvasBounds, bounds2: CanvasBounds): boolean => {
  return !(
    bounds1.maxX < bounds2.minX ||
    bounds1.minX > bounds2.maxX ||
    bounds1.maxY < bounds2.minY ||
    bounds1.minY > bounds2.maxY
  );
};

// ============================================================================
// BASIC BOUNDS UTILITIES
// ============================================================================

/**
 * Calculate bounds that contain a set of positions
 */
export const calculateBounds = (
  positions: CanvasPosition[],
  padding: number = 100
): CanvasBounds => {
  if (positions.length === 0) {
    return { minX: -padding, minY: -padding, maxX: padding, maxY: padding };
  }

  let minX = positions[0].x;
  let minY = positions[0].y;
  let maxX = positions[0].x;
  let maxY = positions[0].y;

  for (const pos of positions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
};
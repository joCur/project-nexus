/**
 * Canvas Calculations Utility
 * 
 * Provides coordinate transformations, viewport culling, and performance
 * optimization utilities for the infinite canvas system.
 */

import type {
  CanvasPosition,
  ScreenPosition,
  CanvasBounds,
  ViewportState,
  ZoomLevel,
} from '@/types/canvas.types';
import type { EntityId } from '@/types/common.types';

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

/**
 * Scale canvas bounds to viewport coordinates
 */
export const scaleToViewport = (
  bounds: CanvasBounds,
  viewport: ViewportState
): CanvasBounds => {
  const topLeft = canvasToScreen({ x: bounds.minX, y: bounds.minY }, viewport);
  const bottomRight = canvasToScreen({ x: bounds.maxX, y: bounds.maxY }, viewport);
  
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
};

// ============================================================================
// GEOMETRIC CALCULATIONS
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
 * Calculate angle between two points (in radians)
 */
export const angle = (from: CanvasPosition, to: CanvasPosition): number => {
  return Math.atan2(to.y - from.y, to.x - from.x);
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

/**
 * Expand bounds by a margin
 */
export const expandBounds = (bounds: CanvasBounds, margin: number): CanvasBounds => {
  return {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin,
  };
};

// ============================================================================
// VIEWPORT CULLING
// ============================================================================

export interface CullableEntity {
  id: EntityId;
  bounds: CanvasBounds;
  priority?: number; // Higher priority entities are kept even when outside viewport
}

export interface CullingOptions {
  bufferZone: number; // Extra area around viewport to keep entities
  maxEntities: number; // Maximum entities to render
  priorityThreshold: number; // Minimum priority to always render
}

/**
 * Calculate visible viewport bounds with buffer zone
 */
export const getVisibleBounds = (
  viewport: ViewportState,
  canvasSize: { width: number; height: number },
  bufferZone: number = 200
): CanvasBounds => {
  // Convert screen viewport to canvas coordinates
  const topLeft = screenToCanvas({ x: -bufferZone, y: -bufferZone }, viewport);
  const bottomRight = screenToCanvas(
    { x: canvasSize.width + bufferZone, y: canvasSize.height + bufferZone },
    viewport
  );

  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
};

/**
 * Perform viewport culling on entities
 */
export const cullEntities = <T extends CullableEntity>(
  entities: T[],
  viewport: ViewportState,
  canvasSize: { width: number; height: number },
  options: Partial<CullingOptions> = {}
): T[] => {
  const {
    bufferZone = 200,
    maxEntities = 1000,
    priorityThreshold = 5,
  } = options;

  const visibleBounds = getVisibleBounds(viewport, canvasSize, bufferZone);

  // Filter entities that are visible or high priority
  const visibleEntities = entities.filter((entity) => {
    // Always include high priority entities
    if (entity.priority !== undefined && entity.priority >= priorityThreshold) {
      return true;
    }
    
    // Include entities that intersect with visible bounds
    return intersectsBounds(entity.bounds, visibleBounds);
  });

  // Sort by priority and distance from viewport center if we exceed maxEntities
  if (visibleEntities.length > maxEntities) {
    const viewportCenter: CanvasPosition = {
      x: viewport.position.x,
      y: viewport.position.y,
    };

    return visibleEntities
      .map((entity) => {
        // Calculate entity center
        const entityCenter: CanvasPosition = {
          x: (entity.bounds.minX + entity.bounds.maxX) / 2,
          y: (entity.bounds.minY + entity.bounds.maxY) / 2,
        };
        
        return {
          entity,
          priority: entity.priority || 0,
          distance: distance(viewportCenter, entityCenter),
        };
      })
      .sort((a, b) => {
        // Sort by priority first, then by distance
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.distance - b.distance; // Closer entities first
      })
      .slice(0, maxEntities)
      .map(({ entity }) => entity);
  }

  return visibleEntities;
};

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Calculate appropriate level of detail based on zoom level
 */
export const getLevelOfDetail = (zoom: ZoomLevel): 'low' | 'medium' | 'high' => {
  if (zoom < 0.5) return 'low';
  if (zoom < 1.5) return 'medium';
  return 'high';
};

/**
 * Check if an entity should use simplified rendering
 */
export const shouldUseSimplifiedRendering = (
  entityBounds: CanvasBounds,
  viewport: ViewportState,
  minPixelSize: number = 10
): boolean => {
  // Calculate entity size in screen pixels
  const screenBounds = scaleToViewport(entityBounds, viewport);
  const screenWidth = screenBounds.maxX - screenBounds.minX;
  const screenHeight = screenBounds.maxY - screenBounds.minY;
  
  // Use simplified rendering for very small entities
  return Math.max(screenWidth, screenHeight) < minPixelSize;
};

// ============================================================================
// ANIMATION UTILITIES
// ============================================================================

/**
 * Easing function for smooth animations
 */
export const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * Interpolate between two positions
 */
export const interpolatePosition = (
  from: CanvasPosition,
  to: CanvasPosition,
  progress: number
): CanvasPosition => {
  const easedProgress = easeOutCubic(progress);
  return {
    x: from.x + (to.x - from.x) * easedProgress,
    y: from.y + (to.y - from.y) * easedProgress,
  };
};

/**
 * Interpolate between two zoom levels
 */
export const interpolateZoom = (
  from: ZoomLevel,
  to: ZoomLevel,
  progress: number
): ZoomLevel => {
  const easedProgress = easeOutCubic(progress);
  return from + (to - from) * easedProgress;
};

// ============================================================================
// BOUNDS UTILITIES
// ============================================================================

/**
 * Calculate bounds that contain all entities
 */
export const calculateContentBounds = <T extends CullableEntity>(
  entities: T[],
  padding: number = 100
): CanvasBounds => {
  if (entities.length === 0) {
    return { minX: -padding, minY: -padding, maxX: padding, maxY: padding };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const entity of entities) {
    minX = Math.min(minX, entity.bounds.minX);
    minY = Math.min(minY, entity.bounds.minY);
    maxX = Math.max(maxX, entity.bounds.maxX);
    maxY = Math.max(maxY, entity.bounds.maxY);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
};

/**
 * Fit bounds within viewport with optimal zoom
 */
export const fitBoundsToViewport = (
  bounds: CanvasBounds,
  canvasSize: { width: number; height: number },
  maxZoom: ZoomLevel = 4.0,
  minZoom: ZoomLevel = 0.25,
  padding: number = 50
): { position: CanvasPosition; zoom: ZoomLevel } => {
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  
  const availableWidth = canvasSize.width - padding * 2;
  const availableHeight = canvasSize.height - padding * 2;
  
  // Calculate zoom to fit content
  const zoomX = availableWidth / boundsWidth;
  const zoomY = availableHeight / boundsHeight;
  const optimalZoom = Math.min(zoomX, zoomY);
  
  // Clamp zoom within limits
  const zoom = Math.max(minZoom, Math.min(maxZoom, optimalZoom));
  
  // Calculate position to center content
  const boundsCenter: CanvasPosition = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  
  const position: CanvasPosition = {
    x: boundsCenter.x - canvasSize.width / (2 * zoom),
    y: boundsCenter.y - canvasSize.height / (2 * zoom),
  };
  
  return { position, zoom };
};
/**
 * Viewport Management Hook
 * 
 * Advanced viewport management with bounds calculation, content fitting,
 * and dynamic viewport optimization for the infinite canvas system.
 */

import { useCallback, useMemo, useEffect, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import {
  getVisibleBounds,
  calculateContentBounds,
  fitBoundsToViewport,
  containsPoint,
  expandBounds,
  canvasToScreen,
  screenToCanvas,
} from '@/utils/canvas-calculations';
import type {
  CanvasPosition,
  ScreenPosition,
  CanvasBounds,
  ZoomLevel,
} from '@/types/canvas.types';
import type { EntityId } from '@/types/common.types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ViewportConfig {
  enableDynamicBounds: boolean;
  boundsPadding: number;
  bufferZone: number;
  autoFitContent: boolean;
  constrainToBounds: boolean;
  enableViewportTracking: boolean;
}

export interface ViewportMetrics {
  visibleBounds: CanvasBounds;
  contentBounds: CanvasBounds;
  effectiveBounds: CanvasBounds;
  viewportArea: number;
  contentCoverage: number;
  zoomLevel: ZoomLevel;
  centerPoint: CanvasPosition;
  isContentVisible: boolean;
}

export interface ViewportEntity {
  id: EntityId;
  bounds: CanvasBounds;
  priority?: number;
  isVisible?: boolean;
  screenBounds?: CanvasBounds;
}

export interface ViewportConstraints {
  minZoom?: ZoomLevel;
  maxZoom?: ZoomLevel;
  bounds?: CanvasBounds;
  centerBounds?: CanvasBounds;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ViewportConfig = {
  enableDynamicBounds: true,
  boundsPadding: 200,
  bufferZone: 300,
  autoFitContent: false,
  constrainToBounds: false,
  enableViewportTracking: true,
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useViewport = (
  canvasSize: { width: number; height: number },
  config: Partial<ViewportConfig> = {}
) => {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const { viewport, config: canvasConfig, setZoom, setPosition } = useCanvasStore();
  
  const [entities, setEntities] = useState<ViewportEntity[]>([]);
  const [constraints, setConstraints] = useState<ViewportConstraints>({});

  // ============================================================================
  // VIEWPORT CALCULATIONS
  // ============================================================================

  /**
   * Calculate visible bounds with buffer zone
   */
  const visibleBounds = useMemo(() => {
    return getVisibleBounds(viewport, canvasSize, mergedConfig.bufferZone);
  }, [viewport, canvasSize, mergedConfig.bufferZone]);

  /**
   * Calculate content bounds from entities
   */
  const contentBounds = useMemo(() => {
    if (entities.length === 0) {
      return {
        minX: -mergedConfig.boundsPadding,
        minY: -mergedConfig.boundsPadding,
        maxX: mergedConfig.boundsPadding,
        maxY: mergedConfig.boundsPadding,
      };
    }
    return calculateContentBounds(entities, mergedConfig.boundsPadding);
  }, [entities, mergedConfig.boundsPadding]);

  /**
   * Calculate effective bounds considering constraints
   */
  const effectiveBounds = useMemo(() => {
    const base = mergedConfig.enableDynamicBounds ? contentBounds : visibleBounds;
    if (constraints.bounds) {
      return constraints.bounds;
    }
    return base;
  }, [mergedConfig.enableDynamicBounds, contentBounds, visibleBounds, constraints.bounds]);

  /**
   * Calculate viewport metrics
   */
  const metrics: ViewportMetrics = useMemo(() => {
    const viewportArea = (visibleBounds.maxX - visibleBounds.minX) * 
                        (visibleBounds.maxY - visibleBounds.minY);
    
    const contentArea = (contentBounds.maxX - contentBounds.minX) * 
                       (contentBounds.maxY - contentBounds.minY);
    
    const centerPoint: CanvasPosition = {
      x: viewport.position.x + canvasSize.width / (2 * viewport.zoom),
      y: viewport.position.y + canvasSize.height / (2 * viewport.zoom),
    };

    const isContentVisible = contentArea > 0 && 
      containsPoint(visibleBounds, {
        x: (contentBounds.minX + contentBounds.maxX) / 2,
        y: (contentBounds.minY + contentBounds.maxY) / 2,
      });

    return {
      visibleBounds,
      contentBounds,
      effectiveBounds,
      viewportArea,
      contentCoverage: contentArea > 0 ? Math.min(viewportArea / contentArea, 1) : 0,
      zoomLevel: viewport.zoom,
      centerPoint,
      isContentVisible,
    };
  }, [visibleBounds, contentBounds, effectiveBounds, viewport, canvasSize]);

  // ============================================================================
  // COORDINATE TRANSFORMATIONS
  // ============================================================================

  const toScreen = useCallback((canvasPosition: CanvasPosition): ScreenPosition => {
    return canvasToScreen(canvasPosition, viewport);
  }, [viewport]);

  const toCanvas = useCallback((screenPosition: ScreenPosition): CanvasPosition => {
    return screenToCanvas(screenPosition, viewport);
  }, [viewport]);

  // ============================================================================
  // VIEWPORT OPERATIONS
  // ============================================================================

  const fitContent = useCallback((
    _animated: boolean = true,
    customBounds?: CanvasBounds,
    margin: number = 50
  ) => {
    const boundsToFit = customBounds || contentBounds;
    const { position, zoom } = fitBoundsToViewport(
      boundsToFit,
      canvasSize,
      constraints.maxZoom || canvasConfig.zoom.max,
      constraints.minZoom || canvasConfig.zoom.min,
      margin
    );

    if (_animated) {
      // Note: Animation would be handled by useCanvasNavigation hook
      // This is a direct update for immediate fitting
    }
    
    setZoom(zoom);
    setPosition(position);
  }, [contentBounds, canvasSize, constraints, canvasConfig.zoom, setZoom, setPosition]);

  const centerOnPoint = useCallback((
    point: CanvasPosition,
    zoom?: ZoomLevel,
    _animated: boolean = true
  ) => {
    const targetZoom = zoom || viewport.zoom;
    const newPosition: CanvasPosition = {
      x: point.x - canvasSize.width / (2 * targetZoom),
      y: point.y - canvasSize.height / (2 * targetZoom),
    };

    if (zoom && zoom !== viewport.zoom) {
      setZoom(targetZoom);
    }
    setPosition(newPosition);
  }, [viewport.zoom, canvasSize, setZoom, setPosition]);

  const centerOnBounds = useCallback((
    bounds: CanvasBounds,
    padding: number = 50,
    _animated: boolean = true
  ) => {
    const { position, zoom } = fitBoundsToViewport(
      bounds,
      canvasSize,
      constraints.maxZoom || canvasConfig.zoom.max,
      constraints.minZoom || canvasConfig.zoom.min,
      padding
    );
    
    setZoom(zoom);
    setPosition(position);
  }, [canvasSize, constraints, canvasConfig.zoom, setZoom, setPosition]);

  const zoomToLevel = useCallback((
    targetZoom: ZoomLevel,
    focusPoint?: CanvasPosition,
    _animated: boolean = true
  ) => {
    // Apply zoom constraints
    const minZoom = constraints.minZoom || canvasConfig.zoom.min;
    const maxZoom = constraints.maxZoom || canvasConfig.zoom.max;
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
    
    if (focusPoint) {
      // Zoom toward focus point (currentCenter calculation removed as unused)
      
      const newPosition: CanvasPosition = {
        x: focusPoint.x - canvasSize.width / (2 * clampedZoom),
        y: focusPoint.y - canvasSize.height / (2 * clampedZoom),
      };
      
      setPosition(newPosition);
    }
    
    setZoom(clampedZoom);
  }, [constraints, canvasConfig.zoom, viewport, canvasSize, setZoom, setPosition]);

  const panToPosition = useCallback((
    targetPosition: CanvasPosition,
    _animated: boolean = true
  ) => {
    if (mergedConfig.constrainToBounds && constraints.bounds) {
      // Constrain position to bounds
      const constrainedPosition: CanvasPosition = {
        x: Math.max(
          constraints.bounds.minX,
          Math.min(constraints.bounds.maxX - canvasSize.width / viewport.zoom, targetPosition.x)
        ),
        y: Math.max(
          constraints.bounds.minY,
          Math.min(constraints.bounds.maxY - canvasSize.height / viewport.zoom, targetPosition.y)
        ),
      };
      setPosition(constrainedPosition);
    } else {
      setPosition(targetPosition);
    }
  }, [mergedConfig.constrainToBounds, constraints.bounds, canvasSize, viewport.zoom, setPosition]);

  // ============================================================================
  // ENTITY MANAGEMENT
  // ============================================================================

  const updateEntities = useCallback((newEntities: ViewportEntity[]) => {
    setEntities(newEntities);
  }, []);

  const addEntity = useCallback((entity: ViewportEntity) => {
    setEntities(prev => {
      const existingIndex = prev.findIndex(e => e.id === entity.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = entity;
        return updated;
      }
      return [...prev, entity];
    });
  }, []);

  const removeEntity = useCallback((entityId: EntityId) => {
    setEntities(prev => prev.filter(e => e.id !== entityId));
  }, []);

  const getVisibleEntities = useCallback((): ViewportEntity[] => {
    return entities.map(entity => {
      const isVisible = containsPoint(expandBounds(visibleBounds, mergedConfig.bufferZone), {
        x: (entity.bounds.minX + entity.bounds.maxX) / 2,
        y: (entity.bounds.minY + entity.bounds.maxY) / 2,
      });

      const screenBounds = isVisible ? {
        minX: canvasToScreen({ x: entity.bounds.minX, y: entity.bounds.minY }, viewport).x,
        minY: canvasToScreen({ x: entity.bounds.minX, y: entity.bounds.minY }, viewport).y,
        maxX: canvasToScreen({ x: entity.bounds.maxX, y: entity.bounds.maxY }, viewport).x,
        maxY: canvasToScreen({ x: entity.bounds.maxX, y: entity.bounds.maxY }, viewport).y,
      } : undefined;

      return {
        ...entity,
        isVisible,
        screenBounds,
      };
    });
  }, [entities, visibleBounds, mergedConfig.bufferZone, viewport]);

  // ============================================================================
  // CONSTRAINT MANAGEMENT
  // ============================================================================

  const updateConstraints = useCallback((newConstraints: Partial<ViewportConstraints>) => {
    setConstraints(prev => ({ ...prev, ...newConstraints }));
  }, []);

  const clearConstraints = useCallback(() => {
    setConstraints({});
  }, []);

  // ============================================================================
  // VIEWPORT QUERIES
  // ============================================================================

  const isPointVisible = useCallback((point: CanvasPosition, includeBuffer: boolean = false): boolean => {
    const bounds = includeBuffer ? expandBounds(visibleBounds, mergedConfig.bufferZone) : visibleBounds;
    return containsPoint(bounds, point);
  }, [visibleBounds, mergedConfig.bufferZone]);

  const isBoundsVisible = useCallback((bounds: CanvasBounds, includeBuffer: boolean = false): boolean => {
    const checkBounds = includeBuffer ? expandBounds(visibleBounds, mergedConfig.bufferZone) : visibleBounds;
    return containsPoint(checkBounds, {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    });
  }, [visibleBounds, mergedConfig.bufferZone]);

  const getViewportInfo = useCallback(() => ({
    position: viewport.position,
    zoom: viewport.zoom,
    bounds: effectiveBounds,
    visibleBounds,
    contentBounds,
    centerPoint: metrics.centerPoint,
    canvasSize,
  }), [viewport, effectiveBounds, visibleBounds, contentBounds, metrics.centerPoint, canvasSize]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-fit content when enabled and content changes
  useEffect(() => {
    if (mergedConfig.autoFitContent && entities.length > 0) {
      fitContent(true);
    }
  }, [mergedConfig.autoFitContent, entities.length, fitContent]);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Viewport state
    viewport,
    metrics,
    constraints,
    visibleBounds,
    contentBounds,
    effectiveBounds,
    
    // Coordinate transformations
    toScreen,
    toCanvas,
    
    // Viewport operations
    fitContent,
    centerOnPoint,
    centerOnBounds,
    zoomToLevel,
    panToPosition,
    
    // Entity management
    entities: getVisibleEntities(),
    updateEntities,
    addEntity,
    removeEntity,
    getVisibleEntities,
    
    // Constraint management
    updateConstraints,
    clearConstraints,
    
    // Viewport queries
    isPointVisible,
    isBoundsVisible,
    getViewportInfo,
    
    // Configuration
    config: mergedConfig,
  };
};
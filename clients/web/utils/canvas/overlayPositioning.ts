/**
 * DOM Overlay Positioning System
 *
 * Utility functions for converting between Konva canvas coordinates and DOM coordinates.
 * Handles canvas transformations, viewport calculations, and overlay positioning for
 * edit mode and other DOM overlays that need to track canvas elements.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Position } from '@/types/common.types';
import type { CanvasPosition, ScreenPosition } from '@/types/canvas.types';
import type { Card } from '@/types/card.types';
import { useCanvasStore } from '@/stores/canvasStore';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * DOM position with pixel units
 */
export interface DOMPosition {
  x: number; // in pixels
  y: number; // in pixels
}

/**
 * Canvas viewport information for transformations
 */
export interface CanvasViewport {
  position: CanvasPosition; // Canvas pan position
  zoom: number; // Canvas zoom level
  containerOffset: {
    // DOM container offset from page
    left: number;
    top: number;
  };
  containerDimensions: {
    // DOM container dimensions
    width: number;
    height: number;
  };
  scrollOffset: {
    // Browser scroll position
    x: number;
    y: number;
  };
}

/**
 * Overlay position with bounds checking
 */
export interface OverlayPosition extends DOMPosition {
  isVisible: boolean; // Whether overlay is within viewport
  clampedX?: number; // X position clamped to viewport bounds
  clampedY?: number; // Y position clamped to viewport bounds
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; // Anchor point for edge cases
}

/**
 * Error types for coordinate transformations
 */
export class CoordinateTransformError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'CoordinateTransformError';
  }
}

// ============================================================================
// COORDINATE TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Convert Konva canvas coordinates to DOM coordinates
 *
 * @param konvaPos - Position in Konva canvas coordinate space
 * @param viewport - Current canvas viewport state
 * @returns DOM position in pixels
 * @throws {CoordinateTransformError} If transformation fails
 */
export function konvaToDOM(
  konvaPos: Position,
  viewport: CanvasViewport
): DOMPosition {
  // Validate inputs
  if (!konvaPos || typeof konvaPos.x !== 'number' || typeof konvaPos.y !== 'number' || isNaN(konvaPos.x) || isNaN(konvaPos.y)) {
    throw new CoordinateTransformError('Invalid Konva position', { konvaPos });
  }

  if (!viewport || typeof viewport.zoom !== 'number' || viewport.zoom <= 0 || isNaN(viewport.zoom)) {
    throw new CoordinateTransformError('Invalid viewport configuration', { viewport });
  }

  // Apply canvas transformations
  // DOM_x = (konva_x - viewport_pan_x) * zoom + container_offset_x
  // DOM_y = (konva_y - viewport_pan_y) * zoom + container_offset_y
  const domX = (konvaPos.x - viewport.position.x) * viewport.zoom + viewport.containerOffset.left;
  const domY = (konvaPos.y - viewport.position.y) * viewport.zoom + viewport.containerOffset.top;

  return {
    x: domX,
    y: domY,
  };
}

/**
 * Convert DOM coordinates to Konva canvas coordinates
 *
 * @param domPos - Position in DOM coordinate space (pixels)
 * @param viewport - Current canvas viewport state
 * @returns Konva canvas position
 * @throws {CoordinateTransformError} If transformation fails
 */
export function domToKonva(
  domPos: DOMPosition,
  viewport: CanvasViewport
): Position {
  // Validate inputs
  if (!domPos || typeof domPos.x !== 'number' || typeof domPos.y !== 'number' || isNaN(domPos.x) || isNaN(domPos.y)) {
    throw new CoordinateTransformError('Invalid DOM position', { domPos });
  }

  if (!viewport || typeof viewport.zoom !== 'number' || viewport.zoom <= 0 || isNaN(viewport.zoom)) {
    throw new CoordinateTransformError('Invalid viewport configuration', { viewport });
  }

  // Reverse the transformation
  // konva_x = (DOM_x - container_offset_x) / zoom + viewport_pan_x
  // konva_y = (DOM_y - container_offset_y) / zoom + viewport_pan_y
  const konvaX = (domPos.x - viewport.containerOffset.left) / viewport.zoom + viewport.position.x;
  const konvaY = (domPos.y - viewport.containerOffset.top) / viewport.zoom + viewport.position.y;

  return {
    x: konvaX,
    y: konvaY,
  };
}

/**
 * Calculate overlay position for a card, handling viewport bounds
 *
 * @param card - The card to position overlay for
 * @param viewport - Current canvas viewport state
 * @param containerElement - Canvas container HTML element
 * @param overlayDimensions - Optional overlay dimensions for bounds checking
 * @returns Overlay position with visibility and clamping information
 */
export function getOverlayPosition(
  card: Card,
  viewport: CanvasViewport,
  containerElement: HTMLElement,
  overlayDimensions?: { width: number; height: number }
): OverlayPosition {
  try {
    // Convert card position to DOM coordinates
    const domPos = konvaToDOM(card.position, viewport);

    // Calculate card bounds in DOM space
    const cardWidth = card.dimensions.width * viewport.zoom;
    const cardHeight = card.dimensions.height * viewport.zoom;

    // Check if card is within viewport
    const isWithinViewport =
      domPos.x + cardWidth >= viewport.containerOffset.left &&
      domPos.x <= viewport.containerOffset.left + viewport.containerDimensions.width &&
      domPos.y + cardHeight >= viewport.containerOffset.top &&
      domPos.y <= viewport.containerOffset.top + viewport.containerDimensions.height;

    if (!isWithinViewport) {
      return {
        x: domPos.x,
        y: domPos.y,
        isVisible: false,
        anchor: 'top-left',
      };
    }

    // Determine overlay positioning with edge handling
    let overlayX = domPos.x;
    let overlayY = domPos.y;
    let anchor: OverlayPosition['anchor'] = 'top-left';

    if (overlayDimensions) {
      const viewportRight = viewport.containerOffset.left + viewport.containerDimensions.width;
      const viewportBottom = viewport.containerOffset.top + viewport.containerDimensions.height;

      // Handle horizontal overflow
      if (overlayX + overlayDimensions.width > viewportRight) {
        // Try positioning from right edge
        const rightAlignedX = domPos.x + cardWidth - overlayDimensions.width;
        if (rightAlignedX >= viewport.containerOffset.left) {
          overlayX = rightAlignedX;
          anchor = anchor === 'top-left' ? 'top-right' : 'bottom-right';
        } else {
          // Clamp to viewport
          overlayX = Math.max(
            viewport.containerOffset.left,
            viewportRight - overlayDimensions.width
          );
        }
      }

      // Handle vertical overflow
      if (overlayY + overlayDimensions.height > viewportBottom) {
        // Try positioning from bottom edge
        const bottomAlignedY = domPos.y + cardHeight - overlayDimensions.height;
        if (bottomAlignedY >= viewport.containerOffset.top) {
          overlayY = bottomAlignedY;
          anchor = anchor === 'top-left' || anchor === 'top-right'
            ? 'bottom-left'
            : 'bottom-right';
        } else {
          // Clamp to viewport
          overlayY = Math.max(
            viewport.containerOffset.top,
            viewportBottom - overlayDimensions.height
          );
        }
      }

      // Ensure minimum visibility
      overlayX = Math.max(viewport.containerOffset.left, overlayX);
      overlayY = Math.max(viewport.containerOffset.top, overlayY);
    }

    return {
      x: overlayX,
      y: overlayY,
      isVisible: true,
      clampedX: overlayX !== domPos.x ? overlayX : undefined,
      clampedY: overlayY !== domPos.y ? overlayY : undefined,
      anchor,
    };
  } catch (error) {
    console.error('Failed to calculate overlay position:', error);
    return {
      x: 0,
      y: 0,
      isVisible: false,
      anchor: 'top-left',
    };
  }
}

// ============================================================================
// REACT HOOK FOR DYNAMIC OVERLAY POSITIONING
// ============================================================================

/**
 * Options for useOverlayPosition hook
 */
export interface UseOverlayPositionOptions {
  /** Overlay dimensions for bounds checking */
  overlayDimensions?: { width: number; height: number };
  /** Update frequency throttle in milliseconds */
  throttleMs?: number;
  /** Offset from card position */
  offset?: { x: number; y: number };
  /** Enable automatic updates on canvas changes */
  autoUpdate?: boolean;
}

/**
 * React hook for dynamic overlay positioning that tracks canvas transformations
 *
 * @param card - The card to position overlay for
 * @param isActive - Whether the overlay should be actively tracking
 * @param options - Hook configuration options
 * @returns Current overlay position with visibility state
 */
export function useOverlayPosition(
  card: Card | null,
  isActive: boolean,
  options: UseOverlayPositionOptions = {}
): OverlayPosition | null {
  const {
    overlayDimensions,
    throttleMs = 16, // ~60fps
    offset = { x: 0, y: 0 },
    autoUpdate = true,
  } = options;

  const [overlayPosition, setOverlayPosition] = useState<OverlayPosition | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Get canvas viewport state from store
  const viewport = useCanvasStore((state) => state.viewport);
  const zoom = useCanvasStore((state) => state.viewport.zoom);
  const position = useCanvasStore((state) => state.viewport.position);

  // Update overlay position
  const updatePosition = useCallback(() => {
    if (!card || !isActive) {
      setOverlayPosition(null);
      return;
    }

    // Find canvas container
    if (!containerRef.current) {
      containerRef.current = document.querySelector('[data-canvas-container]') as HTMLElement;
    }

    if (!containerRef.current) {
      console.warn('Canvas container not found');
      setOverlayPosition(null);
      return;
    }

    // Throttle updates
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) {
      return;
    }
    lastUpdateRef.current = now;

    // Get container bounds
    const rect = containerRef.current.getBoundingClientRect();

    // Build viewport configuration
    const canvasViewport: CanvasViewport = {
      position,
      zoom,
      containerOffset: {
        left: rect.left,
        top: rect.top,
      },
      containerDimensions: {
        width: rect.width,
        height: rect.height,
      },
      scrollOffset: {
        x: window.scrollX || window.pageXOffset || 0,
        y: window.scrollY || window.pageYOffset || 0,
      },
    };

    // Calculate overlay position
    const newPosition = getOverlayPosition(
      card,
      canvasViewport,
      containerRef.current,
      overlayDimensions
    );

    // Apply offset if provided
    if (offset.x || offset.y) {
      newPosition.x += offset.x;
      newPosition.y += offset.y;
    }

    setOverlayPosition(newPosition);
  }, [card, isActive, zoom, position, overlayDimensions, throttleMs, offset]);

  // Update position on dependencies change
  useEffect(() => {
    if (!autoUpdate || !isActive) {
      return;
    }

    // Initial update
    updatePosition();

    // Setup animation frame for smooth updates
    let animating = true;
    const animate = () => {
      if (animating) {
        updatePosition();
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      animating = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [updatePosition, autoUpdate, isActive]);

  // Handle window resize
  useEffect(() => {
    if (!isActive || !autoUpdate) {
      return;
    }

    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isActive, autoUpdate, updatePosition]);

  return overlayPosition;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two positions
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a position is within bounds
 */
export function isWithinBounds(
  position: Position,
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    position.x >= bounds.x &&
    position.x <= bounds.x + bounds.width &&
    position.y >= bounds.y &&
    position.y <= bounds.y + bounds.height
  );
}

/**
 * Clamp a position to bounds
 */
export function clampToBounds(
  position: Position,
  bounds: { x: number; y: number; width: number; height: number }
): Position {
  return {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, position.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, position.y)),
  };
}

/**
 * Get viewport bounds from canvas container
 */
export function getCanvasViewportBounds(containerElement?: HTMLElement | null): DOMRect | null {
  const container = containerElement || document.querySelector('[data-canvas-container]');
  return container ? container.getBoundingClientRect() : null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  konvaToDOM,
  domToKonva,
  getOverlayPosition,
  useOverlayPosition,
  calculateDistance,
  isWithinBounds,
  clampToBounds,
  getCanvasViewportBounds,
};
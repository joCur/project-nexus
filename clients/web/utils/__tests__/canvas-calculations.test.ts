/**
 * Canvas Calculations Utility Tests
 * 
 * Comprehensive tests for coordinate transformations, viewport culling,
 * geometric calculations, and performance optimization utilities.
 */

// Import the actual implementation to test, not the mock
import * as canvasCalculations from '../canvas-calculations';

const {
  // Coordinate transformations
  canvasToScreen,
  screenToCanvas,
  scaleToViewport,
  
  // Geometric calculations
  distance,
  angle,
  containsPoint,
  intersectsBounds,
  expandBounds,
  
  // Viewport culling
  getVisibleBounds,
  cullEntities,
  
  // Performance utilities
  getLevelOfDetail,
  shouldUseSimplifiedRendering,
  
  // Animation utilities
  easeOutCubic,
  interpolatePosition,
  interpolateZoom,
  
  // Bounds utilities
  calculateContentBounds,
  fitBoundsToViewport,
} = canvasCalculations;

import type {
  CullableEntity,
  CullingOptions,
} from '../canvas-calculations';

import type {
  CanvasPosition,
  ScreenPosition,
  CanvasBounds,
  ViewportState,
  ZoomLevel,
} from '@/types/canvas.types';
import type { EntityId } from '@/types/common.types';

// Clear any mocks for this specific test file
jest.unmock('@/utils/canvas-calculations');

describe('Canvas Calculations Utility', () => {
  // Test fixtures
  const mockViewport: ViewportState = {
    position: { x: 100, y: 50 },
    zoom: 2.0,
    bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
    isDirty: false,
  };

  const mockCanvasSize = { width: 800, height: 600 };

  const createMockEntity = (id: string, bounds: CanvasBounds, priority?: number): CullableEntity => ({
    id: id as EntityId,
    bounds,
    priority,
  });

  // ============================================================================
  // COORDINATE TRANSFORMATIONS TESTS
  // ============================================================================

  describe('Coordinate Transformations', () => {
    describe('canvasToScreen', () => {
      it('should transform canvas coordinates to screen coordinates correctly', () => {
        const canvasPos: CanvasPosition = { x: 200, y: 100 };
        const screenPos = canvasToScreen(canvasPos, mockViewport);

        // Expected: (200 - 100) * 2 = 200, (100 - 50) * 2 = 100
        expect(screenPos).toEqual({ x: 200, y: 100 });
      });

      it('should handle negative coordinates', () => {
        const canvasPos: CanvasPosition = { x: 50, y: 25 };
        const screenPos = canvasToScreen(canvasPos, mockViewport);

        // Expected: (50 - 100) * 2 = -100, (25 - 50) * 2 = -50
        expect(screenPos).toEqual({ x: -100, y: -50 });
      });

      it('should handle zero zoom correctly', () => {
        const viewport = { ...mockViewport, zoom: 0 };
        const canvasPos: CanvasPosition = { x: 200, y: 100 };
        const screenPos = canvasToScreen(canvasPos, viewport);

        expect(screenPos).toEqual({ x: 0, y: 0 });
      });

      it('should handle fractional zoom levels', () => {
        const viewport = { ...mockViewport, zoom: 0.5 };
        const canvasPos: CanvasPosition = { x: 300, y: 150 };
        const screenPos = canvasToScreen(canvasPos, viewport);

        // Expected: (300 - 100) * 0.5 = 100, (150 - 50) * 0.5 = 50
        expect(screenPos).toEqual({ x: 100, y: 50 });
      });
    });

    describe('screenToCanvas', () => {
      it('should transform screen coordinates to canvas coordinates correctly', () => {
        const screenPos: ScreenPosition = { x: 200, y: 100 };
        const canvasPos = screenToCanvas(screenPos, mockViewport);

        // Expected: 200 / 2 + 100 = 200, 100 / 2 + 50 = 100
        expect(canvasPos).toEqual({ x: 200, y: 100 });
      });

      it('should handle negative screen coordinates', () => {
        const screenPos: ScreenPosition = { x: -100, y: -50 };
        const canvasPos = screenToCanvas(screenPos, mockViewport);

        // Expected: -100 / 2 + 100 = 50, -50 / 2 + 50 = 25
        expect(canvasPos).toEqual({ x: 50, y: 25 });
      });

      it('should handle zero zoom by returning infinite values', () => {
        const viewport = { ...mockViewport, zoom: 0 };
        const screenPos: ScreenPosition = { x: 100, y: 50 };
        const canvasPos = screenToCanvas(screenPos, viewport);

        expect(canvasPos.x).toBe(Infinity);
        expect(canvasPos.y).toBe(Infinity);
      });

      it('should be inverse of canvasToScreen', () => {
        const originalCanvasPos: CanvasPosition = { x: 150, y: 75 };
        const screenPos = canvasToScreen(originalCanvasPos, mockViewport);
        const backToCanvasPos = screenToCanvas(screenPos, mockViewport);

        expect(backToCanvasPos.x).toBeCloseTo(originalCanvasPos.x, 10);
        expect(backToCanvasPos.y).toBeCloseTo(originalCanvasPos.y, 10);
      });
    });

    describe('scaleToViewport', () => {
      it('should scale canvas bounds to viewport coordinates', () => {
        const canvasBounds: CanvasBounds = {
          minX: 150, minY: 75,
          maxX: 250, maxY: 125,
        };
        const scaledBounds = scaleToViewport(canvasBounds, mockViewport);

        // Expected: min (150-100)*2=100, (75-50)*2=50
        //          max (250-100)*2=300, (125-50)*2=150
        expect(scaledBounds).toEqual({
          minX: 100, minY: 50,
          maxX: 300, maxY: 150,
        });
      });

      it('should handle bounds that span viewport origin', () => {
        const canvasBounds: CanvasBounds = {
          minX: 50, minY: 25,
          maxX: 150, maxY: 75,
        };
        const scaledBounds = scaleToViewport(canvasBounds, mockViewport);

        expect(scaledBounds).toEqual({
          minX: -100, minY: -50,
          maxX: 100, maxY: 50,
        });
      });
    });
  });

  // ============================================================================
  // GEOMETRIC CALCULATIONS TESTS
  // ============================================================================

  describe('Geometric Calculations', () => {
    describe('distance', () => {
      it('should calculate distance between two points correctly', () => {
        const from: CanvasPosition = { x: 0, y: 0 };
        const to: CanvasPosition = { x: 3, y: 4 };
        const result = distance(from, to);

        expect(result).toBe(5); // 3-4-5 triangle
      });

      it('should return 0 for same points', () => {
        const point: CanvasPosition = { x: 100, y: 200 };
        const result = distance(point, point);

        expect(result).toBe(0);
      });

      it('should handle negative coordinates', () => {
        const from: CanvasPosition = { x: -3, y: -4 };
        const to: CanvasPosition = { x: 0, y: 0 };
        const result = distance(from, to);

        expect(result).toBe(5);
      });

      it('should be symmetric', () => {
        const point1: CanvasPosition = { x: 10, y: 20 };
        const point2: CanvasPosition = { x: 30, y: 40 };

        const distance1 = distance(point1, point2);
        const distance2 = distance(point2, point1);

        expect(distance1).toBe(distance2);
      });
    });

    describe('angle', () => {
      it('should calculate angle correctly for horizontal line', () => {
        const from: CanvasPosition = { x: 0, y: 0 };
        const to: CanvasPosition = { x: 10, y: 0 };
        const result = angle(from, to);

        expect(result).toBe(0); // 0 radians for horizontal right
      });

      it('should calculate angle correctly for vertical line', () => {
        const from: CanvasPosition = { x: 0, y: 0 };
        const to: CanvasPosition = { x: 0, y: 10 };
        const result = angle(from, to);

        expect(result).toBeCloseTo(Math.PI / 2); // π/2 radians for vertical up
      });

      it('should calculate angle correctly for diagonal line', () => {
        const from: CanvasPosition = { x: 0, y: 0 };
        const to: CanvasPosition = { x: 10, y: 10 };
        const result = angle(from, to);

        expect(result).toBeCloseTo(Math.PI / 4); // π/4 radians for 45° angle
      });

      it('should handle negative angles', () => {
        const from: CanvasPosition = { x: 0, y: 0 };
        const to: CanvasPosition = { x: 10, y: -10 };
        const result = angle(from, to);

        expect(result).toBeCloseTo(-Math.PI / 4); // -π/4 radians for -45° angle
      });
    });

    describe('containsPoint', () => {
      const testBounds: CanvasBounds = {
        minX: 10, minY: 20,
        maxX: 100, maxY: 200,
      };

      it('should return true for point inside bounds', () => {
        const point: CanvasPosition = { x: 50, y: 100 };
        const result = containsPoint(testBounds, point);

        expect(result).toBe(true);
      });

      it('should return true for point on bounds edge', () => {
        const point1: CanvasPosition = { x: 10, y: 50 }; // Left edge
        const point2: CanvasPosition = { x: 100, y: 50 }; // Right edge
        const point3: CanvasPosition = { x: 50, y: 20 }; // Top edge
        const point4: CanvasPosition = { x: 50, y: 200 }; // Bottom edge

        expect(containsPoint(testBounds, point1)).toBe(true);
        expect(containsPoint(testBounds, point2)).toBe(true);
        expect(containsPoint(testBounds, point3)).toBe(true);
        expect(containsPoint(testBounds, point4)).toBe(true);
      });

      it('should return false for point outside bounds', () => {
        const point1: CanvasPosition = { x: 5, y: 100 }; // Left of bounds
        const point2: CanvasPosition = { x: 150, y: 100 }; // Right of bounds
        const point3: CanvasPosition = { x: 50, y: 10 }; // Above bounds
        const point4: CanvasPosition = { x: 50, y: 250 }; // Below bounds

        expect(containsPoint(testBounds, point1)).toBe(false);
        expect(containsPoint(testBounds, point2)).toBe(false);
        expect(containsPoint(testBounds, point3)).toBe(false);
        expect(containsPoint(testBounds, point4)).toBe(false);
      });
    });

    describe('intersectsBounds', () => {
      const bounds1: CanvasBounds = {
        minX: 0, minY: 0,
        maxX: 100, maxY: 100,
      };

      it('should return true for overlapping bounds', () => {
        const bounds2: CanvasBounds = {
          minX: 50, minY: 50,
          maxX: 150, maxY: 150,
        };

        expect(intersectsBounds(bounds1, bounds2)).toBe(true);
        expect(intersectsBounds(bounds2, bounds1)).toBe(true); // Should be symmetric
      });

      it('should return true for touching bounds', () => {
        const bounds2: CanvasBounds = {
          minX: 100, minY: 0,
          maxX: 200, maxY: 100,
        };

        expect(intersectsBounds(bounds1, bounds2)).toBe(true);
      });

      it('should return false for non-overlapping bounds', () => {
        const bounds2: CanvasBounds = {
          minX: 200, minY: 200,
          maxX: 300, maxY: 300,
        };

        expect(intersectsBounds(bounds1, bounds2)).toBe(false);
      });

      it('should return true for one bounds containing another', () => {
        const bounds2: CanvasBounds = {
          minX: 25, minY: 25,
          maxX: 75, maxY: 75,
        };

        expect(intersectsBounds(bounds1, bounds2)).toBe(true);
        expect(intersectsBounds(bounds2, bounds1)).toBe(true);
      });

      it('should handle identical bounds', () => {
        expect(intersectsBounds(bounds1, bounds1)).toBe(true);
      });
    });

    describe('expandBounds', () => {
      it('should expand bounds by margin correctly', () => {
        const originalBounds: CanvasBounds = {
          minX: 10, minY: 20,
          maxX: 100, maxY: 200,
        };
        const margin = 15;
        const expandedBounds = expandBounds(originalBounds, margin);

        expect(expandedBounds).toEqual({
          minX: -5, minY: 5,
          maxX: 115, maxY: 215,
        });
      });

      it('should handle zero margin', () => {
        const originalBounds: CanvasBounds = {
          minX: 10, minY: 20,
          maxX: 100, maxY: 200,
        };
        const expandedBounds = expandBounds(originalBounds, 0);

        expect(expandedBounds).toEqual(originalBounds);
      });

      it('should handle negative margin (shrink bounds)', () => {
        const originalBounds: CanvasBounds = {
          minX: 10, minY: 20,
          maxX: 100, maxY: 200,
        };
        const expandedBounds = expandBounds(originalBounds, -5);

        expect(expandedBounds).toEqual({
          minX: 15, minY: 25,
          maxX: 95, maxY: 195,
        });
      });
    });
  });

  // ============================================================================
  // VIEWPORT CULLING TESTS
  // ============================================================================

  describe('Viewport Culling', () => {
    describe('getVisibleBounds', () => {
      it('should calculate visible bounds with buffer zone', () => {
        const bufferZone = 100;
        const visibleBounds = getVisibleBounds(mockViewport, mockCanvasSize, bufferZone);

        // Screen corners with buffer: (-100, -100) and (900, 700)
        // Canvas coordinates: (-100)/2 + 100 = 50, (-100)/2 + 50 = 0
        //                    (900)/2 + 100 = 550, (700)/2 + 50 = 400
        expect(visibleBounds).toEqual({
          minX: 50, minY: 0,
          maxX: 550, maxY: 400,
        });
      });

      it('should handle zero buffer zone', () => {
        const visibleBounds = getVisibleBounds(mockViewport, mockCanvasSize, 0);

        // Screen corners: (0, 0) and (800, 600)
        // Canvas coordinates: 0/2 + 100 = 100, 0/2 + 50 = 50
        //                    800/2 + 100 = 500, 600/2 + 50 = 350
        expect(visibleBounds).toEqual({
          minX: 100, minY: 50,
          maxX: 500, maxY: 350,
        });
      });

      it('should work with different zoom levels', () => {
        const viewport = { ...mockViewport, zoom: 1.0 };
        const visibleBounds = getVisibleBounds(viewport, mockCanvasSize, 0);

        // With zoom 1.0: 0/1 + 100 = 100, 800/1 + 100 = 900
        expect(visibleBounds).toEqual({
          minX: 100, minY: 50,
          maxX: 900, maxY: 650,
        });
      });
    });

    describe('cullEntities', () => {
      const createTestEntities = (): CullableEntity[] => [
        createMockEntity('visible1', { minX: 150, minY: 100, maxX: 200, maxY: 150 }), // Visible
        createMockEntity('visible2', { minX: 300, minY: 200, maxX: 350, maxY: 250 }), // Visible
        createMockEntity('outside', { minX: 1000, minY: 1000, maxX: 1100, maxY: 1100 }), // Outside
        createMockEntity('highPriority', { minX: 2000, minY: 2000, maxX: 2100, maxY: 2100 }, 10), // High priority, outside
      ];

      it('should return visible entities within viewport bounds', () => {
        const entities = createTestEntities();
        const result = cullEntities(entities, mockViewport, mockCanvasSize);

        // Should include visible entities and high priority entity
        expect(result).toHaveLength(3);
        expect(result.map(e => e.id)).toContain('visible1');
        expect(result.map(e => e.id)).toContain('visible2');
        expect(result.map(e => e.id)).toContain('highPriority');
        expect(result.map(e => e.id)).not.toContain('outside');
      });

      it('should respect maxEntities limit', () => {
        const entities = createTestEntities();
        const options: Partial<CullingOptions> = { maxEntities: 2 };
        const result = cullEntities(entities, mockViewport, mockCanvasSize, options);

        expect(result).toHaveLength(2);
      });

      it('should prioritize high priority entities', () => {
        const entities = createTestEntities();
        const options: Partial<CullingOptions> = { maxEntities: 1, priorityThreshold: 5 };
        const result = cullEntities(entities, mockViewport, mockCanvasSize, options);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('highPriority');
      });

      it('should sort by distance when over maxEntities', () => {
        // Create entities at different distances from viewport center
        const entities: CullableEntity[] = [
          createMockEntity('close', { minX: 200, minY: 150, maxX: 250, maxY: 200 }, 1), // Close to center
          createMockEntity('medium', { minX: 300, minY: 250, maxX: 350, maxY: 300 }, 1), // Medium distance
          createMockEntity('far', { minX: 450, minY: 300, maxX: 500, maxY: 350 }, 1), // Far from center
        ];

        const options: Partial<CullingOptions> = { maxEntities: 2 };
        const result = cullEntities(entities, mockViewport, mockCanvasSize, options);

        expect(result).toHaveLength(2);
        // Should prefer closer entities
        expect(result.map(e => e.id)).toContain('close');
        expect(result.map(e => e.id)).toContain('medium');
        expect(result.map(e => e.id)).not.toContain('far');
      });

      it('should handle empty entities array', () => {
        const result = cullEntities([], mockViewport, mockCanvasSize);

        expect(result).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // PERFORMANCE UTILITIES TESTS
  // ============================================================================

  describe('Performance Utilities', () => {
    describe('getLevelOfDetail', () => {
      it('should return low detail for very small zoom levels', () => {
        expect(getLevelOfDetail(0.25)).toBe('low');
        expect(getLevelOfDetail(0.4)).toBe('low');
      });

      it('should return medium detail for moderate zoom levels', () => {
        expect(getLevelOfDetail(0.5)).toBe('medium');
        expect(getLevelOfDetail(1.0)).toBe('medium');
        expect(getLevelOfDetail(1.4)).toBe('medium');
      });

      it('should return high detail for large zoom levels', () => {
        expect(getLevelOfDetail(1.5)).toBe('high');
        expect(getLevelOfDetail(2.0)).toBe('high');
        expect(getLevelOfDetail(4.0)).toBe('high');
      });

      it('should handle boundary values correctly', () => {
        expect(getLevelOfDetail(0.5)).toBe('medium');
        expect(getLevelOfDetail(1.5)).toBe('high');
      });
    });

    describe('shouldUseSimplifiedRendering', () => {
      it('should return true for very small entities', () => {
        const entityBounds: CanvasBounds = {
          minX: 100, minY: 100,
          maxX: 102, maxY: 102, // 4x4 pixels at zoom 2.0
        };

        const result = shouldUseSimplifiedRendering(entityBounds, mockViewport, 10);
        expect(result).toBe(true);
      });

      it('should return false for sufficiently large entities', () => {
        const entityBounds: CanvasBounds = {
          minX: 100, minY: 100,
          maxX: 120, maxY: 120, // 40x40 pixels at zoom 2.0
        };

        const result = shouldUseSimplifiedRendering(entityBounds, mockViewport, 10);
        expect(result).toBe(false);
      });

      it('should respect custom minPixelSize threshold', () => {
        const entityBounds: CanvasBounds = {
          minX: 100, minY: 100,
          maxX: 115, maxY: 115, // 30x30 pixels at zoom 2.0
        };

        // 30x30 pixels should be greater than 20 threshold but less than 40
        expect(shouldUseSimplifiedRendering(entityBounds, mockViewport, 40)).toBe(true);
        expect(shouldUseSimplifiedRendering(entityBounds, mockViewport, 20)).toBe(false);
      });

      it('should handle zero-sized entities', () => {
        const entityBounds: CanvasBounds = {
          minX: 100, minY: 100,
          maxX: 100, maxY: 100,
        };

        const result = shouldUseSimplifiedRendering(entityBounds, mockViewport);
        expect(result).toBe(true);
      });
    });
  });

  // ============================================================================
  // ANIMATION UTILITIES TESTS
  // ============================================================================

  describe('Animation Utilities', () => {
    describe('easeOutCubic', () => {
      it('should return 0 for input 0', () => {
        expect(easeOutCubic(0)).toBe(0);
      });

      it('should return 1 for input 1', () => {
        expect(easeOutCubic(1)).toBe(1);
      });

      it('should produce smooth curve for intermediate values', () => {
        const values = [0.25, 0.5, 0.75];
        const results = values.map(easeOutCubic);

        // Should be monotonically increasing
        for (let i = 1; i < results.length; i++) {
          expect(results[i]).toBeGreaterThan(results[i - 1]);
        }

        // Should be in valid range
        results.forEach(result => {
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        });
      });

      it('should start fast and slow down (ease out behavior)', () => {
        const early = easeOutCubic(0.1);
        const late = easeOutCubic(0.9);

        // For ease-out functions, the curve should be steeper at the start and flatten at the end
        // At t=0.1, the eased value should be greater than linear progress
        expect(early).toBeGreaterThan(0.1);
        
        // At t=0.9, the eased value should be close to but less than 1
        expect(late).toBeGreaterThan(0.9);
        expect(late).toBeLessThan(1.0);
        
        // The derivative (rate of change) should be higher early than late
        const earlyRate = easeOutCubic(0.2) - easeOutCubic(0.1);
        const lateRate = easeOutCubic(0.9) - easeOutCubic(0.8);
        expect(earlyRate).toBeGreaterThan(lateRate);
      });
    });

    describe('interpolatePosition', () => {
      const from: CanvasPosition = { x: 0, y: 0 };
      const to: CanvasPosition = { x: 100, y: 200 };

      it('should return from position for progress 0', () => {
        const result = interpolatePosition(from, to, 0);
        expect(result).toEqual(from);
      });

      it('should return to position for progress 1', () => {
        const result = interpolatePosition(from, to, 1);
        expect(result).toEqual(to);
      });

      it('should interpolate correctly for intermediate progress', () => {
        const result = interpolatePosition(from, to, 0.5);
        
        // With easing, 0.5 progress won't be exactly halfway
        const easedProgress = easeOutCubic(0.5);
        const expected: CanvasPosition = {
          x: from.x + (to.x - from.x) * easedProgress,
          y: from.y + (to.y - from.y) * easedProgress,
        };

        expect(result.x).toBeCloseTo(expected.x);
        expect(result.y).toBeCloseTo(expected.y);
      });

      it('should handle negative coordinates', () => {
        const fromNeg: CanvasPosition = { x: -50, y: -100 };
        const toNeg: CanvasPosition = { x: 50, y: 100 };

        const result = interpolatePosition(fromNeg, toNeg, 0.5);
        expect(result.x).toBeGreaterThan(fromNeg.x);
        expect(result.x).toBeLessThan(toNeg.x);
        expect(result.y).toBeGreaterThan(fromNeg.y);
        expect(result.y).toBeLessThan(toNeg.y);
      });
    });

    describe('interpolateZoom', () => {
      const fromZoom: ZoomLevel = 1.0;
      const toZoom: ZoomLevel = 2.0;

      it('should return from zoom for progress 0', () => {
        const result = interpolateZoom(fromZoom, toZoom, 0);
        expect(result).toBe(fromZoom);
      });

      it('should return to zoom for progress 1', () => {
        const result = interpolateZoom(fromZoom, toZoom, 1);
        expect(result).toBe(toZoom);
      });

      it('should interpolate correctly for intermediate progress', () => {
        const result = interpolateZoom(fromZoom, toZoom, 0.5);
        
        const easedProgress = easeOutCubic(0.5);
        const expected = fromZoom + (toZoom - fromZoom) * easedProgress;

        expect(result).toBeCloseTo(expected);
      });

      it('should handle zoom out (decreasing)', () => {
        const result = interpolateZoom(2.0, 1.0, 0.25);
        expect(result).toBeLessThan(2.0);
        expect(result).toBeGreaterThan(1.0);
      });
    });
  });

  // ============================================================================
  // BOUNDS UTILITIES TESTS
  // ============================================================================

  describe('Bounds Utilities', () => {
    describe('calculateContentBounds', () => {
      it('should return default bounds for empty entities array', () => {
        const result = calculateContentBounds([], 50);

        expect(result).toEqual({
          minX: -50, minY: -50,
          maxX: 50, maxY: 50,
        });
      });

      it('should calculate bounds for single entity', () => {
        const entities = [createMockEntity('single', {
          minX: 10, minY: 20,
          maxX: 100, maxY: 200,
        })];

        const result = calculateContentBounds(entities, 25);

        expect(result).toEqual({
          minX: -15, minY: -5, // 10 - 25, 20 - 25
          maxX: 125, maxY: 225, // 100 + 25, 200 + 25
        });
      });

      it('should calculate bounds for multiple entities', () => {
        const entities = [
          createMockEntity('entity1', { minX: 0, minY: 0, maxX: 50, maxY: 50 }),
          createMockEntity('entity2', { minX: 100, minY: 100, maxX: 200, maxY: 300 }),
          createMockEntity('entity3', { minX: -50, minY: 25, maxX: 0, maxY: 75 }),
        ];

        const result = calculateContentBounds(entities, 10);

        expect(result).toEqual({
          minX: -60, minY: -10, // -50 - 10, 0 - 10
          maxX: 210, maxY: 310, // 200 + 10, 300 + 10
        });
      });

      it('should handle zero padding', () => {
        const entities = [createMockEntity('entity', {
          minX: 10, minY: 20,
          maxX: 100, maxY: 200,
        })];

        const result = calculateContentBounds(entities, 0);

        expect(result).toEqual({
          minX: 10, minY: 20,
          maxX: 100, maxY: 200,
        });
      });
    });

    describe('fitBoundsToViewport', () => {
      const testBounds: CanvasBounds = {
        minX: 0, minY: 0,
        maxX: 400, maxY: 300, // 400x300 content
      };

      it('should fit content to viewport with appropriate zoom and position', () => {
        const result = fitBoundsToViewport(testBounds, mockCanvasSize);

        // Content is 400x300, viewport is 800x600 (with padding)
        // Should fit with zoom that maintains aspect ratio
        expect(result.zoom).toBeGreaterThan(0);
        expect(result.zoom).toBeLessThanOrEqual(4.0);
        
        // Position should center the content
        expect(result.position.x).toBeDefined();
        expect(result.position.y).toBeDefined();
      });

      it('should respect max zoom limit', () => {
        const smallBounds: CanvasBounds = {
          minX: 0, minY: 0,
          maxX: 10, maxY: 10, // Very small content
        };

        const result = fitBoundsToViewport(smallBounds, mockCanvasSize, 2.0); // Max zoom 2.0

        expect(result.zoom).toBeLessThanOrEqual(2.0);
      });

      it('should respect min zoom limit', () => {
        const largeBounds: CanvasBounds = {
          minX: 0, minY: 0,
          maxX: 4000, maxY: 3000, // Very large content
        };

        const result = fitBoundsToViewport(largeBounds, mockCanvasSize, 4.0, 0.5); // Min zoom 0.5

        expect(result.zoom).toBeGreaterThanOrEqual(0.5);
      });

      it('should handle custom padding', () => {
        const result1 = fitBoundsToViewport(testBounds, mockCanvasSize, 4.0, 0.25, 10);
        const result2 = fitBoundsToViewport(testBounds, mockCanvasSize, 4.0, 0.25, 100);

        // With more padding, zoom should be smaller to fit content
        expect(result2.zoom).toBeLessThanOrEqual(result1.zoom);
      });

      it('should center content properly', () => {
        const result = fitBoundsToViewport(testBounds, mockCanvasSize);

        // Calculate expected center position
        const boundsCenter = {
          x: (testBounds.minX + testBounds.maxX) / 2,
          y: (testBounds.minY + testBounds.maxY) / 2,
        };

        const expectedX = boundsCenter.x - mockCanvasSize.width / (2 * result.zoom);
        const expectedY = boundsCenter.y - mockCanvasSize.height / (2 * result.zoom);

        expect(result.position.x).toBeCloseTo(expectedX);
        expect(result.position.y).toBeCloseTo(expectedY);
      });

      it('should handle square content in rectangular viewport', () => {
        const squareBounds: CanvasBounds = {
          minX: 0, minY: 0,
          maxX: 300, maxY: 300, // Square content
        };

        const result = fitBoundsToViewport(squareBounds, mockCanvasSize);

        // Should fit within the smaller dimension of the viewport
        expect(result.zoom).toBeGreaterThan(0);
        expect(result.position).toBeDefined();
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should work correctly with coordinate transformation round trips', () => {
      const originalCanvasPosition: CanvasPosition = { x: 250, y: 150 };
      
      // Canvas -> Screen -> Canvas
      const screenPosition = canvasToScreen(originalCanvasPosition, mockViewport);
      const backToCanvas = screenToCanvas(screenPosition, mockViewport);

      expect(backToCanvas.x).toBeCloseTo(originalCanvasPosition.x, 10);
      expect(backToCanvas.y).toBeCloseTo(originalCanvasPosition.y, 10);
    });

    it('should maintain entity visibility after viewport transformations', () => {
      const entities = [
        createMockEntity('visible', { minX: 200, minY: 100, maxX: 300, maxY: 200 }),
        createMockEntity('outside', { minX: 1000, minY: 1000, maxX: 1100, maxY: 1100 }),
      ];

      const visibleBounds = getVisibleBounds(mockViewport, mockCanvasSize);
      const culledEntities = cullEntities(entities, mockViewport, mockCanvasSize);

      // Verify that the culling aligns with visible bounds calculation
      expect(culledEntities.length).toBeGreaterThan(0);
      expect(culledEntities.map(e => e.id)).toContain('visible');
    });

    it('should provide consistent level of detail across zoom changes', () => {
      const zoomLevels = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
      const lodLevels = zoomLevels.map(getLevelOfDetail);

      // Should have monotonic progression
      const lowCount = lodLevels.filter(lod => lod === 'low').length;
      const mediumCount = lodLevels.filter(lod => lod === 'medium').length;
      const highCount = lodLevels.filter(lod => lod === 'high').length;

      expect(lowCount + mediumCount + highCount).toBe(zoomLevels.length);
      expect(lowCount).toBeGreaterThan(0);
      expect(highCount).toBeGreaterThan(0);
    });

    it('should handle performance optimizations with culling', () => {
      // Create many entities, some visible, some not
      const entities: CullableEntity[] = [];
      for (let i = 0; i < 1000; i++) {
        entities.push(createMockEntity(`entity${i}`, {
          minX: Math.random() * 2000,
          minY: Math.random() * 2000,
          maxX: Math.random() * 2000 + 50,
          maxY: Math.random() * 2000 + 50,
        }));
      }

      const startTime = performance.now();
      const culledEntities = cullEntities(entities, mockViewport, mockCanvasSize, {
        maxEntities: 100,
      });
      const endTime = performance.now();

      // Should complete quickly and respect limits
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(culledEntities.length).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR CONDITIONS
  // ============================================================================

  describe('Edge Cases and Error Conditions', () => {
    it('should handle extreme viewport positions', () => {
      const extremeViewport: ViewportState = {
        position: { x: -10000, y: 10000 },
        zoom: 0.1,
        bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
        isDirty: false,
      };

      expect(() => {
        canvasToScreen({ x: 0, y: 0 }, extremeViewport);
        screenToCanvas({ x: 400, y: 300 }, extremeViewport);
        getVisibleBounds(extremeViewport, mockCanvasSize);
      }).not.toThrow();
    });

    it('should handle extreme zoom levels', () => {
      const extremeViewports = [
        { ...mockViewport, zoom: 0.001 },
        { ...mockViewport, zoom: 1000 },
      ];

      extremeViewports.forEach(viewport => {
        expect(() => {
          canvasToScreen({ x: 100, y: 100 }, viewport);
          getVisibleBounds(viewport, mockCanvasSize);
        }).not.toThrow();
      });
    });

    it('should handle malformed bounds', () => {
      const malformedBounds: CanvasBounds = {
        minX: 100, minY: 200,
        maxX: 50, maxY: 100, // Max < Min
      };

      expect(() => {
        containsPoint(malformedBounds, { x: 75, y: 150 });
        expandBounds(malformedBounds, 10);
      }).not.toThrow();
    });

    it('should handle very large entity collections', () => {
      const largeEntityArray = Array.from({ length: 10000 }, (_, i) => 
        createMockEntity(`entity${i}`, {
          minX: i, minY: i,
          maxX: i + 10, maxY: i + 10,
        })
      );

      const startTime = performance.now();
      const result = cullEntities(largeEntityArray, mockViewport, mockCanvasSize, {
        maxEntities: 50,
      });
      const endTime = performance.now();

      expect(result).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle invalid input gracefully', () => {
      // Test with NaN and Infinity values
      const invalidPosition: CanvasPosition = { x: NaN, y: Infinity };
      const invalidViewport: ViewportState = {
        position: { x: NaN, y: NaN },
        zoom: 0,
        bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
        isDirty: false,
      };

      expect(() => {
        canvasToScreen(invalidPosition, mockViewport);
        screenToCanvas({ x: NaN, y: NaN }, invalidViewport);
        distance(invalidPosition, { x: 0, y: 0 });
      }).not.toThrow();
    });
  });
});
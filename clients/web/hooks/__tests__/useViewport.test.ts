/**
 * Viewport Management Hook Tests
 * 
 * Comprehensive tests for viewport bounds calculation, entity management,
 * coordinate transformations, and viewport operations.
 */

import { renderHook, act } from '@testing-library/react';
import { useViewport, ViewportConfig, ViewportEntity, ViewportConstraints } from '../useViewport';
import { useCanvasStore } from '@/stores/canvasStore';
import type {
  CanvasPosition,
  ScreenPosition,
  CanvasBounds,
  ZoomLevel,
  ViewportState,
  CanvasConfig,
} from '@/types/canvas.types';
import type { EntityId } from '@/types/common.types';

// Mock the canvas store
jest.mock('@/stores/canvasStore');

// Mock canvas calculations utility functions
jest.mock('@/utils/canvas-calculations', () => ({
  getVisibleBounds: jest.fn(),
  calculateContentBounds: jest.fn(),
  fitBoundsToViewport: jest.fn(),
  containsPoint: jest.fn(),
  expandBounds: jest.fn(),
  canvasToScreen: jest.fn(),
  screenToCanvas: jest.fn(),
}));

const {
  getVisibleBounds,
  calculateContentBounds,
  fitBoundsToViewport,
  containsPoint,
  expandBounds,
  canvasToScreen,
  screenToCanvas,
} = require('@/utils/canvas-calculations');

describe('useViewport', () => {
  let mockSetPosition: jest.Mock;
  let mockSetZoom: jest.Mock;
  let mockViewport: ViewportState;
  let mockCanvasConfig: CanvasConfig;
  const mockCanvasSize = { width: 800, height: 600 };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock store functions
    mockSetPosition = jest.fn();
    mockSetZoom = jest.fn();

    mockViewport = {
      position: { x: 100, y: 50 },
      zoom: 1.5,
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
      isDirty: false,
    };

    mockCanvasConfig = {
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      zoom: { min: 0.25, max: 4.0, step: 0.1 },
      performance: { enableCulling: true, enableVirtualization: true, maxVisibleCards: 1000 },
    };

    (useCanvasStore as unknown as jest.Mock).mockReturnValue({
      viewport: mockViewport,
      config: mockCanvasConfig,
      setPosition: mockSetPosition,
      setZoom: mockSetZoom,
    });

    // Mock utility functions with default implementations
    (getVisibleBounds as jest.Mock).mockReturnValue({
      minX: 50, minY: 25, maxX: 583, maxY: 425,
    });

    (calculateContentBounds as jest.Mock).mockReturnValue({
      minX: -100, minY: -100, maxX: 300, maxY: 250,
    });

    (fitBoundsToViewport as jest.Mock).mockReturnValue({
      position: { x: 0, y: 0 },
      zoom: 1.0,
    });

    (containsPoint as jest.Mock).mockImplementation((bounds: CanvasBounds, point: CanvasPosition) => {
      return point.x >= bounds.minX && point.x <= bounds.maxX &&
             point.y >= bounds.minY && point.y <= bounds.maxY;
    });

    (expandBounds as jest.Mock).mockImplementation((bounds: CanvasBounds, margin: number) => ({
      minX: bounds.minX - margin,
      minY: bounds.minY - margin,
      maxX: bounds.maxX + margin,
      maxY: bounds.maxY + margin,
    }));

    (canvasToScreen as jest.Mock).mockImplementation((pos: CanvasPosition, viewport: ViewportState) => ({
      x: (pos.x - viewport.position.x) * viewport.zoom,
      y: (pos.y - viewport.position.y) * viewport.zoom,
    }));

    (screenToCanvas as jest.Mock).mockImplementation((pos: ScreenPosition, viewport: ViewportState) => ({
      x: pos.x / viewport.zoom + viewport.position.x,
      y: pos.y / viewport.zoom + viewport.position.y,
    }));
  });

  const createMockEntity = (id: string, bounds: CanvasBounds, priority?: number): ViewportEntity => ({
    id: id as EntityId,
    bounds,
    priority,
  });

  // ============================================================================
  // INITIALIZATION AND CONFIGURATION TESTS
  // ============================================================================

  describe('Initialization and Configuration', () => {
    it('should initialize with default configuration', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      expect(result.current.config).toEqual({
        enableDynamicBounds: true,
        boundsPadding: 200,
        bufferZone: 300,
        autoFitContent: false,
        constrainToBounds: false,
        enableViewportTracking: true,
      });
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<ViewportConfig> = {
        enableDynamicBounds: false,
        bufferZone: 500,
        autoFitContent: true,
      };

      const { result } = renderHook(() => useViewport(mockCanvasSize, customConfig));

      expect(result.current.config).toEqual({
        enableDynamicBounds: false,
        boundsPadding: 200,
        bufferZone: 500,
        autoFitContent: true,
        constrainToBounds: false,
        enableViewportTracking: true,
      });
    });

    it('should provide initial viewport state', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      expect(result.current.viewport).toBe(mockViewport);
      expect(result.current.visibleBounds).toBeDefined();
      expect(result.current.contentBounds).toBeDefined();
      expect(result.current.effectiveBounds).toBeDefined();
    });

    it('should calculate metrics correctly', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      expect(result.current.metrics).toMatchObject({
        visibleBounds: expect.any(Object),
        contentBounds: expect.any(Object),
        effectiveBounds: expect.any(Object),
        viewportArea: expect.any(Number),
        contentCoverage: expect.any(Number),
        zoomLevel: mockViewport.zoom,
        centerPoint: expect.any(Object),
        isContentVisible: expect.any(Boolean),
      });

      expect(result.current.metrics.zoomLevel).toBe(1.5);
    });
  });

  // ============================================================================
  // VIEWPORT CALCULATIONS TESTS
  // ============================================================================

  describe('Viewport Calculations', () => {
    it('should calculate visible bounds with buffer zone', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize, { bufferZone: 200 }));

      expect(getVisibleBounds).toHaveBeenCalledWith(mockViewport, mockCanvasSize, 200);
      expect(result.current.visibleBounds).toBeDefined();
    });

    it('should calculate content bounds from entities', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      // Add entities to trigger content bounds calculation
      const entities = [
        createMockEntity('entity1', { minX: 0, minY: 0, maxX: 100, maxY: 100 }),
        createMockEntity('entity2', { minX: 200, minY: 150, maxX: 300, maxY: 250 }),
      ];

      act(() => {
        result.current.updateEntities(entities);
      });

      expect(calculateContentBounds).toHaveBeenCalledWith(entities, 200);
    });

    it('should use dynamic bounds when enabled', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize, { enableDynamicBounds: true }));

      // With dynamic bounds, effective bounds should be content bounds
      expect(result.current.effectiveBounds).toBe(result.current.contentBounds);
    });

    it('should use visible bounds when dynamic bounds disabled', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize, { enableDynamicBounds: false }));

      // Without dynamic bounds, effective bounds should be visible bounds
      expect(result.current.effectiveBounds).toBe(result.current.visibleBounds);
    });

    it('should apply constraints to effective bounds', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const constraintBounds: CanvasBounds = {
        minX: -50, minY: -50, maxX: 400, maxY: 300,
      };

      act(() => {
        result.current.updateConstraints({ bounds: constraintBounds });
      });

      expect(result.current.effectiveBounds).toBe(constraintBounds);
    });

    it('should calculate viewport metrics correctly', () => {
      (getVisibleBounds as jest.Mock).mockReturnValue({
        minX: 0, minY: 0, maxX: 400, maxY: 300, // 400x300 viewport
      });

      (calculateContentBounds as jest.Mock).mockReturnValue({
        minX: 50, minY: 50, maxX: 250, maxY: 200, // 200x150 content
      });

      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const metrics = result.current.metrics;
      expect(metrics.viewportArea).toBe(400 * 300); // 120,000
      
      // Content coverage is viewportArea / contentArea
      // Content area = (250 - 50) * (200 - 50) = 200 * 150 = 30,000
      // Viewport area = 400 * 300 = 120,000
      // Coverage = min(120,000 / 30,000, 1) = min(4, 1) = 1
      expect(metrics.contentCoverage).toBeCloseTo(1.0);
    });
  });

  // ============================================================================
  // COORDINATE TRANSFORMATIONS TESTS
  // ============================================================================

  describe('Coordinate Transformations', () => {
    it('should provide canvas to screen transformation', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const canvasPos: CanvasPosition = { x: 200, y: 150 };
      const screenPos = result.current.toScreen(canvasPos);

      expect(canvasToScreen).toHaveBeenCalledWith(canvasPos, mockViewport);
      expect(screenPos).toBeDefined();
    });

    it('should provide screen to canvas transformation', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const screenPos: ScreenPosition = { x: 300, y: 200 };
      const canvasPos = result.current.toCanvas(screenPos);

      expect(screenToCanvas).toHaveBeenCalledWith(screenPos, mockViewport);
      expect(canvasPos).toBeDefined();
    });

    it('should update transformations when viewport changes', () => {
      const { result, rerender } = renderHook(() => useViewport(mockCanvasSize));

      const originalCanvasPos: CanvasPosition = { x: 100, y: 100 };
      result.current.toScreen(originalCanvasPos);

      // Clear mock calls
      (canvasToScreen as jest.Mock).mockClear();

      // Update viewport
      const newViewport = { ...mockViewport, zoom: 2.0 };
      (useCanvasStore as unknown as jest.Mock).mockReturnValue({
        viewport: newViewport,
        config: mockCanvasConfig,
        setPosition: mockSetPosition,
        setZoom: mockSetZoom,
      });

      rerender();

      // Call transformation again
      result.current.toScreen(originalCanvasPos);

      // Should use updated viewport
      expect(canvasToScreen).toHaveBeenCalledWith(originalCanvasPos, newViewport);
    });
  });

  // ============================================================================
  // VIEWPORT OPERATIONS TESTS
  // ============================================================================

  describe('Viewport Operations', () => {
    describe('fitContent', () => {
      it('should fit content bounds to viewport', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        (fitBoundsToViewport as jest.Mock).mockReturnValue({
          position: { x: 150, y: 100 },
          zoom: 1.2,
        });

        act(() => {
          result.current.fitContent();
        });

        expect(fitBoundsToViewport).toHaveBeenCalledWith(
          result.current.contentBounds,
          mockCanvasSize,
          mockCanvasConfig.zoom.max,
          mockCanvasConfig.zoom.min,
          50
        );

        expect(mockSetZoom).toHaveBeenCalledWith(1.2);
        expect(mockSetPosition).toHaveBeenCalledWith({ x: 150, y: 100 });
      });

      it('should fit custom bounds when provided', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const customBounds: CanvasBounds = {
          minX: 100, minY: 50, maxX: 300, maxY: 200,
        };

        act(() => {
          result.current.fitContent(true, customBounds, 25);
        });

        expect(fitBoundsToViewport).toHaveBeenCalledWith(
          customBounds,
          mockCanvasSize,
          mockCanvasConfig.zoom.max,
          mockCanvasConfig.zoom.min,
          25
        );
      });

      it('should respect zoom constraints from viewport constraints', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const constraints: ViewportConstraints = {
          minZoom: 0.5,
          maxZoom: 2.0,
        };

        act(() => {
          result.current.updateConstraints(constraints);
        });

        act(() => {
          result.current.fitContent();
        });

        expect(fitBoundsToViewport).toHaveBeenCalledWith(
          expect.any(Object),
          mockCanvasSize,
          2.0, // Custom max zoom
          0.5, // Custom min zoom
          50
        );
      });
    });

    describe('centerOnPoint', () => {
      it('should center viewport on specific point', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const centerPoint: CanvasPosition = { x: 250, y: 150 };

        act(() => {
          result.current.centerOnPoint(centerPoint);
        });

        // Calculate expected position
        const expectedX = centerPoint.x - mockCanvasSize.width / (2 * mockViewport.zoom);
        const expectedY = centerPoint.y - mockCanvasSize.height / (2 * mockViewport.zoom);

        expect(mockSetPosition).toHaveBeenCalledWith({
          x: expectedX,
          y: expectedY,
        });
      });

      it('should center with custom zoom level', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const centerPoint: CanvasPosition = { x: 250, y: 150 };
        const targetZoom: ZoomLevel = 2.0;

        act(() => {
          result.current.centerOnPoint(centerPoint, targetZoom);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(targetZoom);

        const expectedX = centerPoint.x - mockCanvasSize.width / (2 * targetZoom);
        const expectedY = centerPoint.y - mockCanvasSize.height / (2 * targetZoom);

        expect(mockSetPosition).toHaveBeenCalledWith({
          x: expectedX,
          y: expectedY,
        });
      });

      it('should not change zoom if same as current', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const centerPoint: CanvasPosition = { x: 250, y: 150 };

        act(() => {
          result.current.centerOnPoint(centerPoint, mockViewport.zoom); // Same zoom
        });

        expect(mockSetZoom).not.toHaveBeenCalled();
        expect(mockSetPosition).toHaveBeenCalled();
      });
    });

    describe('centerOnBounds', () => {
      it('should center and fit bounds to viewport', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const bounds: CanvasBounds = {
          minX: 100, minY: 50, maxX: 300, maxY: 200,
        };

        (fitBoundsToViewport as jest.Mock).mockReturnValue({
          position: { x: 175, y: 90 },
          zoom: 1.8,
        });

        act(() => {
          result.current.centerOnBounds(bounds, 30);
        });

        expect(fitBoundsToViewport).toHaveBeenCalledWith(
          bounds,
          mockCanvasSize,
          mockCanvasConfig.zoom.max,
          mockCanvasConfig.zoom.min,
          30
        );

        expect(mockSetZoom).toHaveBeenCalledWith(1.8);
        expect(mockSetPosition).toHaveBeenCalledWith({ x: 175, y: 90 });
      });
    });

    describe('zoomToLevel', () => {
      it('should zoom to specified level', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const targetZoom: ZoomLevel = 2.5;

        act(() => {
          result.current.zoomToLevel(targetZoom);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(targetZoom);
      });

      it('should clamp zoom to constraints', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const constraints: ViewportConstraints = {
          minZoom: 0.5,
          maxZoom: 2.0,
        };

        act(() => {
          result.current.updateConstraints(constraints);
        });

        // Try to zoom beyond max
        act(() => {
          result.current.zoomToLevel(3.0);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(2.0); // Clamped to max

        // Try to zoom below min
        act(() => {
          result.current.zoomToLevel(0.1);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(0.5); // Clamped to min
      });

      it('should zoom toward focus point when provided', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const targetZoom: ZoomLevel = 2.0;
        const focusPoint: CanvasPosition = { x: 300, y: 200 };

        act(() => {
          result.current.zoomToLevel(targetZoom, focusPoint);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(targetZoom);

        const expectedX = focusPoint.x - mockCanvasSize.width / (2 * targetZoom);
        const expectedY = focusPoint.y - mockCanvasSize.height / (2 * targetZoom);

        expect(mockSetPosition).toHaveBeenCalledWith({
          x: expectedX,
          y: expectedY,
        });
      });
    });

    describe('panToPosition', () => {
      it('should pan to position without constraints', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize, { constrainToBounds: false }));

        const targetPosition: CanvasPosition = { x: 250, y: 175 };

        act(() => {
          result.current.panToPosition(targetPosition);
        });

        expect(mockSetPosition).toHaveBeenCalledWith(targetPosition);
      });

      it('should constrain position when enabled', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize, { constrainToBounds: true }));

        const constraintBounds: CanvasBounds = {
          minX: 0, minY: 0, maxX: 500, maxY: 400,
        };

        act(() => {
          result.current.updateConstraints({ bounds: constraintBounds });
        });

        const targetPosition: CanvasPosition = { x: 600, y: 500 }; // Outside bounds

        act(() => {
          result.current.panToPosition(targetPosition);
        });

        // Should be constrained to bounds
        const maxX = constraintBounds.maxX - mockCanvasSize.width / mockViewport.zoom;
        const maxY = constraintBounds.maxY - mockCanvasSize.height / mockViewport.zoom;

        expect(mockSetPosition).toHaveBeenCalledWith({
          x: Math.max(constraintBounds.minX, Math.min(maxX, targetPosition.x)),
          y: Math.max(constraintBounds.minY, Math.min(maxY, targetPosition.y)),
        });
      });
    });
  });

  // ============================================================================
  // ENTITY MANAGEMENT TESTS
  // ============================================================================

  describe('Entity Management', () => {
    it('should update entities collection', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const entities = [
        createMockEntity('entity1', { minX: 0, minY: 0, maxX: 100, maxY: 100 }),
        createMockEntity('entity2', { minX: 200, minY: 150, maxX: 300, maxY: 250 }),
      ];

      act(() => {
        result.current.updateEntities(entities);
      });

      expect(result.current.entities).toHaveLength(2);
    });

    it('should add individual entity', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const entity = createMockEntity('new-entity', { minX: 50, minY: 50, maxX: 150, maxY: 150 });

      act(() => {
        result.current.addEntity(entity);
      });

      expect(result.current.entities).toHaveLength(1);
      expect(result.current.entities[0].id).toBe('new-entity');
    });

    it('should update existing entity when adding with same id', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const entity1 = createMockEntity('entity', { minX: 0, minY: 0, maxX: 100, maxY: 100 });

      act(() => {
        result.current.addEntity(entity1);
      });

      expect(result.current.entities).toHaveLength(1);

      const entity2 = createMockEntity('entity', { minX: 50, minY: 50, maxX: 150, maxY: 150 });

      act(() => {
        result.current.addEntity(entity2);
      });

      expect(result.current.entities).toHaveLength(1);
      expect(result.current.entities[0].bounds).toEqual(entity2.bounds);
    });

    it('should remove entity by id', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const entities = [
        createMockEntity('entity1', { minX: 0, minY: 0, maxX: 100, maxY: 100 }),
        createMockEntity('entity2', { minX: 200, minY: 150, maxX: 300, maxY: 250 }),
      ];

      act(() => {
        result.current.updateEntities(entities);
      });

      expect(result.current.entities).toHaveLength(2);

      act(() => {
        result.current.removeEntity('entity1' as EntityId);
      });

      expect(result.current.entities).toHaveLength(1);
      expect(result.current.entities[0].id).toBe('entity2');
    });

    it('should calculate entity visibility and screen bounds', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const visibleBounds = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
      (getVisibleBounds as jest.Mock).mockReturnValue(visibleBounds);

      // Mock expandBounds for buffer zone calculation
      (expandBounds as jest.Mock).mockReturnValue({
        minX: -300, minY: -300, maxX: 700, maxY: 600,
      });

      const entities = [
        createMockEntity('visible', { minX: 100, minY: 100, maxX: 200, maxY: 200 }), // Visible
        createMockEntity('outside', { minX: 1000, minY: 1000, maxX: 1100, maxY: 1100 }), // Outside
      ];

      act(() => {
        result.current.updateEntities(entities);
      });

      const visibleEntities = result.current.entities;

      expect(visibleEntities).toHaveLength(2);

      const visibleEntity = visibleEntities.find(e => e.id === 'visible');
      const outsideEntity = visibleEntities.find(e => e.id === 'outside');

      expect(visibleEntity?.isVisible).toBe(true);
      expect(visibleEntity?.screenBounds).toBeDefined();
      expect(outsideEntity?.isVisible).toBe(false);
      expect(outsideEntity?.screenBounds).toBeUndefined();
    });

    it('should update content bounds when entities change', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const entities = [
        createMockEntity('entity1', { minX: 0, minY: 0, maxX: 100, maxY: 100 }),
      ];

      // Clear previous calls
      (calculateContentBounds as jest.Mock).mockClear();

      act(() => {
        result.current.updateEntities(entities);
      });

      expect(calculateContentBounds).toHaveBeenCalledWith(entities, 200);
    });
  });

  // ============================================================================
  // CONSTRAINT MANAGEMENT TESTS
  // ============================================================================

  describe('Constraint Management', () => {
    it('should update constraints partially', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const initialConstraints: ViewportConstraints = {
        minZoom: 0.5,
        maxZoom: 2.0,
      };

      act(() => {
        result.current.updateConstraints(initialConstraints);
      });

      expect(result.current.constraints).toEqual(initialConstraints);

      const additionalConstraints: Partial<ViewportConstraints> = {
        bounds: { minX: 0, minY: 0, maxX: 500, maxY: 400 },
      };

      act(() => {
        result.current.updateConstraints(additionalConstraints);
      });

      expect(result.current.constraints).toEqual({
        ...initialConstraints,
        ...additionalConstraints,
      });
    });

    it('should clear all constraints', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const constraints: ViewportConstraints = {
        minZoom: 0.5,
        maxZoom: 2.0,
        bounds: { minX: 0, minY: 0, maxX: 500, maxY: 400 },
      };

      act(() => {
        result.current.updateConstraints(constraints);
      });

      expect(result.current.constraints).toEqual(constraints);

      act(() => {
        result.current.clearConstraints();
      });

      expect(result.current.constraints).toEqual({});
    });

    it('should use constraints in zoom operations', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const constraints: ViewportConstraints = {
        minZoom: 1.0,
        maxZoom: 3.0,
      };

      act(() => {
        result.current.updateConstraints(constraints);
      });

      // Test max constraint
      act(() => {
        result.current.zoomToLevel(5.0);
      });

      expect(mockSetZoom).toHaveBeenCalledWith(3.0);

      // Test min constraint
      act(() => {
        result.current.zoomToLevel(0.5);
      });

      expect(mockSetZoom).toHaveBeenCalledWith(1.0);
    });
  });

  // ============================================================================
  // VIEWPORT QUERIES TESTS
  // ============================================================================

  describe('Viewport Queries', () => {
    beforeEach(() => {
      const mockBounds = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
      (getVisibleBounds as jest.Mock).mockReturnValue(mockBounds);
    });

    describe('isPointVisible', () => {
      it('should check if point is visible without buffer', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const point: CanvasPosition = { x: 200, y: 150 };

        const isVisible = result.current.isPointVisible(point, false);

        expect(containsPoint).toHaveBeenCalledWith(
          result.current.visibleBounds,
          point
        );
        expect(isVisible).toBeDefined();
      });

      it('should check if point is visible with buffer', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize, { bufferZone: 100 }));

        const point: CanvasPosition = { x: 200, y: 150 };

        result.current.isPointVisible(point, true);

        expect(expandBounds).toHaveBeenCalledWith(result.current.visibleBounds, 100);
      });
    });

    describe('isBoundsVisible', () => {
      it('should check if bounds center is visible', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const bounds: CanvasBounds = { minX: 100, minY: 50, maxX: 300, maxY: 200 };

        result.current.isBoundsVisible(bounds);

        // Should check center point
        const expectedCenter = {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2,
        };

        expect(containsPoint).toHaveBeenCalledWith(
          result.current.visibleBounds,
          expectedCenter
        );
      });

      it('should include buffer zone when requested', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize, { bufferZone: 150 }));

        const bounds: CanvasBounds = { minX: 100, minY: 50, maxX: 300, maxY: 200 };

        result.current.isBoundsVisible(bounds, true);

        expect(expandBounds).toHaveBeenCalledWith(result.current.visibleBounds, 150);
      });
    });

    describe('getViewportInfo', () => {
      it('should provide comprehensive viewport information', () => {
        const { result } = renderHook(() => useViewport(mockCanvasSize));

        const info = result.current.getViewportInfo();

        expect(info).toMatchObject({
          position: mockViewport.position,
          zoom: mockViewport.zoom,
          bounds: result.current.effectiveBounds,
          visibleBounds: result.current.visibleBounds,
          contentBounds: result.current.contentBounds,
          centerPoint: result.current.metrics.centerPoint,
          canvasSize: mockCanvasSize,
        });
      });
    });
  });

  // ============================================================================
  // EFFECTS AND LIFECYCLE TESTS
  // ============================================================================

  describe('Effects and Lifecycle', () => {
    it('should auto-fit content when enabled and entities are present', () => {
      (fitBoundsToViewport as jest.Mock).mockReturnValue({
        position: { x: 100, y: 50 },
        zoom: 1.5,
      });

      const { result } = renderHook(() => useViewport(mockCanvasSize, { autoFitContent: true }));

      const entities = [
        createMockEntity('entity1', { minX: 0, minY: 0, maxX: 100, maxY: 100 }),
      ];

      act(() => {
        result.current.updateEntities(entities);
      });

      expect(fitBoundsToViewport).toHaveBeenCalled();
      expect(mockSetZoom).toHaveBeenCalledWith(1.5);
      expect(mockSetPosition).toHaveBeenCalledWith({ x: 100, y: 50 });
    });

    it('should not auto-fit when disabled', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize, { autoFitContent: false }));

      const entities = [
        createMockEntity('entity1', { minX: 0, minY: 0, maxX: 100, maxY: 100 }),
      ];

      // Clear previous calls
      (fitBoundsToViewport as jest.Mock).mockClear();
      mockSetZoom.mockClear();
      mockSetPosition.mockClear();

      act(() => {
        result.current.updateEntities(entities);
      });

      expect(fitBoundsToViewport).not.toHaveBeenCalled();
      expect(mockSetZoom).not.toHaveBeenCalled();
      expect(mockSetPosition).not.toHaveBeenCalled();
    });

    it('should not auto-fit when no entities are present', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize, { autoFitContent: true }));

      // Clear previous calls
      (fitBoundsToViewport as jest.Mock).mockClear();
      mockSetZoom.mockClear();
      mockSetPosition.mockClear();

      act(() => {
        result.current.updateEntities([]);
      });

      expect(fitBoundsToViewport).not.toHaveBeenCalled();
      expect(mockSetZoom).not.toHaveBeenCalled();
      expect(mockSetPosition).not.toHaveBeenCalled();
    });

    it('should handle canvas size changes', () => {
      const { result, rerender } = renderHook(
        ({ canvasSize }) => useViewport(canvasSize),
        { initialProps: { canvasSize: mockCanvasSize } }
      );

      const newCanvasSize = { width: 1000, height: 800 };

      rerender({ canvasSize: newCanvasSize });

      // Should recalculate bounds with new canvas size
      expect(getVisibleBounds).toHaveBeenCalledWith(
        expect.anything(),
        newCanvasSize,
        expect.anything()
      );
    });

    it('should handle viewport changes from store', () => {
      const { rerender } = renderHook(() => useViewport(mockCanvasSize));

      const newViewport = { ...mockViewport, zoom: 2.0, position: { x: 200, y: 100 } };

      (useCanvasStore as unknown as jest.Mock).mockReturnValue({
        viewport: newViewport,
        config: mockCanvasConfig,
        setPosition: mockSetPosition,
        setZoom: mockSetZoom,
      });

      rerender();

      // Should use new viewport for calculations
      expect(getVisibleBounds).toHaveBeenCalledWith(
        newViewport,
        mockCanvasSize,
        expect.anything()
      );
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR CONDITIONS TESTS
  // ============================================================================

  describe('Edge Cases and Error Conditions', () => {
    it('should handle zero canvas size', () => {
      const zeroCanvasSize = { width: 0, height: 0 };

      expect(() => {
        renderHook(() => useViewport(zeroCanvasSize));
      }).not.toThrow();
    });

    it('should handle invalid entity bounds', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const invalidEntity: ViewportEntity = {
        id: 'invalid' as EntityId,
        bounds: { minX: 100, minY: 100, maxX: 50, maxY: 50 }, // Max < Min
      };

      expect(() => {
        act(() => {
          result.current.addEntity(invalidEntity);
        });
      }).not.toThrow();
    });

    it('should handle extreme zoom constraints', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const extremeConstraints: ViewportConstraints = {
        minZoom: 0,
        maxZoom: Infinity,
      };

      expect(() => {
        act(() => {
          result.current.updateConstraints(extremeConstraints);
          result.current.zoomToLevel(1000);
        });
      }).not.toThrow();
    });

    it('should handle NaN and Infinity values gracefully', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      expect(() => {
        act(() => {
          result.current.centerOnPoint({ x: NaN, y: Infinity });
          result.current.zoomToLevel(NaN as ZoomLevel);
          result.current.panToPosition({ x: -Infinity, y: NaN });
        });
      }).not.toThrow();
    });

    it('should handle missing canvas store gracefully', () => {
      (useCanvasStore as unknown as jest.Mock).mockReturnValue({
        viewport: mockViewport,
        config: undefined,
        setPosition: jest.fn(),
        setZoom: jest.fn(),
      });

      expect(() => {
        renderHook(() => useViewport(mockCanvasSize));
      }).not.toThrow();
    });

    it('should handle utility function errors', () => {
      (getVisibleBounds as jest.Mock).mockImplementation(() => {
        throw new Error('Calculation error');
      });

      expect(() => {
        renderHook(() => useViewport(mockCanvasSize));
      }).toThrow();
    });

    it('should handle very large entity collections efficiently', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const largeEntityArray = Array.from({ length: 10000 }, (_, i) => 
        createMockEntity(`entity${i}`, {
          minX: i, minY: i,
          maxX: i + 10, maxY: i + 10,
        })
      );

      const startTime = performance.now();

      act(() => {
        result.current.updateEntities(largeEntityArray);
      });

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.current.entities).toHaveLength(10000);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should work correctly with coordinate transformation round trips', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      (canvasToScreen as jest.Mock).mockImplementation((pos, viewport) => ({
        x: (pos.x - viewport.position.x) * viewport.zoom,
        y: (pos.y - viewport.position.y) * viewport.zoom,
      }));

      (screenToCanvas as jest.Mock).mockImplementation((pos, viewport) => ({
        x: pos.x / viewport.zoom + viewport.position.x,
        y: pos.y / viewport.zoom + viewport.position.y,
      }));

      const originalCanvasPos: CanvasPosition = { x: 200, y: 150 };
      const screenPos = result.current.toScreen(originalCanvasPos);
      const backToCanvasPos = result.current.toCanvas(screenPos);

      expect(backToCanvasPos.x).toBeCloseTo(originalCanvasPos.x, 10);
      expect(backToCanvasPos.y).toBeCloseTo(originalCanvasPos.y, 10);
    });

    it('should maintain entity visibility consistency with culling', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const entities = [
        createMockEntity('visible', { minX: 100, minY: 100, maxX: 200, maxY: 200 }),
        createMockEntity('outside', { minX: 1000, minY: 1000, maxX: 1100, maxY: 1100 }),
      ];

      // Mock containsPoint to return true for visible entity center, false for outside
      (containsPoint as jest.Mock).mockImplementation((bounds, point) => {
        if (point.x === 150 && point.y === 150) return true; // Visible entity center
        if (point.x === 1050 && point.y === 1050) return false; // Outside entity center
        return false;
      });

      act(() => {
        result.current.updateEntities(entities);
      });

      const visibleEntity = result.current.entities.find(e => e.id === 'visible');
      const outsideEntity = result.current.entities.find(e => e.id === 'outside');

      expect(visibleEntity?.isVisible).toBe(true);
      expect(outsideEntity?.isVisible).toBe(false);
    });

    it('should handle complex constraint scenarios', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize, { constrainToBounds: true }));

      const constraints: ViewportConstraints = {
        minZoom: 0.5,
        maxZoom: 2.0,
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 800 },
      };

      act(() => {
        result.current.updateConstraints(constraints);
      });

      // Test zoom constraints
      act(() => {
        result.current.zoomToLevel(3.0); // Beyond max
      });

      expect(mockSetZoom).toHaveBeenCalledWith(2.0);

      // Test position constraints
      act(() => {
        result.current.panToPosition({ x: 2000, y: 1500 }); // Beyond bounds
      });

      // Should be constrained
      expect(mockSetPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
        })
      );
    });

    it('should provide consistent metrics across operations', () => {
      const { result } = renderHook(() => useViewport(mockCanvasSize));

      const initialMetrics = result.current.metrics;

      // Add entities
      act(() => {
        result.current.updateEntities([
          createMockEntity('entity', { minX: 0, minY: 0, maxX: 100, maxY: 100 }),
        ]);
      });

      const metricsAfterEntities = result.current.metrics;

      // Zoom viewport
      const newViewport = { ...mockViewport, zoom: 2.0 };
      (useCanvasStore as unknown as jest.Mock).mockReturnValue({
        viewport: newViewport,
        config: mockCanvasConfig,
        setPosition: mockSetPosition,
        setZoom: mockSetZoom,
      });

      renderHook(() => useViewport(mockCanvasSize));

      // Metrics should be consistent with viewport changes
      expect(initialMetrics.zoomLevel).toBe(mockViewport.zoom);
      expect(metricsAfterEntities.zoomLevel).toBe(mockViewport.zoom);
    });
  });
});
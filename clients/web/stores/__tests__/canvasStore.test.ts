/**
 * Canvas Store Tests
 * 
 * Test suite for the canvas store implementation, covering viewport management,
 * configuration, and interaction handling.
 */

import { renderHook, act } from '@testing-library/react';
import { useCanvasStore, canvasSelectors } from '../canvasStore';
import type { CanvasStore } from '@/types/canvas.types';

describe('Canvas Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useCanvasStore.setState({
      viewport: {
        zoom: 1.0,
        minZoom: 0.1,
        maxZoom: 5.0,
        panOffset: { x: 0, y: 0 },
        center: { x: 0, y: 0 },
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      },
      config: {
        backgroundColor: '#f9fafb',
        showGrid: true,
        gridSize: 20,
        gridColor: '#e5e7eb',
        snapToGrid: false,
        performanceMode: false,
      },
      interaction: {
        isPanning: false,
        isSelecting: false,
        selectionRect: undefined,
        lastInteractionPosition: { x: 0, y: 0 },
      },
      isInitialized: false,
    });
  });

  describe('Viewport Management', () => {
    test('should set zoom level within bounds', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setZoom(2.0);
      });

      expect(result.current.viewport.zoom).toBe(2.0);

      // Test min zoom clamping
      act(() => {
        result.current.setZoom(0.05);
      });
      expect(result.current.viewport.zoom).toBe(0.1);

      // Test max zoom clamping
      act(() => {
        result.current.setZoom(10.0);
      });
      expect(result.current.viewport.zoom).toBe(5.0);
    });

    test('should zoom in and out', () => {
      const { result } = renderHook(() => useCanvasStore());

      const initialZoom = result.current.viewport.zoom;

      act(() => {
        result.current.zoomIn();
      });
      expect(result.current.viewport.zoom).toBeGreaterThan(initialZoom);

      act(() => {
        result.current.zoomOut();
      });
      expect(result.current.viewport.zoom).toBe(initialZoom);
    });

    test('should reset zoom to 1.0', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setZoom(3.0);
      });
      expect(result.current.viewport.zoom).toBe(3.0);

      act(() => {
        result.current.resetZoom();
      });
      expect(result.current.viewport.zoom).toBe(1.0);
    });

    test('should set and update pan offset', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setPanOffset({ x: 100, y: 50 });
      });

      expect(result.current.viewport.panOffset).toEqual({ x: 100, y: 50 });

      act(() => {
        result.current.panBy({ x: 20, y: -10 });
      });

      expect(result.current.viewport.panOffset).toEqual({ x: 120, y: 40 });
    });

    test('should center on a position', () => {
      const { result } = renderHook(() => useCanvasStore());

      // Initialize canvas dimensions first
      act(() => {
        result.current.initialize({ width: 800, height: 600 });
      });

      act(() => {
        result.current.centerOn({ x: 200, y: 150 });
      });

      expect(result.current.viewport.panOffset).toEqual({ x: 200, y: 150 });
    });
  });

  describe('Configuration', () => {
    test('should update config properties', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.updateConfig({
          backgroundColor: '#000000',
          gridSize: 30,
        });
      });

      expect(result.current.config.backgroundColor).toBe('#000000');
      expect(result.current.config.gridSize).toBe(30);
      // Other properties should remain unchanged
      expect(result.current.config.showGrid).toBe(true);
    });

    test('should toggle grid visibility', () => {
      const { result } = renderHook(() => useCanvasStore());

      const initialGridState = result.current.config.showGrid;

      act(() => {
        result.current.toggleGrid();
      });

      expect(result.current.config.showGrid).toBe(!initialGridState);

      act(() => {
        result.current.toggleGrid();
      });

      expect(result.current.config.showGrid).toBe(initialGridState);
    });

    test('should toggle snap to grid', () => {
      const { result } = renderHook(() => useCanvasStore());

      const initialSnapState = result.current.config.snapToGrid;

      act(() => {
        result.current.toggleSnapToGrid();
      });

      expect(result.current.config.snapToGrid).toBe(!initialSnapState);
    });
  });

  describe('Interaction', () => {
    test('should handle panning lifecycle', () => {
      const { result } = renderHook(() => useCanvasStore());

      // Start panning
      act(() => {
        result.current.startPanning({ x: 100, y: 100 });
      });

      expect(result.current.interaction.isPanning).toBe(true);
      expect(result.current.interaction.lastInteractionPosition).toEqual({ x: 100, y: 100 });

      // Update panning
      act(() => {
        result.current.updatePanning({ x: 120, y: 90 });
      });

      expect(result.current.viewport.panOffset).toEqual({ x: 20, y: -10 });
      expect(result.current.interaction.lastInteractionPosition).toEqual({ x: 120, y: 90 });

      // End panning
      act(() => {
        result.current.endPanning();
      });

      expect(result.current.interaction.isPanning).toBe(false);
    });

    test('should handle selection lifecycle', () => {
      const { result } = renderHook(() => useCanvasStore());

      // Start selection
      act(() => {
        result.current.startSelection({ x: 50, y: 50 });
      });

      expect(result.current.interaction.isSelecting).toBe(true);
      expect(result.current.interaction.selectionRect).toEqual({
        x: 50,
        y: 50,
        width: 0,
        height: 0,
      });

      // Update selection
      act(() => {
        result.current.updateSelection({ x: 150, y: 100 });
      });

      expect(result.current.interaction.selectionRect).toEqual({
        x: 50,
        y: 50,
        width: 100,
        height: 50,
      });

      // End selection
      act(() => {
        result.current.endSelection();
      });

      expect(result.current.interaction.isSelecting).toBe(false);
      expect(result.current.interaction.selectionRect).toBeUndefined();
    });

    test('should not update panning when not panning', () => {
      const { result } = renderHook(() => useCanvasStore());

      const initialOffset = { ...result.current.viewport.panOffset };

      act(() => {
        result.current.updatePanning({ x: 100, y: 100 });
      });

      expect(result.current.viewport.panOffset).toEqual(initialOffset);
    });

    test('should not update selection when not selecting', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.updateSelection({ x: 100, y: 100 });
      });

      expect(result.current.interaction.selectionRect).toBeUndefined();
    });
  });

  describe('Initialization', () => {
    test('should initialize canvas with dimensions', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.initialize({ width: 1920, height: 1080 });
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.viewport.bounds).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
      expect(result.current.viewport.center).toEqual({
        x: 960,
        y: 540,
      });
    });

    test('should reset store to default state', () => {
      const { result } = renderHook(() => useCanvasStore());

      // Modify state
      act(() => {
        result.current.setZoom(3.0);
        result.current.setPanOffset({ x: 100, y: 100 });
        result.current.initialize({ width: 800, height: 600 });
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.viewport.zoom).toBe(1.0);
      expect(result.current.viewport.panOffset).toEqual({ x: 0, y: 0 });
      expect(result.current.isInitialized).toBe(false);
    });
  });

  describe('Selectors', () => {
    test('should return correct values from selectors', () => {
      const store = useCanvasStore.getState();

      expect(canvasSelectors.getViewport(store)).toEqual(store.viewport);
      expect(canvasSelectors.getConfig(store)).toEqual(store.config);
      expect(canvasSelectors.getInteraction(store)).toEqual(store.interaction);
      expect(canvasSelectors.getZoom(store)).toBe(store.viewport.zoom);
      expect(canvasSelectors.getPanOffset(store)).toEqual(store.viewport.panOffset);
      expect(canvasSelectors.isGridVisible(store)).toBe(store.config.showGrid);
      expect(canvasSelectors.isSnapToGridEnabled(store)).toBe(store.config.snapToGrid);
      expect(canvasSelectors.isPanning(store)).toBe(store.interaction.isPanning);
      expect(canvasSelectors.isSelecting(store)).toBe(store.interaction.isSelecting);
    });
  });
});
/**
 * Canvas Store Tests
 * 
 * Test suite for the canvas store implementation, covering viewport management,
 * configuration, and interaction handling.
 */

import { renderHook, act } from '@testing-library/react';
import { useCanvasStore, canvasSelectors } from '../canvasStore';
import type { CanvasStore, ViewportState, CanvasConfig, CanvasInteraction } from '@/types/canvas.types';

describe('Canvas Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useCanvasStore.getState().reset();
  });

  describe('Initial State', () => {
    test('should have correct default viewport state', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      expect(result.current.viewport).toEqual({
        position: { x: 0, y: 0 },
        zoom: 1.0,
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        isDirty: false,
      });
    });

    test('should have correct default configuration', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      expect(result.current.config).toEqual({
        grid: {
          enabled: true,
          size: 20,
          color: '#e5e7eb',
          opacity: 0.3,
        },
        zoom: {
          min: 0.25,
          max: 4.0,
          step: 0.1,
        },
        performance: {
          enableCulling: true,
          enableVirtualization: true,
          maxVisibleCards: 1000,
        },
      });
    });

    test('should have correct default interaction state', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      expect(result.current.interaction.mode).toBe('select');
      expect(result.current.interaction.isActive).toBe(false);
      expect(result.current.interaction.selection.selectedIds).toEqual(new Set());
      expect(typeof result.current.interaction.lastInteractionTime).toBe('number');
    });

    test('should not be initialized by default', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      expect(result.current.isInitialized).toBe(false);
    });
  });

  describe('Viewport Management', () => {
    test('should set zoom level within bounds', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setZoom(2.0);
      });

      expect(result.current.viewport.zoom).toBe(2.0);
      expect(result.current.viewport.isDirty).toBe(true);
    });

    test('should clamp zoom to minimum bound', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setZoom(0.1); // Below minimum
      });

      expect(result.current.viewport.zoom).toBe(0.25); // Clamped to min
    });

    test('should clamp zoom to maximum bound', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setZoom(5.0); // Above maximum
      });

      expect(result.current.viewport.zoom).toBe(4.0); // Clamped to max
    });

    test('should set position and mark viewport as dirty', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setPosition({ x: 100, y: 50 });
      });

      expect(result.current.viewport.position).toEqual({ x: 100, y: 50 });
      expect(result.current.viewport.isDirty).toBe(true);
    });

    test('should pan by offset', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      // Set initial position
      act(() => {
        result.current.setPosition({ x: 50, y: 25 });
      });

      act(() => {
        result.current.panBy({ x: 20, y: 30 });
      });

      expect(result.current.viewport.position).toEqual({ x: 70, y: 55 });
    });

    test('should zoom to fit (reset view)', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      // Set some values
      act(() => {
        result.current.setZoom(2.5);
        result.current.setPosition({ x: 100, y: 100 });
      });

      act(() => {
        result.current.zoomToFit();
      });

      expect(result.current.viewport.zoom).toBe(1.0);
      expect(result.current.viewport.position).toEqual({ x: 0, y: 0 });
    });

    test('should center view', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      // Set position
      act(() => {
        result.current.setPosition({ x: 100, y: 100 });
      });

      act(() => {
        result.current.centerView();
      });

      expect(result.current.viewport.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.updateConfig({
          grid: {
            enabled: false,
            size: 40,
            color: '#ff0000',
            opacity: 0.5,
          },
        });
      });

      expect(result.current.config.grid.enabled).toBe(false);
      expect(result.current.config.grid.size).toBe(40);
      expect(result.current.config.grid.color).toBe('#ff0000');
      expect(result.current.config.grid.opacity).toBe(0.5);
    });

    test('should toggle grid', () => {
      const { result } = renderHook(() => useCanvasStore());

      const initialGridEnabled = result.current.config.grid.enabled;

      act(() => {
        result.current.toggleGrid();
      });

      expect(result.current.config.grid.enabled).toBe(!initialGridEnabled);
    });
  });

  describe('Interaction Management', () => {
    test('should set interaction mode', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.setInteractionMode('pan');
      });

      expect(result.current.interaction.mode).toBe('pan');
      expect(typeof result.current.interaction.lastInteractionTime).toBe('number');
    });

    test('should start interaction', () => {
      const { result } = renderHook(() => useCanvasStore());
      const position = { x: 100, y: 50 };

      act(() => {
        result.current.startInteraction(position);
      });

      expect(result.current.interaction.isActive).toBe(true);
      expect(result.current.interaction.startPosition).toEqual(position);
      expect(result.current.interaction.currentPosition).toEqual(position);
    });

    test('should update interaction', () => {
      const { result } = renderHook(() => useCanvasStore());
      const startPosition = { x: 100, y: 50 };
      const updatePosition = { x: 120, y: 70 };

      act(() => {
        result.current.startInteraction(startPosition);
        result.current.updateInteraction(updatePosition);
      });

      expect(result.current.interaction.currentPosition).toEqual(updatePosition);
      expect(result.current.interaction.startPosition).toEqual(startPosition);
    });

    test('should end interaction', () => {
      const { result } = renderHook(() => useCanvasStore());
      const position = { x: 100, y: 50 };

      act(() => {
        result.current.startInteraction(position);
        result.current.endInteraction();
      });

      expect(result.current.interaction.isActive).toBe(false);
      expect(result.current.interaction.startPosition).toBeUndefined();
      expect(result.current.interaction.currentPosition).toBeUndefined();
    });
  });

  describe('Selection Management', () => {
    test('should select single card', () => {
      const { result } = renderHook(() => useCanvasStore());
      const cardId = 'card-123';

      act(() => {
        result.current.selectCard(cardId);
      });

      expect(result.current.interaction.selection.selectedIds).toEqual(new Set([cardId]));
    });

    test('should select multiple cards', () => {
      const { result } = renderHook(() => useCanvasStore());
      const cardIds = ['card-1', 'card-2', 'card-3'];

      act(() => {
        result.current.selectMultiple(cardIds);
      });

      expect(result.current.interaction.selection.selectedIds).toEqual(new Set(cardIds));
    });

    test('should clear selection', () => {
      const { result } = renderHook(() => useCanvasStore());
      const cardIds = ['card-1', 'card-2'];

      act(() => {
        result.current.selectMultiple(cardIds);
        result.current.clearSelection();
      });

      expect(result.current.interaction.selection.selectedIds).toEqual(new Set());
    });

    test('should replace selection when selecting single card', () => {
      const { result } = renderHook(() => useCanvasStore());

      act(() => {
        result.current.selectMultiple(['card-1', 'card-2']);
        result.current.selectCard('card-3');
      });

      expect(result.current.interaction.selection.selectedIds).toEqual(new Set(['card-3']));
    });
  });

  describe('Store Reset', () => {
    test('should reset all state to defaults', () => {
      const { result } = renderHook(() => useCanvasStore());

      // Modify state
      act(() => {
        result.current.setZoom(2.0);
        result.current.setPosition({ x: 100, y: 100 });
        result.current.updateConfig({ grid: { enabled: false, size: 40, color: '#ff0000', opacity: 0.5 } });
        result.current.setInteractionMode('pan');
        result.current.selectCard('card-123');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify reset to defaults
      expect(result.current.viewport.zoom).toBe(1.0);
      expect(result.current.viewport.position).toEqual({ x: 0, y: 0 });
      expect(result.current.config.grid.enabled).toBe(true);
      expect(result.current.interaction.mode).toBe('select');
      expect(result.current.interaction.selection.selectedIds).toEqual(new Set());
      expect(result.current.isInitialized).toBe(false);
    });
  });

  describe('Selectors', () => {
    test('should provide viewport selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      const viewport = canvasSelectors.getViewport(result.current);
      
      expect(viewport).toEqual(result.current.viewport);
    });

    test('should provide config selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      const config = canvasSelectors.getConfig(result.current);
      
      expect(config).toEqual(result.current.config);
    });

    test('should provide interaction selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      const interaction = canvasSelectors.getInteraction(result.current);
      
      expect(interaction).toEqual(result.current.interaction);
    });

    test('should provide zoom selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      act(() => {
        result.current.setZoom(1.5);
      });
      
      const zoom = canvasSelectors.getZoom(result.current);
      expect(zoom).toBe(1.5);
    });

    test('should provide position selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      const position = { x: 100, y: 50 };
      
      act(() => {
        result.current.setPosition(position);
      });
      
      const selectedPosition = canvasSelectors.getPosition(result.current);
      expect(selectedPosition).toEqual(position);
    });

    test('should provide grid visibility selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      expect(canvasSelectors.isGridVisible(result.current)).toBe(true);
      
      act(() => {
        result.current.toggleGrid();
      });
      
      expect(canvasSelectors.isGridVisible(result.current)).toBe(false);
    });

    test('should provide interaction active selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      expect(canvasSelectors.isInteractionActive(result.current)).toBe(false);
      
      act(() => {
        result.current.startInteraction({ x: 0, y: 0 });
      });
      
      expect(canvasSelectors.isInteractionActive(result.current)).toBe(true);
    });

    test('should provide selected cards selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      const cardIds = ['card-1', 'card-2', 'card-3'];
      
      act(() => {
        result.current.selectMultiple(cardIds);
      });
      
      const selectedCards = canvasSelectors.getSelectedCards(result.current);
      expect(selectedCards).toEqual(cardIds);
    });

    test('should provide interaction mode selector', () => {
      const { result } = renderHook(() => useCanvasStore());
      
      act(() => {
        result.current.setInteractionMode('pan');
      });
      
      const mode = canvasSelectors.getInteractionMode(result.current);
      expect(mode).toBe('pan');
    });
  });
});
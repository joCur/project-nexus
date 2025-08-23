/**
 * Simplified Canvas Navigation Hook Tests
 * 
 * Tests focusing on observable behaviors and public API of the navigation hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useCanvasNavigation } from '../useCanvasNavigation';
import { useCanvasStore } from '@/stores/canvasStore';
import type {
  CanvasPosition,
  ZoomLevel,
  ViewportState,
} from '@/types/canvas.types';

// Mock the canvas store
jest.mock('@/stores/canvasStore');

describe('useCanvasNavigation (Simplified)', () => {
  let mockSetPosition: jest.Mock;
  let mockSetZoom: jest.Mock;
  let mockViewport: ViewportState;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSetPosition = jest.fn();
    mockSetZoom = jest.fn();

    mockViewport = {
      position: { x: 100, y: 50 },
      zoom: 1.0,
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
      isDirty: false,
    };

    (useCanvasStore as unknown as jest.Mock).mockReturnValue({
      viewport: mockViewport,
      setPosition: mockSetPosition,
      setZoom: mockSetZoom,
    });

    // Mock animation frame functions
    global.requestAnimationFrame = jest.fn().mockImplementation(callback => {
      setTimeout(callback, 0);
      return 1;
    });
    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Configuration and API', () => {
    it('should provide default configuration', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(result.current.config).toEqual({
        enableMomentum: true,
        momentumFriction: 0.95,
        animationDuration: 300,
        velocityThreshold: 50,
        maxVelocity: 2000,
        enableInertia: true,
        enableSmoothing: true,
      });
    });

    it('should merge custom configuration', () => {
      const customConfig = { enableMomentum: false, animationDuration: 500 };
      const { result } = renderHook(() => useCanvasNavigation(customConfig));

      expect(result.current.config.enableMomentum).toBe(false);
      expect(result.current.config.animationDuration).toBe(500);
      expect(result.current.config.momentumFriction).toBe(0.95); // Default value
    });

    it('should expose all required methods', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(typeof result.current.panTo).toBe('function');
      expect(typeof result.current.zoomTo).toBe('function');
      expect(typeof result.current.resetView).toBe('function');
      expect(typeof result.current.startNavigation).toBe('function');
      expect(typeof result.current.updateNavigation).toBe('function');
      expect(typeof result.current.endNavigation).toBe('function');
      expect(typeof result.current.stopAllAnimations).toBe('function');
    });

    it('should expose state properties', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(typeof result.current.isAnimating).toBe('boolean');
      expect(typeof result.current.isGestureActive).toBe('boolean');
      expect(typeof result.current.isMomentumActive).toBe('boolean');
      expect(result.current.currentVelocity).toHaveProperty('x');
      expect(result.current.currentVelocity).toHaveProperty('y');
    });
  });

  describe('Navigation Controls', () => {
    describe('panTo', () => {
      it('should pan immediately without animation', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetPosition: CanvasPosition = { x: 200, y: 300 };

        act(() => {
          result.current.panTo(targetPosition, false);
        });

        expect(mockSetPosition).toHaveBeenCalledWith(targetPosition);
      });

      it('should initiate animation when animated is true', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetPosition: CanvasPosition = { x: 200, y: 300 };

        act(() => {
          result.current.panTo(targetPosition, true);
        });

        expect(requestAnimationFrame).toHaveBeenCalled();
      });
    });

    describe('zoomTo', () => {
      it('should zoom immediately without animation', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        act(() => {
          result.current.zoomTo(2.0, undefined, false);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(2.0);
      });

      it('should zoom with focus point', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const focusPoint: CanvasPosition = { x: 250, y: 150 };

        act(() => {
          result.current.zoomTo(2.0, focusPoint, false);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(2.0);
        expect(mockSetPosition).toHaveBeenCalledWith(focusPoint);
      });

      it('should initiate animation when animated is true', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        act(() => {
          result.current.zoomTo(2.0, undefined, true);
        });

        expect(requestAnimationFrame).toHaveBeenCalled();
      });
    });

    describe('resetView', () => {
      it('should reset to default view without animation', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        act(() => {
          result.current.resetView(false);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(1);
        expect(mockSetPosition).toHaveBeenCalledWith({ x: 0, y: 0 });
      });

      it('should initiate reset animation when animated is true', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        act(() => {
          result.current.resetView(true);
        });

        expect(requestAnimationFrame).toHaveBeenCalled();
      });
    });
  });

  describe('Gesture Handling', () => {
    it('should handle start navigation gesture', () => {
      const { result } = renderHook(() => useCanvasNavigation());
      const startPosition: CanvasPosition = { x: 100, y: 200 };

      expect(() => {
        act(() => {
          result.current.startNavigation(startPosition, 'pan');
        });
      }).not.toThrow();
    });

    it('should handle update navigation for pan gesture', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 }, 'pan');
      });

      act(() => {
        result.current.updateNavigation({ x: 150, y: 120 });
      });

      expect(mockSetPosition).toHaveBeenCalledWith({
        x: mockViewport.position.x - 50,
        y: mockViewport.position.y - 20,
      });
    });

    it('should handle end navigation', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 }, 'pan');
      });

      expect(() => {
        act(() => {
          result.current.endNavigation();
        });
      }).not.toThrow();
    });

    it('should ignore update when no active gesture', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.updateNavigation({ x: 150, y: 150 });
      });

      expect(mockSetPosition).not.toHaveBeenCalled();
    });
  });

  describe('Animation Management', () => {
    it('should stop all animations', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      // Start an animation first so there's something to cancel
      act(() => {
        result.current.panTo({ x: 200, y: 200 }, true);
      });

      expect(() => {
        act(() => {
          result.current.stopAllAnimations();
        });
      }).not.toThrow();

      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should handle rapid animation calls', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.panTo({ x: 100, y: 100 }, true);
          result.current.zoomTo(2.0, undefined, true);
          result.current.resetView(true);
        });
      }).not.toThrow();

      expect(requestAnimationFrame).toHaveBeenCalled();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Store Integration', () => {
    it('should use viewport state from store', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.panTo({ x: 200, y: 200 }, false);
      });

      expect(mockSetPosition).toHaveBeenCalledWith({ x: 200, y: 200 });
    });

    it('should call store methods for position changes', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 }, 'pan');
        result.current.updateNavigation({ x: 150, y: 150 });
      });

      expect(mockSetPosition).toHaveBeenCalled();
    });

    it('should call store methods for zoom changes', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.zoomTo(1.5, undefined, false);
      });

      expect(mockSetZoom).toHaveBeenCalledWith(1.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid positions gracefully', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.panTo({ x: NaN, y: Infinity }, false);
          result.current.startNavigation({ x: -Infinity, y: NaN });
        });
      }).not.toThrow();
    });

    it('should handle invalid zoom values gracefully', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.zoomTo(NaN as ZoomLevel, undefined, false);
          result.current.zoomTo(-Infinity as ZoomLevel, undefined, false);
        });
      }).not.toThrow();
    });

    it('should handle concurrent gestures', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.startNavigation({ x: 100, y: 100 });
          result.current.startNavigation({ x: 200, y: 200 }); // Start new gesture
          result.current.endNavigation();
        });
      }).not.toThrow();
    });

    it('should handle end navigation without active gesture', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.endNavigation(); // No active gesture
        });
      }).not.toThrow();
    });
  });

  describe('Configuration Changes', () => {
    it('should handle dynamic configuration updates', () => {
      const { result, rerender } = renderHook(
        (props) => useCanvasNavigation(props.config),
        {
          initialProps: { config: { enableMomentum: true } }
        }
      );

      expect(result.current.config.enableMomentum).toBe(true);

      rerender({ config: { enableMomentum: false } });

      expect(result.current.config.enableMomentum).toBe(false);
    });

    it('should maintain API consistency across config changes', () => {
      const { result, rerender } = renderHook(
        (props) => useCanvasNavigation(props.config),
        {
          initialProps: { config: { animationDuration: 300 } }
        }
      );

      const initialAPI = Object.keys(result.current);

      rerender({ config: { animationDuration: 500 } });

      const updatedAPI = Object.keys(result.current);
      expect(updatedAPI).toEqual(initialAPI);
    });
  });

  describe('Lifecycle', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = renderHook(() => useCanvasNavigation());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle multiple mount/unmount cycles', () => {
      for (let i = 0; i < 3; i++) {
        const { unmount } = renderHook(() => useCanvasNavigation());
        unmount();
      }
    });
  });

  describe('Performance', () => {
    it('should handle rapid gesture updates', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 });
      });

      expect(() => {
        act(() => {
          for (let i = 0; i < 100; i++) {
            result.current.updateNavigation({ x: 100 + i, y: 100 + i });
          }
        });
      }).not.toThrow();
    });

    it('should handle rapid animation calls efficiently', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          for (let i = 0; i < 10; i++) {
            result.current.panTo({ x: i * 10, y: i * 10 }, true);
          }
        });
      }).not.toThrow();

      // Should have called cancelAnimationFrame to cancel previous animations
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Momentum Behavior', () => {
    it('should respect momentum configuration', () => {
      const { result: withMomentum } = renderHook(() => 
        useCanvasNavigation({ enableMomentum: true })
      );
      const { result: withoutMomentum } = renderHook(() => 
        useCanvasNavigation({ enableMomentum: false })
      );

      expect(withMomentum.current.config.enableMomentum).toBe(true);
      expect(withoutMomentum.current.config.enableMomentum).toBe(false);
    });

    it('should handle high-velocity gestures with momentum enabled', () => {
      const { result } = renderHook(() => useCanvasNavigation({ enableMomentum: true }));

      expect(() => {
        act(() => {
          result.current.startNavigation({ x: 100, y: 100 });
          result.current.updateNavigation({ x: 300, y: 300 }); // Large movement
          result.current.endNavigation();
        });
      }).not.toThrow();
    });

    it('should handle gesture end without momentum when disabled', () => {
      const { result } = renderHook(() => useCanvasNavigation({ enableMomentum: false }));

      expect(() => {
        act(() => {
          result.current.startNavigation({ x: 100, y: 100 });
          result.current.updateNavigation({ x: 300, y: 300 }); // Large movement
          result.current.endNavigation();
        });
      }).not.toThrow();
    });
  });
});
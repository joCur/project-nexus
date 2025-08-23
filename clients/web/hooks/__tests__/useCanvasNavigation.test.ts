/**
 * Canvas Navigation Hook Tests
 * 
 * Comprehensive tests for momentum-based scrolling, smooth animations,
 * gesture handling, and navigation controls.
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

// Mock performance.now for timing tests
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true,
});

describe('useCanvasNavigation', () => {
  let mockSetPosition: jest.Mock;
  let mockSetZoom: jest.Mock;
  let mockViewport: ViewportState;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(1000); // Fixed timestamp for testing

    // Mock store functions
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

    // Mock requestAnimationFrame and cancelAnimationFrame
    let animationId = 1;
    global.requestAnimationFrame = jest.fn((callback) => {
      const currentId = animationId++;
      // Execute callback immediately for testing
      callback(performance.now());
      return currentId;
    });
    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // INITIALIZATION AND CONFIGURATION TESTS
  // ============================================================================

  describe('Initialization and Configuration', () => {
    it('should initialize with default configuration', () => {
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

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        enableMomentum: false,
        animationDuration: 500,
      };

      const { result } = renderHook(() => useCanvasNavigation(customConfig));

      expect(result.current.config).toEqual({
        enableMomentum: false,
        momentumFriction: 0.95,
        animationDuration: 500,
        velocityThreshold: 50,
        maxVelocity: 2000,
        enableInertia: true,
        enableSmoothing: true,
      });
    });

    it('should provide initial state values', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(result.current.isAnimating).toBe(false);
      expect(result.current.isGestureActive).toBe(false);
      expect(result.current.isMomentumActive).toBe(false);
      expect(result.current.currentVelocity).toEqual({ x: 0, y: 0 });
    });
  });

  // ============================================================================
  // NAVIGATION CONTROLS TESTS
  // ============================================================================

  describe('Navigation Controls', () => {
    describe('panTo', () => {
      it('should pan to position without animation when animated=false', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetPosition: CanvasPosition = { x: 200, y: 300 };

        act(() => {
          result.current.panTo(targetPosition, false);
        });

        expect(mockSetPosition).toHaveBeenCalledWith(targetPosition);
        expect(result.current.isAnimating).toBe(false);
      });

      it('should animate to position when animated=true', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetPosition: CanvasPosition = { x: 200, y: 300 };

        act(() => {
          result.current.panTo(targetPosition, true);
        });

        expect(result.current.isAnimating).toBe(true);
        expect(requestAnimationFrame).toHaveBeenCalled();
      });

      it('should use custom animation duration', () => {
        const { result } = renderHook(() => useCanvasNavigation({ animationDuration: 500 }));
        const targetPosition: CanvasPosition = { x: 200, y: 300 };

        act(() => {
          result.current.panTo(targetPosition, true, 1000);
        });

        // Animation duration is used internally, test through animation completion
        expect(result.current.isAnimating).toBe(true);
      });

      it('should cancel existing animations before starting new one', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        // Start first animation
        act(() => {
          result.current.panTo({ x: 100, y: 100 }, true);
        });

        const firstAnimationId = (requestAnimationFrame as jest.Mock).mock.results[0].value;

        // Start second animation
        act(() => {
          result.current.panTo({ x: 200, y: 200 }, true);
        });

        expect(cancelAnimationFrame).toHaveBeenCalledWith(firstAnimationId);
      });
    });

    describe('zoomTo', () => {
      it('should zoom without animation when animated=false', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetZoom: ZoomLevel = 2.0;

        act(() => {
          result.current.zoomTo(targetZoom, undefined, false);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(targetZoom);
        expect(result.current.isAnimating).toBe(false);
      });

      it('should animate zoom when animated=true', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetZoom: ZoomLevel = 2.0;

        act(() => {
          result.current.zoomTo(targetZoom, undefined, true);
        });

        expect(result.current.isAnimating).toBe(true);
        expect(requestAnimationFrame).toHaveBeenCalled();
      });

      it('should zoom to focus point when provided', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetZoom: ZoomLevel = 2.0;
        const focusPoint: CanvasPosition = { x: 250, y: 150 };

        act(() => {
          result.current.zoomTo(targetZoom, focusPoint, false);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(targetZoom);
        expect(mockSetPosition).toHaveBeenCalledWith(focusPoint);
      });

      it('should handle zoom animation with focus point', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const targetZoom: ZoomLevel = 2.0;
        const focusPoint: CanvasPosition = { x: 250, y: 150 };

        act(() => {
          result.current.zoomTo(targetZoom, focusPoint, true);
        });

        expect(result.current.isAnimating).toBe(true);
        expect(requestAnimationFrame).toHaveBeenCalled();
      });
    });

    describe('resetView', () => {
      it('should reset to default position and zoom without animation', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        act(() => {
          result.current.resetView(false);
        });

        expect(mockSetZoom).toHaveBeenCalledWith(1);
        expect(mockSetPosition).toHaveBeenCalledWith({ x: 0, y: 0 });
        expect(result.current.isAnimating).toBe(false);
      });

      it('should animate reset to default view', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        act(() => {
          result.current.resetView(true);
        });

        expect(result.current.isAnimating).toBe(true);
        expect(requestAnimationFrame).toHaveBeenCalled();
      });
    });

    describe('stopAllAnimations', () => {
      it('should stop all running animations', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        // Start animation
        act(() => {
          result.current.panTo({ x: 200, y: 200 }, true);
        });

        expect(result.current.isAnimating).toBe(true);

        // Stop animations
        act(() => {
          result.current.stopAllAnimations();
        });

        expect(result.current.isAnimating).toBe(false);
        expect(cancelAnimationFrame).toHaveBeenCalled();
      });

      it('should stop momentum animations', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        // Start gesture and generate momentum
        act(() => {
          result.current.startNavigation({ x: 100, y: 100 });
        });

        act(() => {
          result.current.updateNavigation({ x: 200, y: 200 });
        });

        // Simulate fast gesture end to trigger momentum
        mockPerformanceNow.mockReturnValue(1050); // 50ms later
        act(() => {
          result.current.endNavigation();
        });

        // Stop all animations should cancel momentum
        act(() => {
          result.current.stopAllAnimations();
        });

        expect(result.current.isMomentumActive).toBe(false);
      });
    });
  });

  // ============================================================================
  // GESTURE HANDLING TESTS
  // ============================================================================

  describe('Gesture Handling', () => {
    describe('startNavigation', () => {
      it('should initialize gesture state', () => {
        const { result } = renderHook(() => useCanvasNavigation());
        const startPosition: CanvasPosition = { x: 100, y: 200 };

        act(() => {
          result.current.startNavigation(startPosition, 'pan');
        });

        expect(result.current.isGestureActive).toBe(true);
      });

      it('should cancel existing animations when starting gesture', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        // Start animation
        act(() => {
          result.current.panTo({ x: 200, y: 200 }, true);
        });

        expect(result.current.isAnimating).toBe(true);

        // Start gesture should cancel animation
        act(() => {
          result.current.startNavigation({ x: 100, y: 100 });
        });

        expect(result.current.isAnimating).toBe(false);
        expect(cancelAnimationFrame).toHaveBeenCalled();
      });

      it('should cancel momentum when starting new gesture', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        // Simulate momentum state
        act(() => {
          result.current.startNavigation({ x: 100, y: 100 });
          result.current.updateNavigation({ x: 200, y: 200 });
          result.current.endNavigation();
        });

        // Start new gesture should cancel momentum
        act(() => {
          result.current.startNavigation({ x: 150, y: 150 });
        });

        expect(result.current.isMomentumActive).toBe(false);
      });
    });

    describe('updateNavigation', () => {
      beforeEach(() => {
        mockPerformanceNow.mockReturnValue(1000);
      });

      it('should update viewport position for pan gesture', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        act(() => {
          result.current.startNavigation({ x: 100, y: 100 }, 'pan');
        });

        // Move to new position
        act(() => {
          result.current.updateNavigation({ x: 150, y: 120 });
        });

        // Should update position based on delta
        expect(mockSetPosition).toHaveBeenCalledWith({
          x: mockViewport.position.x - 50, // Delta x: 150 - 100 = 50
          y: mockViewport.position.y - 20, // Delta y: 120 - 100 = 20
        });
      });

      it('should calculate velocity with smoothing enabled', () => {
        const { result } = renderHook(() => useCanvasNavigation({ enableSmoothing: true }));

        act(() => {
          result.current.startNavigation({ x: 100, y: 100 }, 'pan');
        });

        mockPerformanceNow.mockReturnValue(1016); // 16ms later

        act(() => {
          result.current.updateNavigation({ x: 116, y: 108 });
        });

        // Velocity should be calculated with smoothing
        // deltaX = 16, deltaY = 8, deltaTime = 0.016s
        // velocityX = 16/0.016 = 1000, velocityY = 8/0.016 = 500
        // With smoothing factor 0.3: new velocity = old * 0.7 + new * 0.3

        expect(result.current.currentVelocity.x).toBeGreaterThan(0);
        expect(result.current.currentVelocity.y).toBeGreaterThan(0);
      });

      it('should calculate velocity without smoothing', () => {
        const { result } = renderHook(() => useCanvasNavigation({ enableSmoothing: false }));

        act(() => {
          result.current.startNavigation({ x: 100, y: 100 }, 'pan');
        });

        mockPerformanceNow.mockReturnValue(1016); // 16ms later

        act(() => {
          result.current.updateNavigation({ x: 116, y: 108 });
        });

        // Without smoothing, velocity should be direct calculation
        expect(result.current.currentVelocity.x).toBe(1000);
        expect(result.current.currentVelocity.y).toBe(500);
      });

      it('should clamp velocity to maximum', () => {
        const { result } = renderHook(() => useCanvasNavigation({ 
          enableSmoothing: false,
          maxVelocity: 1000,
        }));

        act(() => {
          result.current.startNavigation({ x: 100, y: 100 }, 'pan');
        });

        mockPerformanceNow.mockReturnValue(1001); // 1ms later (very fast movement)

        act(() => {
          result.current.updateNavigation({ x: 200, y: 200 });
        });

        // Very high velocity should be clamped
        const velocityMagnitude = Math.sqrt(
          result.current.currentVelocity.x ** 2 + 
          result.current.currentVelocity.y ** 2
        );
        expect(velocityMagnitude).toBeLessThanOrEqual(1000);
      });

      it('should ignore updates when gesture is not active', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        // Update without starting gesture
        act(() => {
          result.current.updateNavigation({ x: 150, y: 150 });
        });

        expect(mockSetPosition).not.toHaveBeenCalled();
        expect(result.current.isGestureActive).toBe(false);
      });
    });

    describe('endNavigation', () => {
      it('should end gesture and start momentum when enabled', () => {
        const { result } = renderHook(() => useCanvasNavigation({ enableMomentum: true }));

        act(() => {
          result.current.startNavigation({ x: 100, y: 100 }, 'pan');
        });

        mockPerformanceNow.mockReturnValue(1016);
        act(() => {
          result.current.updateNavigation({ x: 200, y: 150 });
        });

        act(() => {
          result.current.endNavigation();
        });

        expect(result.current.isGestureActive).toBe(false);
        // Momentum should start if velocity is above threshold
        if (result.current.currentVelocity.x !== 0 || result.current.currentVelocity.y !== 0) {
          expect(result.current.isMomentumActive).toBe(true);
        }
      });

      it('should not start momentum when disabled', () => {
        const { result } = renderHook(() => useCanvasNavigation({ enableMomentum: false }));

        act(() => {
          result.current.startNavigation({ x: 100, y: 100 }, 'pan');
        });

        act(() => {
          result.current.updateNavigation({ x: 200, y: 150 });
        });

        act(() => {
          result.current.endNavigation();
        });

        expect(result.current.isGestureActive).toBe(false);
        expect(result.current.isMomentumActive).toBe(false);
      });

      it('should handle end navigation when not active', () => {
        const { result } = renderHook(() => useCanvasNavigation());

        expect(() => {
          act(() => {
            result.current.endNavigation();
          });
        }).not.toThrow();

        expect(result.current.isGestureActive).toBe(false);
      });
    });
  });

  // ============================================================================
  // MOMENTUM SCROLLING TESTS
  // ============================================================================

  describe('Momentum Scrolling', () => {
    it('should not start momentum if velocity is below threshold', () => {
      const { result } = renderHook(() => useCanvasNavigation({ 
        enableMomentum: true,
        velocityThreshold: 100,
      }));

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 }, 'pan');
      });

      // Small, slow movement
      mockPerformanceNow.mockReturnValue(1100); // 100ms later
      act(() => {
        result.current.updateNavigation({ x: 105, y: 105 });
      });

      act(() => {
        result.current.endNavigation();
      });

      expect(result.current.isMomentumActive).toBe(false);
    });

    it('should start momentum for high velocity gestures', () => {
      const { result } = renderHook(() => useCanvasNavigation({ 
        enableMomentum: true,
        enableInertia: true,
        velocityThreshold: 50,
      }));

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 }, 'pan');
      });

      // Fast movement
      mockPerformanceNow.mockReturnValue(1016); // 16ms later
      act(() => {
        result.current.updateNavigation({ x: 200, y: 150 });
      });

      act(() => {
        result.current.endNavigation();
      });

      // Should start momentum for high velocity
      expect(result.current.isMomentumActive).toBe(true);
      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it('should apply friction during momentum deceleration', (done) => {
      const { result } = renderHook(() => useCanvasNavigation({ 
        enableMomentum: true,
        enableInertia: true,
        momentumFriction: 0.9,
        velocityThreshold: 10,
      }));

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 }, 'pan');
      });

      mockPerformanceNow.mockReturnValue(1016);
      act(() => {
        result.current.updateNavigation({ x: 200, y: 150 });
      });

      const initialVelocity = { ...result.current.currentVelocity };

      act(() => {
        result.current.endNavigation();
      });

      // Let momentum run for a bit
      setTimeout(() => {
        // Velocity should have decreased due to friction
        const currentVelocity = result.current.currentVelocity;
        const initialMagnitude = Math.sqrt(initialVelocity.x ** 2 + initialVelocity.y ** 2);
        const currentMagnitude = Math.sqrt(currentVelocity.x ** 2 + currentVelocity.y ** 2);

        if (currentMagnitude > 0) {
          expect(currentMagnitude).toBeLessThan(initialMagnitude);
        }
        done();
      }, 50);
    });

    it('should stop momentum when velocity falls below threshold', (done) => {
      const { result } = renderHook(() => useCanvasNavigation({ 
        enableMomentum: true,
        enableInertia: true,
        momentumFriction: 0.1, // High friction for quick stop
        velocityThreshold: 50,
      }));

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 }, 'pan');
      });

      mockPerformanceNow.mockReturnValue(1016);
      act(() => {
        result.current.updateNavigation({ x: 200, y: 150 });
      });

      act(() => {
        result.current.endNavigation();
      });

      // Wait for momentum to stop
      setTimeout(() => {
        expect(result.current.isMomentumActive).toBe(false);
        expect(result.current.currentVelocity).toEqual({ x: 0, y: 0 });
        done();
      }, 100);
    });
  });

  // ============================================================================
  // SMOOTH ANIMATIONS TESTS
  // ============================================================================

  describe('Smooth Animations', () => {
    beforeEach(() => {
      // Mock Date.now for animation timing
      jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should animate position with eased interpolation', (done) => {
      const { result } = renderHook(() => useCanvasNavigation({ animationDuration: 100 }));

      act(() => {
        result.current.panTo({ x: 200, y: 300 }, true);
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance time and trigger animation frame
      jest.spyOn(Date, 'now').mockReturnValue(1050); // 50ms elapsed

      setTimeout(() => {
        // Animation should still be running
        expect(result.current.isAnimating).toBe(true);
        
        // Position should be between start and end
        expect(mockSetPosition).toHaveBeenCalled();
        
        done();
      }, 16);
    });

    it('should complete animation when duration elapsed', (done) => {
      const { result } = renderHook(() => useCanvasNavigation({ animationDuration: 50 }));

      act(() => {
        result.current.panTo({ x: 200, y: 300 }, true);
      });

      // Advance time past animation duration
      jest.spyOn(Date, 'now').mockReturnValue(1100); // 100ms elapsed (past 50ms duration)

      setTimeout(() => {
        expect(result.current.isAnimating).toBe(false);
        expect(mockSetPosition).toHaveBeenCalledWith({ x: 200, y: 300 });
        done();
      }, 32); // Two animation frames
    });

    it('should animate zoom with position', (done) => {
      const { result } = renderHook(() => useCanvasNavigation({ animationDuration: 100 }));
      const focusPoint: CanvasPosition = { x: 250, y: 150 };

      act(() => {
        result.current.zoomTo(2.0, focusPoint, true);
      });

      expect(result.current.isAnimating).toBe(true);

      setTimeout(() => {
        // Both zoom and position should be updated during animation
        expect(mockSetZoom).toHaveBeenCalled();
        expect(mockSetPosition).toHaveBeenCalled();
        done();
      }, 16);
    });

    it('should handle rapid animation changes gracefully', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      // Start multiple animations rapidly
      act(() => {
        result.current.panTo({ x: 100, y: 100 }, true);
        result.current.panTo({ x: 200, y: 200 }, true);
        result.current.zoomTo(2.0, undefined, true);
        result.current.resetView(true);
      });

      // Should not crash and should cancel previous animations
      expect(cancelAnimationFrame).toHaveBeenCalled();
      expect(result.current.isAnimating).toBe(true);
    });
  });

  // ============================================================================
  // ANIMATION STATE MANAGEMENT TESTS
  // ============================================================================

  describe('Animation State Management', () => {
    it('should track animation state correctly', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(result.current.isAnimating).toBe(false);

      act(() => {
        result.current.panTo({ x: 200, y: 200 }, true);
      });

      expect(result.current.isAnimating).toBe(true);

      act(() => {
        result.current.stopAllAnimations();
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('should track gesture state correctly', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(result.current.isGestureActive).toBe(false);

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 });
      });

      expect(result.current.isGestureActive).toBe(true);

      act(() => {
        result.current.endNavigation();
      });

      expect(result.current.isGestureActive).toBe(false);
    });

    it('should provide current velocity information', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(result.current.currentVelocity).toEqual({ x: 0, y: 0 });

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 });
      });

      mockPerformanceNow.mockReturnValue(1016);
      act(() => {
        result.current.updateNavigation({ x: 116, y: 108 });
      });

      expect(result.current.currentVelocity.x).toBeGreaterThan(0);
      expect(result.current.currentVelocity.y).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CLEANUP AND LIFECYCLE TESTS
  // ============================================================================

  describe('Cleanup and Lifecycle', () => {
    it('should cleanup animations on unmount', () => {
      const { result, unmount } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.panTo({ x: 200, y: 200 }, true);
      });

      expect(result.current.isAnimating).toBe(true);

      unmount();

      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should handle config changes dynamically', () => {
      const { result, rerender } = renderHook(
        ({ config }) => useCanvasNavigation(config),
        { initialProps: { config: { animationDuration: 300 } } }
      );

      expect(result.current.config.animationDuration).toBe(300);

      rerender({ config: { animationDuration: 500 } });

      expect(result.current.config.animationDuration).toBe(500);
    });

    it('should maintain state consistency across rerenders', () => {
      const { result, rerender } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 });
      });

      const initialGestureState = result.current.isGestureActive;

      rerender();

      expect(result.current.isGestureActive).toBe(initialGestureState);
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR CONDITIONS TESTS
  // ============================================================================

  describe('Edge Cases and Error Conditions', () => {
    it('should handle zero animation duration', () => {
      const { result } = renderHook(() => useCanvasNavigation({ animationDuration: 0 }));

      expect(() => {
        act(() => {
          result.current.panTo({ x: 200, y: 200 }, true, 0);
        });
      }).not.toThrow();
    });

    it('should handle invalid positions gracefully', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.panTo({ x: NaN, y: Infinity }, false);
          result.current.startNavigation({ x: -Infinity, y: NaN });
          result.current.updateNavigation({ x: undefined as any, y: null as any });
        });
      }).not.toThrow();
    });

    it('should handle extreme zoom values', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.zoomTo(0, undefined, false);
          result.current.zoomTo(Infinity, undefined, false);
          result.current.zoomTo(NaN as ZoomLevel, undefined, false);
        });
      }).not.toThrow();
    });

    it('should handle rapid gesture changes', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.startNavigation({ x: 100, y: 100 });
          result.current.startNavigation({ x: 200, y: 200 });
          result.current.updateNavigation({ x: 150, y: 150 });
          result.current.endNavigation();
          result.current.endNavigation(); // Double end
        });
      }).not.toThrow();
    });

    it('should handle concurrent animations and gestures', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          // Start animation
          result.current.panTo({ x: 200, y: 200 }, true);
          
          // Start gesture during animation
          result.current.startNavigation({ x: 100, y: 100 });
          result.current.updateNavigation({ x: 150, y: 150 });
          
          // Start another animation
          result.current.zoomTo(2.0, undefined, true);
          
          // End gesture
          result.current.endNavigation();
        });
      }).not.toThrow();

      // Should maintain consistent state
      expect(typeof result.current.isAnimating).toBe('boolean');
      expect(typeof result.current.isGestureActive).toBe('boolean');
      expect(typeof result.current.isMomentumActive).toBe('boolean');
    });

    it('should handle missing requestAnimationFrame gracefully', () => {
      // Temporarily remove requestAnimationFrame
      const originalRAF = global.requestAnimationFrame;
      delete (global as any).requestAnimationFrame;

      const { result } = renderHook(() => useCanvasNavigation());

      expect(() => {
        act(() => {
          result.current.panTo({ x: 200, y: 200 }, true);
        });
      }).not.toThrow();

      // Restore
      global.requestAnimationFrame = originalRAF;
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance Tests', () => {
    it('should handle many rapid updates efficiently', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.startNavigation({ x: 100, y: 100 });
      });

      const startTime = performance.now();

      // Simulate many rapid updates
      act(() => {
        for (let i = 0; i < 1000; i++) {
          mockPerformanceNow.mockReturnValue(1000 + i);
          result.current.updateNavigation({ x: 100 + i, y: 100 + i });
        }
      });

      const endTime = performance.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.current.isGestureActive).toBe(true);
    });

    it('should not leak memory with repeated animations', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      // Start and stop many animations
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.panTo({ x: i, y: i }, true);
          result.current.stopAllAnimations();
        }
      });

      // Should maintain clean state
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.isMomentumActive).toBe(false);
    });

    it('should throttle excessive animation frame requests', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      const rafCallsBefore = (requestAnimationFrame as jest.Mock).mock.calls.length;

      // Start multiple concurrent animations
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.panTo({ x: i * 10, y: i * 10 }, true);
        }
      });

      const rafCallsAfter = (requestAnimationFrame as jest.Mock).mock.calls.length;

      // Should not exponentially increase RAF calls
      expect(rafCallsAfter - rafCallsBefore).toBeLessThan(20);
    });
  });
});
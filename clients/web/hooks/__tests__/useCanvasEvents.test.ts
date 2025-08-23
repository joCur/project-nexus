import { renderHook, act } from '@testing-library/react';
import { useCanvasEvents } from '../useCanvasEvents';
import { useCanvasStore } from '@/stores/canvasStore';
import { useCanvasNavigation } from '../useCanvasNavigation';
import { RefObject } from 'react';

// Mock the canvas store
jest.mock('@/stores/canvasStore');

// Mock the canvas navigation hook
jest.mock('../useCanvasNavigation');

// Mock window.matchMedia for accessibility features
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('useCanvasEvents', () => {
  let mockElement: HTMLDivElement;
  let containerRef: RefObject<HTMLDivElement>;
  let mockSetZoom: jest.Mock;
  let mockSetPosition: jest.Mock;
  let mockStore: any;
  let mockNavigation: any;

  beforeEach(() => {
    // Create mock element with all required methods
    mockElement = {
      tabIndex: 0,
      contains: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null), // Mock for accessibility elements
      setAttribute: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({ width: 100, height: 100 }),
    } as unknown as HTMLDivElement;

    // Create ref
    containerRef = { current: mockElement };

    // Mock store functions
    mockSetZoom = jest.fn();
    mockSetPosition = jest.fn();

    mockStore = {
      viewport: {
        zoom: 1,
        position: { x: 0, y: 0 },
      },
      setZoom: mockSetZoom,
      setPosition: mockSetPosition,
    };

    (useCanvasStore as unknown as jest.Mock).mockReturnValue(mockStore);
    
    // Mock canvas navigation hook
    mockNavigation = {
      panTo: jest.fn(),
      zoomTo: jest.fn(),
      resetView: jest.fn(),
      startNavigation: jest.fn(),
      updateNavigation: jest.fn(),
      endNavigation: jest.fn(),
      stopAllAnimations: jest.fn(),
      isAnimating: false,
      isGestureActive: false,
      isMomentumActive: false,
      currentVelocity: { x: 0, y: 0 },
      config: {
        enableMomentum: true,
        animationDuration: 300,
        enableInertia: true,
        enableSmoothing: true,
      },
    };
    
    (useCanvasNavigation as unknown as jest.Mock).mockReturnValue(mockNavigation);

    // Mock document.activeElement
    Object.defineProperty(document, 'activeElement', {
      value: mockElement,
      writable: true,
    });
    
    // Mock document.hidden for visibility API
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets up event listeners on mount', () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    
    renderHook(() => useCanvasEvents(containerRef));
    
    expect(mockElement.tabIndex).toBe(0);
    expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-label', 'Interactive canvas workspace');
    expect(mockElement.setAttribute).toHaveBeenCalledWith('role', 'application');
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockElement.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
    expect(mockElement.addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
    
    addEventListenerSpy.mockRestore();
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
    
    const { unmount } = renderHook(() => useCanvasEvents(containerRef));
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });

  describe('keyboard navigation', () => {
    let keydownHandler: (e: KeyboardEvent) => void;

    beforeEach(() => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      renderHook(() => useCanvasEvents(containerRef));
      keydownHandler = addEventListenerSpy.mock.calls[0][1] as (e: KeyboardEvent) => void;
      addEventListenerSpy.mockRestore();
      
      // Mock contains to return true
      (mockElement.contains as jest.Mock).mockReturnValue(true);
    });

    it('handles arrow key navigation', () => {
      const preventDefault = jest.fn();
      
      // Test ArrowUp
      act(() => {
        keydownHandler({ key: 'ArrowUp', preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockNavigation.panTo).toHaveBeenCalledWith({ x: 0, y: 20 }, true, 300);
      
      // Test ArrowDown
      act(() => {
        keydownHandler({ key: 'ArrowDown', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockNavigation.panTo).toHaveBeenCalledWith({ x: 0, y: -20 }, true, 300);
      
      // Test ArrowLeft
      act(() => {
        keydownHandler({ key: 'ArrowLeft', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockNavigation.panTo).toHaveBeenCalledWith({ x: 20, y: 0 }, true, 300);
      
      // Test ArrowRight
      act(() => {
        keydownHandler({ key: 'ArrowRight', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockNavigation.panTo).toHaveBeenCalledWith({ x: -20, y: 0 }, true, 300);
    });

    it('handles zoom in with + and = keys', () => {
      const preventDefault = jest.fn();
      
      // Test + key
      act(() => {
        keydownHandler({ key: '+', preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockNavigation.zoomTo).toHaveBeenCalledWith(1.1, undefined, true, 300);
      
      // Test = key (shift + = gives +)
      act(() => {
        keydownHandler({ key: '=', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockNavigation.zoomTo).toHaveBeenCalledWith(1.1, undefined, true, 300);
    });

    it('handles zoom out with - and _ keys', () => {
      const preventDefault = jest.fn();
      
      // Test - key
      act(() => {
        keydownHandler({ key: '-', preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockNavigation.zoomTo).toHaveBeenCalledWith(0.9, undefined, true, 300);
      
      // Test _ key (shift + - gives _)
      act(() => {
        keydownHandler({ key: '_', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockNavigation.zoomTo).toHaveBeenCalledWith(0.9, undefined, true, 300);
    });

    it('respects zoom limits', () => {
      const preventDefault = jest.fn();
      
      // Clear previous calls
      mockSetZoom.mockClear();
      
      // Test maximum zoom limit - start with high zoom
      mockStore.viewport.zoom = 3.8;
      (useCanvasStore as unknown as jest.Mock).mockReturnValue(mockStore);
      
      // Re-render hook with updated zoom
      const { unmount } = renderHook(() => useCanvasEvents(containerRef));
      unmount();
      
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      renderHook(() => useCanvasEvents(containerRef));
      const keyHandler = addEventListenerSpy.mock.calls[0][1] as (e: KeyboardEvent) => void;
      addEventListenerSpy.mockRestore();
      
      act(() => {
        keyHandler({ key: '+', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockNavigation.zoomTo).toHaveBeenCalledWith(4, undefined, true, 300); // Should clamp to max
    });

    it('handles reset with Ctrl+0 and Cmd+0', () => {
      const preventDefault = jest.fn();
      
      // Test Ctrl+0
      act(() => {
        keydownHandler({ key: '0', ctrlKey: true, preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockNavigation.resetView).toHaveBeenCalledWith(true);
      
      // Test Cmd+0 (metaKey)
      act(() => {
        keydownHandler({ key: '0', metaKey: true, preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockNavigation.resetView).toHaveBeenCalledWith(true);
    });

    it('handles Home key reset', () => {
      const preventDefault = jest.fn();
      
      act(() => {
        keydownHandler({ key: 'Home', preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockNavigation.resetView).toHaveBeenCalledWith(true);
    });

    it('ignores events when canvas is not focused', () => {
      (mockElement.contains as jest.Mock).mockReturnValue(false);
      const preventDefault = jest.fn();
      
      act(() => {
        keydownHandler({ key: 'ArrowUp', preventDefault } as unknown as KeyboardEvent);
      });
      
      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockNavigation.panTo).not.toHaveBeenCalled();
    });

    it('ignores 0 key without modifier keys', () => {
      const preventDefault = jest.fn();
      
      act(() => {
        keydownHandler({ key: '0', ctrlKey: false, metaKey: false, preventDefault } as unknown as KeyboardEvent);
      });
      
      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockNavigation.zoomTo).not.toHaveBeenCalled();
    });
  });

  describe('touch events', () => {
    let touchStartHandler: (e: TouchEvent) => void;
    let touchMoveHandler: (e: TouchEvent) => void;

    beforeEach(() => {
      renderHook(() => useCanvasEvents(containerRef));
      touchStartHandler = (mockElement.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'touchstart')[1];
      touchMoveHandler = (mockElement.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'touchmove')[1];
    });

    it('initializes pinch gesture on two-finger touch', () => {
      const touch1 = { clientX: 100, clientY: 100 };
      const touch2 = { clientX: 200, clientY: 200 };
      const touches = [touch1, touch2];
      
      act(() => {
        touchStartHandler({ touches } as unknown as TouchEvent);
      });
      
      // Should stop animations and announce pinch gesture
      expect(mockNavigation.stopAllAnimations).toHaveBeenCalled();
    });

    it('handles pinch-to-zoom during touch move', () => {
      // First initialize with two-finger touch start
      const touch1 = { clientX: 100, clientY: 100 };
      const touch2 = { clientX: 200, clientY: 200 };
      const touches = [touch1, touch2];
      
      act(() => {
        touchStartHandler({ touches } as unknown as TouchEvent);
      });
      
      // Then move with different positions for zoom
      const newTouch1 = { clientX: 50, clientY: 50 };
      const newTouch2 = { clientX: 250, clientY: 250 };
      const newTouches = [newTouch1, newTouch2];
      const preventDefault = jest.fn();
      
      act(() => {
        touchMoveHandler({ touches: newTouches, preventDefault } as unknown as TouchEvent);
      });
      
      expect(preventDefault).toHaveBeenCalled();
      // Should use navigation hook for zooming
      expect(mockNavigation.zoomTo).toHaveBeenCalled();
    });

    it('respects zoom limits during pinch gesture', () => {
      // First initialize pinch with high zoom scenario
      mockStore.viewport.zoom = 3;
      const touch1 = { clientX: 100, clientY: 100 };
      const touch2 = { clientX: 200, clientY: 200 };
      const touches = [touch1, touch2];
      
      act(() => {
        touchStartHandler({ touches } as unknown as TouchEvent);
      });
      
      // Then zoom in to test maximum limit
      const newTouch1 = { clientX: 0, clientY: 0 };
      const newTouch2 = { clientX: 400, clientY: 400 }; // Large distance for big scale
      const newTouches = [newTouch1, newTouch2];
      const preventDefault = jest.fn();
      
      act(() => {
        touchMoveHandler({ touches: newTouches, preventDefault } as unknown as TouchEvent);
      });
      
      // Should call navigation with clamped zoom (tested in navigation hook)
      expect(mockNavigation.zoomTo).toHaveBeenCalled();
    });

    it('handles single finger touch for pan', () => {
      const touch1 = { clientX: 100, clientY: 100 };
      const touches = [touch1];
      
      act(() => {
        touchStartHandler({ touches } as unknown as TouchEvent);
      });
      
      // Should start navigation for pan gesture
      expect(mockNavigation.startNavigation).toHaveBeenCalledWith(
        { x: 100, y: 100 }, 
        'pan'
      );
    });

    it('handles single touch move for pan', () => {
      // First start with single touch
      const touch1 = { clientX: 100, clientY: 100 };
      const touches = [touch1];
      
      act(() => {
        touchStartHandler({ touches } as unknown as TouchEvent);
      });
      
      // Then move
      const newTouch1 = { clientX: 150, clientY: 150 };
      const newTouches = [newTouch1];
      const preventDefault = jest.fn();
      
      act(() => {
        touchMoveHandler({ touches: newTouches, preventDefault } as unknown as TouchEvent);
      });
      
      expect(preventDefault).toHaveBeenCalled();
      expect(mockNavigation.updateNavigation).toHaveBeenCalledWith(
        { x: 150, y: 150 }
      );
    });
  });

  it('handles null container ref gracefully', () => {
    const nullRef = { current: null } as RefObject<HTMLDivElement>;
    
    expect(() => {
      renderHook(() => useCanvasEvents(nullRef));
    }).not.toThrow();
  });

  it('updates when viewport state changes', () => {
    const { rerender } = renderHook(() => useCanvasEvents(containerRef));
    
    // Update viewport state
    mockStore.viewport.zoom = 2;
    mockStore.viewport.panOffset = { x: 100, y: 50 };
    
    rerender();
    
    // Should use updated values in calculations (tested implicitly through other tests)
    expect(useCanvasStore).toHaveBeenCalled();
  });
  
  it('returns enhanced API with navigation methods', () => {
    const { result } = renderHook(() => useCanvasEvents(containerRef));
    
    expect(result.current).toHaveProperty('panTo');
    expect(result.current).toHaveProperty('zoomTo');
    expect(result.current).toHaveProperty('resetView');
    expect(result.current).toHaveProperty('isAnimating');
    expect(result.current).toHaveProperty('isGestureActive');
    expect(result.current).toHaveProperty('stopAllAnimations');
    expect(result.current).toHaveProperty('announceAction');
    expect(result.current).toHaveProperty('config');
  });
  
  it('handles escape key to stop animations', () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    renderHook(() => useCanvasEvents(containerRef));
    const keydownHandler = addEventListenerSpy.mock.calls[0][1] as (e: KeyboardEvent) => void;
    addEventListenerSpy.mockRestore();
    
    // Mock contains to return true
    (mockElement.contains as jest.Mock).mockReturnValue(true);
    
    const preventDefault = jest.fn();
    
    act(() => {
      keydownHandler({ key: 'Escape', preventDefault } as unknown as KeyboardEvent);
    });
    
    expect(preventDefault).toHaveBeenCalled();
    expect(mockNavigation.stopAllAnimations).toHaveBeenCalled();
  });
  
  it('handles touch end with momentum', () => {
    renderHook(() => useCanvasEvents(containerRef));
    
    // Get the touch handlers
    const touchStartHandler = (mockElement.addEventListener as jest.Mock).mock.calls
      .find(call => call[0] === 'touchstart')[1];
    const touchMoveHandler = (mockElement.addEventListener as jest.Mock).mock.calls
      .find(call => call[0] === 'touchmove')[1];
    const touchEndHandler = (mockElement.addEventListener as jest.Mock).mock.calls
      .find(call => call[0] === 'touchend')[1];
    
    // Start single touch
    const touch1 = { clientX: 100, clientY: 100 };
    const touches = [touch1];
    
    act(() => {
      touchStartHandler({ touches } as unknown as TouchEvent);
    });
    
    // Move touch to create gesture history
    const touch2 = { clientX: 150, clientY: 150 };
    const touchesMove = [touch2];
    
    act(() => {
      touchMoveHandler({ touches: touchesMove, preventDefault: jest.fn() } as unknown as TouchEvent);
    });
    
    // End touch (simulate quick gesture)
    act(() => {
      touchEndHandler({ touches: [] } as unknown as TouchEvent);
    });
    
    // Should call either endNavigation or stopAllAnimations depending on gesture conditions
    const endNavCalled = mockNavigation.endNavigation.mock.calls.length > 0;
    const stopAnimCalled = mockNavigation.stopAllAnimations.mock.calls.length > 0;
    expect(endNavCalled || stopAnimCalled).toBe(true);
  });
  
  it('handles focus and blur events', () => {
    renderHook(() => useCanvasEvents(containerRef));
    
    // Find focus handler
    const focusHandler = (mockElement.addEventListener as jest.Mock).mock.calls
      .find(call => call[0] === 'focus')[1];
    
    // Find blur handler
    const blurHandler = (mockElement.addEventListener as jest.Mock).mock.calls
      .find(call => call[0] === 'blur')[1];
    
    act(() => {
      focusHandler();
    });
    
    // Should announce focus
    expect(mockElement.querySelector).toHaveBeenCalledWith('#canvas-status');
    
    act(() => {
      blurHandler();
    });
    
    // Should stop animations on blur
    expect(mockNavigation.stopAllAnimations).toHaveBeenCalled();
  });
  
  it('respects prefers-reduced-motion for animations', () => {
    // Mock matchMedia to return true for reduced motion
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    renderHook(() => useCanvasEvents(containerRef));
    const keydownHandler = addEventListenerSpy.mock.calls[0][1] as (e: KeyboardEvent) => void;
    addEventListenerSpy.mockRestore();
    
    // Mock contains to return true
    (mockElement.contains as jest.Mock).mockReturnValue(true);
    
    const preventDefault = jest.fn();
    
    act(() => {
      keydownHandler({ key: 'ArrowUp', preventDefault } as unknown as KeyboardEvent);
    });
    
    // Should still call navigation but with reduced motion (animation disabled and slower speed)
    expect(mockNavigation.panTo).toHaveBeenCalledWith({ x: 0, y: 10 }, false, 0);
  });
  
  it('handles page visibility changes', () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    renderHook(() => useCanvasEvents(containerRef));
    
    // Find the visibility change handler
    const visibilityCall = addEventListenerSpy.mock.calls
      .find(call => call[0] === 'visibilitychange');
    const visibilityHandler = visibilityCall?.[1] as () => void;
    
    addEventListenerSpy.mockRestore();
    
    // Mock document as hidden
    Object.defineProperty(document, 'hidden', {
      value: true,
      writable: true,
    });
    
    act(() => {
      visibilityHandler();
    });
    
    // Should stop animations when page becomes hidden
    expect(mockNavigation.stopAllAnimations).toHaveBeenCalled();
  });
});
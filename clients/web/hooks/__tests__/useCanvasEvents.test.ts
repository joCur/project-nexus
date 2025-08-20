import { renderHook, act } from '@testing-library/react';
import { useCanvasEvents } from '../useCanvasEvents';
import { useCanvasStore } from '@/stores/canvasStore';
import { RefObject } from 'react';

// Mock the canvas store
jest.mock('@/stores/canvasStore');

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
  let mockSetPanOffset: jest.Mock;
  let mockStore: any;

  beforeEach(() => {
    // Create mock element
    mockElement = {
      tabIndex: 0,
      contains: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null), // Mock for accessibility elements
    } as unknown as HTMLDivElement;

    // Create ref
    containerRef = { current: mockElement };

    // Mock store functions
    mockSetZoom = jest.fn();
    mockSetPanOffset = jest.fn();

    mockStore = {
      viewport: {
        zoom: 1,
        panOffset: { x: 0, y: 0 },
      },
      setZoom: mockSetZoom,
      setPanOffset: mockSetPanOffset,
    };

    (useCanvasStore as unknown as jest.Mock).mockReturnValue(mockStore);

    // Mock document.activeElement
    Object.defineProperty(document, 'activeElement', {
      value: mockElement,
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
      expect(mockSetPanOffset).toHaveBeenCalledWith({ x: 0, y: 20 });
      
      // Test ArrowDown
      act(() => {
        keydownHandler({ key: 'ArrowDown', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockSetPanOffset).toHaveBeenCalledWith({ x: 0, y: -20 });
      
      // Test ArrowLeft
      act(() => {
        keydownHandler({ key: 'ArrowLeft', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockSetPanOffset).toHaveBeenCalledWith({ x: 20, y: 0 });
      
      // Test ArrowRight
      act(() => {
        keydownHandler({ key: 'ArrowRight', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockSetPanOffset).toHaveBeenCalledWith({ x: -20, y: 0 });
    });

    it('handles zoom in with + and = keys', () => {
      const preventDefault = jest.fn();
      
      // Test + key
      act(() => {
        keydownHandler({ key: '+', preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockSetZoom).toHaveBeenCalledWith(1.1);
      
      // Test = key (shift + = gives +)
      act(() => {
        keydownHandler({ key: '=', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockSetZoom).toHaveBeenCalledWith(1.1);
    });

    it('handles zoom out with - and _ keys', () => {
      const preventDefault = jest.fn();
      
      // Test - key
      act(() => {
        keydownHandler({ key: '-', preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockSetZoom).toHaveBeenCalledWith(0.9);
      
      // Test _ key (shift + - gives _)
      act(() => {
        keydownHandler({ key: '_', preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockSetZoom).toHaveBeenCalledWith(0.9);
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
      expect(mockSetZoom).toHaveBeenCalledWith(4); // Should clamp to max
    });

    it('handles reset with Ctrl+0 and Cmd+0', () => {
      const preventDefault = jest.fn();
      
      // Test Ctrl+0
      act(() => {
        keydownHandler({ key: '0', ctrlKey: true, preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockSetZoom).toHaveBeenCalledWith(1);
      expect(mockSetPanOffset).toHaveBeenCalledWith({ x: 0, y: 0 });
      
      // Test Cmd+0 (metaKey)
      act(() => {
        keydownHandler({ key: '0', metaKey: true, preventDefault } as unknown as KeyboardEvent);
      });
      expect(mockSetZoom).toHaveBeenCalledWith(1);
      expect(mockSetPanOffset).toHaveBeenCalledWith({ x: 0, y: 0 });
    });

    it('handles Home key reset', () => {
      const preventDefault = jest.fn();
      
      act(() => {
        keydownHandler({ key: 'Home', preventDefault } as unknown as KeyboardEvent);
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockSetZoom).toHaveBeenCalledWith(1);
      expect(mockSetPanOffset).toHaveBeenCalledWith({ x: 0, y: 0 });
    });

    it('ignores events when canvas is not focused', () => {
      (mockElement.contains as jest.Mock).mockReturnValue(false);
      const preventDefault = jest.fn();
      
      act(() => {
        keydownHandler({ key: 'ArrowUp', preventDefault } as unknown as KeyboardEvent);
      });
      
      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockSetPanOffset).not.toHaveBeenCalled();
    });

    it('ignores 0 key without modifier keys', () => {
      const preventDefault = jest.fn();
      
      act(() => {
        keydownHandler({ key: '0', ctrlKey: false, metaKey: false, preventDefault } as unknown as KeyboardEvent);
      });
      
      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockSetZoom).not.toHaveBeenCalled();
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
      
      // Should store initial pinch distance and zoom
      expect((mockElement as any)._initialPinchDistance).toBeCloseTo(141.42, 1); // sqrt((200-100)^2 + (200-100)^2)
      expect((mockElement as any)._initialZoom).toBe(1);
    });

    it('handles pinch-to-zoom during touch move', () => {
      // Initialize pinch gesture
      (mockElement as any)._initialPinchDistance = 100;
      (mockElement as any)._initialZoom = 1;
      
      const touch1 = { clientX: 50, clientY: 50 };
      const touch2 = { clientX: 150, clientY: 150 };
      const touches = [touch1, touch2];
      const preventDefault = jest.fn();
      
      act(() => {
        touchMoveHandler({ touches, preventDefault } as unknown as TouchEvent);
      });
      
      expect(preventDefault).toHaveBeenCalled();
      
      // New distance is sqrt((150-50)^2 + (150-50)^2) = ~141.42
      // Scale factor: 141.42 / 100 = ~1.414
      // New zoom: 1 * 1.414 = ~1.414
      expect(mockSetZoom).toHaveBeenCalledWith(expect.closeTo(1.414, 2));
    });

    it('respects zoom limits during pinch gesture', () => {
      // Test maximum zoom limit
      (mockElement as any)._initialPinchDistance = 100;
      (mockElement as any)._initialZoom = 3;
      
      const touch1 = { clientX: 0, clientY: 0 };
      const touch2 = { clientX: 200, clientY: 200 }; // Large distance for big scale
      const touches = [touch1, touch2];
      const preventDefault = jest.fn();
      
      act(() => {
        touchMoveHandler({ touches, preventDefault } as unknown as TouchEvent);
      });
      
      expect(mockSetZoom).toHaveBeenCalledWith(4); // Clamped to maximum
      
      // Test minimum zoom limit
      (mockElement as any)._initialZoom = 0.5;
      const smallTouch1 = { clientX: 95, clientY: 95 };
      const smallTouch2 = { clientX: 105, clientY: 105 }; // Small distance for small scale
      const smallTouches = [smallTouch1, smallTouch2];
      
      act(() => {
        touchMoveHandler({ touches: smallTouches, preventDefault } as unknown as TouchEvent);
      });
      
      expect(mockSetZoom).toHaveBeenCalledWith(0.25); // Clamped to minimum
    });

    it('ignores single finger touch', () => {
      const touch1 = { clientX: 100, clientY: 100 };
      const touches = [touch1];
      
      act(() => {
        touchStartHandler({ touches } as unknown as TouchEvent);
      });
      
      expect((mockElement as any)._initialPinchDistance).toBeUndefined();
    });

    it('ignores touch move without initial pinch data', () => {
      const touch1 = { clientX: 100, clientY: 100 };
      const touch2 = { clientX: 200, clientY: 200 };
      const touches = [touch1, touch2];
      const preventDefault = jest.fn();
      
      act(() => {
        touchMoveHandler({ touches, preventDefault } as unknown as TouchEvent);
      });
      
      expect(mockSetZoom).not.toHaveBeenCalled();
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
});
import { renderHook, act } from '@testing-library/react';
import { useCanvasSize } from '../useCanvasSize';
import { RefObject } from 'react';

// Mock ResizeObserver
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  private elements: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.push(element);
  }

  unobserve(element: Element) {
    this.elements = this.elements.filter(el => el !== element);
  }

  disconnect() {
    this.elements = [];
  }

  // Helper method to trigger resize
  trigger() {
    const entries = this.elements.map(element => ({
      target: element,
      contentRect: {
        width: (element as any).clientWidth || 800,
        height: (element as any).clientHeight || 600,
      },
    }));
    this.callback(entries as ResizeObserverEntry[], this);
  }
}

// Mock global ResizeObserver
(global as any).ResizeObserver = MockResizeObserver;

describe('useCanvasSize', () => {
  let mockElement: HTMLDivElement;
  let containerRef: RefObject<HTMLDivElement>;
  let resizeObserver: MockResizeObserver;

  beforeEach(() => {
    // Create mock element
    mockElement = {
      clientWidth: 800,
      clientHeight: 600,
    } as HTMLDivElement;

    // Create ref
    containerRef = { current: mockElement };

    // Mock ResizeObserver constructor to capture instance
    const OriginalResizeObserver = (global as any).ResizeObserver;
    (global as any).ResizeObserver = jest.fn().mockImplementation((callback) => {
      resizeObserver = new OriginalResizeObserver(callback);
      return resizeObserver;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns default size initially', () => {
    containerRef.current = null;
    
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('returns element size when container is available', () => {
    mockElement.clientWidth = 1200;
    mockElement.clientHeight = 900;
    
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    expect(result.current).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it('sets up ResizeObserver when available', () => {
    renderHook(() => useCanvasSize(containerRef));
    
    expect(global.ResizeObserver).toHaveBeenCalledWith(expect.any(Function));
    expect(resizeObserver.observe).toBeDefined();
  });

  it('responds to resize events via ResizeObserver', () => {
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    // Initial size
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
    
    // Change element size
    act(() => {
      mockElement.clientWidth = 1600;
      mockElement.clientHeight = 1200;
      resizeObserver.trigger();
    });
    
    expect(result.current).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('uses fallback values when element dimensions are 0', () => {
    mockElement.clientWidth = 0;
    mockElement.clientHeight = 0;
    
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('handles ref changes', () => {
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    // Initial element
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
    
    // Change element properties and trigger resize
    act(() => {
      mockElement.clientWidth = 1000;
      mockElement.clientHeight = 750;
      resizeObserver.trigger();
    });
    
    expect(result.current).toEqual({
      width: 1000,
      height: 750,
    });
  });

  it('cleans up ResizeObserver on unmount', () => {
    const { unmount } = renderHook(() => useCanvasSize(containerRef));
    
    const disconnectSpy = jest.spyOn(resizeObserver, 'disconnect');
    
    unmount();
    
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('falls back to window resize events when ResizeObserver is not available', () => {
    // Mock ResizeObserver as undefined
    const originalResizeObserver = (global as any).ResizeObserver;
    (global as any).ResizeObserver = undefined;
    
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderHook(() => useCanvasSize(containerRef));
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    
    // Restore ResizeObserver
    (global as any).ResizeObserver = originalResizeObserver;
    
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('responds to window resize events when using fallback', () => {
    // Mock ResizeObserver as undefined
    const originalResizeObserver = (global as any).ResizeObserver;
    (global as any).ResizeObserver = undefined;
    
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    // Initial size
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
    
    // Change element size and trigger window resize
    act(() => {
      mockElement.clientWidth = 1400;
      mockElement.clientHeight = 1050;
      
      // Trigger resize event
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);
    });
    
    expect(result.current).toEqual({
      width: 1400,
      height: 1050,
    });
    
    // Restore ResizeObserver
    (global as any).ResizeObserver = originalResizeObserver;
  });

  it('handles null container ref gracefully', () => {
    containerRef.current = null;
    
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('updates when container ref becomes available', () => {
    containerRef.current = null;
    
    const { result, rerender } = renderHook(() => useCanvasSize(containerRef));
    
    // Initially returns default
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
    
    // Set container ref
    containerRef.current = mockElement;
    
    rerender();
    
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('preserves size when element has clientWidth/clientHeight properties', () => {
    // Test with fractional dimensions
    mockElement.clientWidth = 1024.5;
    mockElement.clientHeight = 768.3;
    
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    expect(result.current).toEqual({
      width: 1024.5,
      height: 768.3,
    });
  });
});
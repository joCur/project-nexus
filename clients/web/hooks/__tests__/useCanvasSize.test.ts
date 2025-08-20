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
    const nullRef = { current: null } as RefObject<HTMLDivElement>;
    
    const { result } = renderHook(() => useCanvasSize(nullRef));
    
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('returns element size when container is available', () => {
    Object.defineProperty(mockElement, 'clientWidth', { value: 1200, writable: true });
    Object.defineProperty(mockElement, 'clientHeight', { value: 900, writable: true });
    
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
      Object.defineProperty(mockElement, 'clientWidth', { value: 1600, writable: true });
      Object.defineProperty(mockElement, 'clientHeight', { value: 1200, writable: true });
      resizeObserver.trigger();
    });
    
    expect(result.current).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('uses fallback values when element dimensions are 0', () => {
    Object.defineProperty(mockElement, 'clientWidth', { value: 0, writable: true });
    Object.defineProperty(mockElement, 'clientHeight', { value: 0, writable: true });
    
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
      Object.defineProperty(mockElement, 'clientWidth', { value: 1000, writable: true });
      Object.defineProperty(mockElement, 'clientHeight', { value: 750, writable: true });
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
      Object.defineProperty(mockElement, 'clientWidth', { value: 1400, writable: true });
      Object.defineProperty(mockElement, 'clientHeight', { value: 1050, writable: true });
      
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
    const nullRef = { current: null } as RefObject<HTMLDivElement>;
    
    const { result } = renderHook(() => useCanvasSize(nullRef));
    
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('updates when container ref becomes available', () => {
    const dynamicRef = { current: null } as RefObject<HTMLDivElement>;
    
    const { result, rerender } = renderHook(() => useCanvasSize(dynamicRef));
    
    // Initially returns default
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
    
    // Set container ref
    (dynamicRef as any).current = mockElement;
    
    rerender();
    
    expect(result.current).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('preserves size when element has clientWidth/clientHeight properties', () => {
    // Test with fractional dimensions
    Object.defineProperty(mockElement, 'clientWidth', { value: 1024.5, writable: true });
    Object.defineProperty(mockElement, 'clientHeight', { value: 768.3, writable: true });
    
    const { result } = renderHook(() => useCanvasSize(containerRef));
    
    expect(result.current).toEqual({
      width: 1024.5,
      height: 768.3,
    });
  });
});
import { useEffect, RefObject, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';

/**
 * Custom hook that sets up canvas event handlers for keyboard and touch interactions.
 * Provides keyboard navigation and touch gesture support.
 * 
 * @param containerRef - Reference to the canvas container element
 */
export const useCanvasEvents = (containerRef: RefObject<HTMLDivElement>) => {
  const { viewport, setZoom, setPanOffset } = useCanvasStore();
  const { zoom, panOffset } = viewport;

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle events when canvas is focused
    if (!containerRef.current?.contains(document.activeElement)) return;

    const panSpeed = 20;
    const zoomSpeed = 0.1;

    switch (e.key) {
      // Pan with arrow keys
      case 'ArrowUp':
        e.preventDefault();
        setPanOffset({ x: panOffset.x, y: panOffset.y + panSpeed });
        break;
      case 'ArrowDown':
        e.preventDefault();
        setPanOffset({ x: panOffset.x, y: panOffset.y - panSpeed });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setPanOffset({ x: panOffset.x + panSpeed, y: panOffset.y });
        break;
      case 'ArrowRight':
        e.preventDefault();
        setPanOffset({ x: panOffset.x - panSpeed, y: panOffset.y });
        break;
      
      // Zoom with + and - keys
      case '+':
      case '=':
        e.preventDefault();
        setZoom(Math.min(zoom * (1 + zoomSpeed), 4));
        break;
      case '-':
      case '_':
        e.preventDefault();
        setZoom(Math.max(zoom * (1 - zoomSpeed), 0.25));
        break;
      
      // Reset zoom with 0
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(1);
          setPanOffset({ x: 0, y: 0 });
        }
        break;
      
      // Home key to fit content (placeholder for future implementation)
      case 'Home':
        e.preventDefault();
        // TODO: Implement fit-to-content when cards are added
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
        break;
    }
  }, [zoom, panOffset, setZoom, setPanOffset, containerRef]);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Store initial touch positions for gesture detection
    if (e.touches.length === 2) {
      // Prepare for pinch-to-zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      // Store initial distance for pinch gesture
      (containerRef.current as any)._initialPinchDistance = distance;
      (containerRef.current as any)._initialZoom = zoom;
    }
  }, [zoom, containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && containerRef.current) {
      // Handle pinch-to-zoom
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const initialDistance = (containerRef.current as any)._initialPinchDistance;
      const initialZoom = (containerRef.current as any)._initialZoom;
      
      if (initialDistance && initialZoom) {
        const scale = distance / initialDistance;
        const newZoom = Math.min(Math.max(initialZoom * scale, 0.25), 4);
        setZoom(newZoom);
      }
    }
  }, [setZoom, containerRef]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Make container focusable
    container.tabIndex = 0;
    
    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyDown);
    
    // Add touch event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleKeyDown, handleTouchStart, handleTouchMove, containerRef]);
};
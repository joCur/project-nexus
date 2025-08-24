import { useEffect, RefObject, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';

/**
 * Custom hook that sets up basic canvas event handlers for keyboard and touch interactions.
 * Provides keyboard navigation and basic touch gesture support with accessibility compliance.
 * 
 * @param containerRef - Reference to the canvas container element
 */
export const useCanvasEvents = (containerRef: RefObject<HTMLDivElement>) => {
  const { viewport, setZoom, setPosition, config } = useCanvasStore();
  const { zoom, position } = viewport;

  // Handle keyboard events with accessibility
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle events when canvas is focused
    const container = containerRef.current;
    if (!container?.contains(document.activeElement)) return;
    
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panSpeed = prefersReducedMotion ? 10 : 20;
    const zoomSpeed = prefersReducedMotion ? 0.05 : 0.1;

    switch (e.key) {
      // Pan with arrow keys
      case 'ArrowUp':
        e.preventDefault();
        setPosition({ x: position.x, y: position.y + panSpeed });
        break;
      case 'ArrowDown':
        e.preventDefault();
        setPosition({ x: position.x, y: position.y - panSpeed });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setPosition({ x: position.x + panSpeed, y: position.y });
        break;
      case 'ArrowRight':
        e.preventDefault();
        setPosition({ x: position.x - panSpeed, y: position.y });
        break;
      
      // Zoom with + and - keys
      case '+':
      case '=':
        e.preventDefault();
        const newZoomIn = Math.min(zoom * (1 + zoomSpeed), config.zoom.max);
        if (newZoomIn !== zoom) {
          setZoom(newZoomIn);
        }
        break;
      case '-':
      case '_':
        e.preventDefault();
        const newZoomOut = Math.max(zoom * (1 - zoomSpeed), config.zoom.min);
        if (newZoomOut !== zoom) {
          setZoom(newZoomOut);
        }
        break;
      
      // Reset zoom and position
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(1);
          setPosition({ x: 0, y: 0 });
        }
        break;
      
      case 'Home':
        e.preventDefault();
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        break;
        
      case ' ':
        e.preventDefault();
        setPosition({ x: 0, y: 0 });
        break;
    }
  }, [zoom, position, setZoom, setPosition, config.zoom, containerRef]);

  // Handle basic touch events for mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    if (e.touches.length === 2) {
      // Store initial touch positions for pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      (container as any)._initialPinchDistance = distance;
      (container as any)._initialZoom = zoom;
    }
  }, [zoom, containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (e.touches.length === 2 && container) {
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const initialDistance = (container as any)._initialPinchDistance;
      const initialZoom = (container as any)._initialZoom;
      
      if (initialDistance && initialZoom) {
        const scale = distance / initialDistance;
        const newZoom = Math.min(
          Math.max(initialZoom * scale, config.zoom.min), 
          config.zoom.max
        );
        setZoom(newZoom);
      }
    }
  }, [setZoom, containerRef, config.zoom]);
  
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    if (e.touches.length === 0) {
      // Clean up pinch data
      delete (container as any)._initialPinchDistance;
      delete (container as any)._initialZoom;
    }
  }, [containerRef]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Ensure container is focusable
    container.tabIndex = 0;
    
    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleKeyDown, handleTouchStart, handleTouchMove, handleTouchEnd, containerRef]);
};
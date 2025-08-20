import { useState, useEffect, RefObject } from 'react';

interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Custom hook that tracks the size of a canvas container element.
 * Provides responsive sizing for the React-Konva Stage.
 * 
 * @param containerRef - Reference to the container element
 * @returns Current width and height of the container
 */
export const useCanvasSize = (containerRef: RefObject<HTMLDivElement>): CanvasSize => {
  const [size, setSize] = useState<CanvasSize>({
    width: 800,
    height: 600,
  });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setSize({
          width: clientWidth || 800,
          height: clientHeight || 600,
        });
      }
    };

    // Initial size
    updateSize();

    // Create ResizeObserver for efficient resize detection
    let resizeObserver: ResizeObserver | null = null;
    
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(containerRef.current);
    } else {
      // Fallback to window resize event if ResizeObserver is not available
      window.addEventListener('resize', updateSize);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updateSize);
      }
    };
  }, [containerRef]);

  return size;
};
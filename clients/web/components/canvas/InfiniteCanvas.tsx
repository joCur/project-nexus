'use client';

import React, { useRef } from 'react';
import { CanvasStage } from './CanvasStage';
import { CanvasBackground } from './CanvasBackground';
import { useCanvasSize } from '@/hooks/useCanvasSize';
import { useCanvasEvents } from '@/hooks/useCanvasEvents';
import { useCanvasStore } from '@/stores/canvasStore';

interface InfiniteCanvasProps {
  className?: string;
  showGrid?: boolean;
  ariaLabel?: string;
  ariaDescription?: string;
}

/**
 * Main infinite canvas component that provides the foundation for the visual workspace.
 * Integrates React-Konva for high-performance 2D rendering.
 * 
 * Core Features:
 * - Zoom range: 0.25x (25%) to 4.0x (400%) as per design specifications
 * - Pan navigation with keyboard and mouse support
 * - Responsive sizing with ResizeObserver
 * - Accessible keyboard navigation (arrow keys, +/- for zoom)
 * - WCAG AA compliant accessibility with screen reader support
 * 
 * Accessibility:
 * - ARIA application role with descriptive labels
 * - Dynamic zoom and position announcements
 * - Keyboard navigation support (arrow keys, +/-, space)
 * - Screen reader compatible instructions
 * - Focus management with visible focus indicators
 */
export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  className = '',
  showGrid = true,
  ariaLabel = 'Interactive infinite canvas workspace',
  ariaDescription = 'Use arrow keys to pan, plus and minus keys to zoom, space to reset view',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useCanvasSize(containerRef);
  const { viewport } = useCanvasStore();
  const { zoom, position } = viewport;
  
  // Set up canvas event handlers
  useCanvasEvents(containerRef);
  

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-canvas-base focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 ${className}`}
      data-testid="infinite-canvas"
      role="application"
      aria-label={ariaLabel}
      aria-describedby="canvas-instructions"
      aria-roledescription="Interactive infinite canvas for visual knowledge workspace"
      tabIndex={0}
    >
      {/* Screen reader instructions */}
      <div id="canvas-instructions" className="sr-only">
        {ariaDescription} 
        Current zoom level: {(zoom * 100).toFixed(0)} percent. 
        Zoom range: 25% to 400%. 
        Canvas dimensions: {width} by {height} pixels.
      </div>
      
      <CanvasStage
        width={width}
        height={height}
        scale={{ x: zoom, y: zoom }}
        position={{ x: position.x, y: position.y }}
      >
        <CanvasBackground
          width={width}
          height={height}
          showGrid={showGrid}
          zoom={zoom}
          position={position}
        />
        {/* Future: Card and connection layers will be added here */}
      </CanvasStage>
    </div>
  );
};


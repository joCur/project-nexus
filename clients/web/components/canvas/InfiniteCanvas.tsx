'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CanvasStage } from './CanvasStage';
import { CanvasBackground } from './CanvasBackground';
import { useCanvasSize } from '@/hooks/useCanvasSize';
import { useCanvasEvents } from '@/hooks/useCanvasEvents';
import { useCanvasStore } from '@/stores/canvasStore';

interface InfiniteCanvasProps {
  className?: string;
  showGrid?: boolean;
  debug?: boolean;
  ariaLabel?: string;
  ariaDescription?: string;
}

/**
 * Main infinite canvas component that provides the foundation for the visual workspace.
 * Integrates React-Konva for high-performance 2D rendering with responsive sizing.
 * 
 * Features:
 * - Zoom range: 0.25x (25%) to 4.0x (400%) as per design specifications
 * - Pan navigation with keyboard and mouse support
 * - Responsive sizing with ResizeObserver
 * - Accessible keyboard navigation (arrow keys, +/- for zoom)
 * - WCAG AA compliant accessibility with screen reader support
 * - Design system integration with semantic color tokens
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
  debug = false,
  ariaLabel = 'Interactive infinite canvas workspace',
  ariaDescription = 'Use arrow keys to pan, plus and minus keys to zoom, space to reset view',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useCanvasSize(containerRef);
  const { viewport } = useCanvasStore();
  const { zoom, position } = viewport;
  
  // Accessibility state for screen reader announcements
  const [announcement, setAnnouncement] = useState<string>('');
  const [lastAnnouncedZoom, setLastAnnouncedZoom] = useState<number>(zoom);
  
  // Set up canvas event handlers
  useCanvasEvents(containerRef);
  
  // Screen reader announcement for zoom changes
  const announceZoomChange = useCallback((newZoom: number) => {
    const zoomPercent = Math.round(newZoom * 100);
    const message = `Zoom level: ${zoomPercent} percent`;
    setAnnouncement(message);
    setLastAnnouncedZoom(newZoom);
  }, []);
  
  // Announce pan changes (for future use)
  // const announcePanChange = useCallback((offset: { x: number; y: number }) => {
  //   const message = `Canvas position: ${Math.round(offset.x)}, ${Math.round(offset.y)}`;
  //   setAnnouncement(message);
  // }, []);

  // Initialize canvas dimensions
  useEffect(() => {
    if (width > 0 && height > 0) {
      // Canvas is now initialized through store defaults
      // No explicit initialization needed
    }
  }, [width, height]);

  // Announce zoom changes for screen readers (throttled)
  useEffect(() => {
    const zoomDiff = Math.abs(zoom - lastAnnouncedZoom);
    if (zoomDiff >= 0.1) { // Only announce significant zoom changes
      const timeoutId = setTimeout(() => {
        announceZoomChange(zoom);
      }, 300); // Debounce announcements
      
      return () => clearTimeout(timeoutId);
    }
  }, [zoom, lastAnnouncedZoom, announceZoomChange]);

  useEffect(() => {
    if (debug) {
      console.log('Canvas initialized:', { width, height, zoom, position });
    }
  }, [width, height, zoom, position, debug]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-canvas-base focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 ${className}`}
      data-testid="infinite-canvas"
      role="application"
      aria-label={ariaLabel}
      aria-describedby="canvas-instructions canvas-status"
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
      
      {/* Live region for dynamic announcements */}
      <div 
        id="canvas-status"
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
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
        />
        {/* Future: Card and connection layers will be added here */}
      </CanvasStage>
      
      {debug && (
        <div 
          className="absolute top-4 left-4 bg-neutral-800 text-neutral-50 text-xs p-3 rounded-md shadow-lg border border-neutral-700"
          aria-hidden="true"
          role="log"
          aria-label="Canvas debug information"
        >
          <div className="font-medium mb-1">Canvas Debug Info</div>
          <div>Size: {width}×{height}px</div>
          <div>Zoom: {(zoom * 100).toFixed(0)}% (range: 25%-400%)</div>
          <div>Position: ({position.x.toFixed(0)}, {position.y.toFixed(0)})</div>
          <div className="text-neutral-300 text-xs mt-1">
            Grid: {showGrid ? 'enabled' : 'disabled'}
          </div>
        </div>
      )}
    </div>
  );
};